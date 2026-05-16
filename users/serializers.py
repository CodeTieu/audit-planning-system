"""
Users app serializers — Auth, User CRUD, password management
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, Division, AdditionalRole, SupervisionLink, PasswordHistory, RoleLevel


# ─────────────────────────────────────────────────────────────
# AUTH SERIALIZERS
# ─────────────────────────────────────────────────────────────
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extended JWT serializer:
    - Enforces account lock checks
    - Records failed/successful login attempts
    - Checks password expiry
    - Returns user profile in token response
    """

    def validate(self, attrs):
        username = attrs.get('username', '')

        # Check if user exists and is locked
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {'detail': 'Invalid credentials.'}
            )

        if user.is_locked:
            raise serializers.ValidationError(
                {'detail': 'Account is locked. Please contact your administrator.'}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {'detail': 'Account is disabled. Please contact your administrator.'}
            )

        # Attempt authentication
        authenticated = authenticate(
            request=self.context.get('request'),
            username=username,
            password=attrs.get('password', '')
        )

        if not authenticated:
            user.record_failed_login()
            remaining = settings.MAX_FAILED_LOGIN_ATTEMPTS - user.failed_login_attempts
            if user.is_locked:
                raise serializers.ValidationError(
                    {'detail': 'Account locked after too many failed attempts. '
                               'Contact your administrator.'}
                )
            raise serializers.ValidationError(
                {'detail': f'Invalid credentials. '
                           f'{max(remaining, 0)} attempt(s) remaining before lockout.'}
            )

        user.record_successful_login()

        # Get standard JWT data
        data = super().validate(attrs)

        # Enrich response with user data the frontend needs
        data['user'] = {
            'id':            user.id,
            'username':      user.username,
            'full_name':     user.full_name,
            'email':         user.email,
            'primary_role':  user.primary_role,
            'role_display':  user.get_primary_role_display(),
            'all_roles':     user.get_all_role_levels(),
            'division_id':   user.division_id,
            'is_first_login': user.is_first_login,
            'password_expired': user.password_is_expired,
        }

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role']      = user.primary_role
        token['full_name'] = user.full_name
        return token


# ─────────────────────────────────────────────────────────────
# DIVISION SERIALIZER
# ─────────────────────────────────────────────────────────────
class DivisionSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model  = Division
        fields = ['id', 'name', 'code', 'parent', 'level', 'is_active', 'children']

    def get_children(self, obj):
        # Lazy nested children
        children = obj.children.filter(is_active=True)
        return DivisionSerializer(children, many=True).data


class DivisionLightSerializer(serializers.ModelSerializer):
    """Flat (non-recursive) for dropdowns."""
    class Meta:
        model  = Division
        fields = ['id', 'name', 'code', 'level', 'parent']


# ─────────────────────────────────────────────────────────────
# USER SERIALIZERS
# ─────────────────────────────────────────────────────────────
class UserLightSerializer(serializers.ModelSerializer):
    """Minimal representation for dropdowns and foreign key fields."""
    role_display = serializers.CharField(
        source='get_primary_role_display', read_only=True
    )

    class Meta:
        model  = User
        fields = ['id', 'username', 'full_name', 'email',
                  'primary_role', 'role_display', 'staff_id']


class UserDetailSerializer(serializers.ModelSerializer):
    role_display      = serializers.CharField(
        source='get_primary_role_display', read_only=True
    )
    division_name     = serializers.CharField(
        source='division.name', read_only=True
    )
    additional_roles  = serializers.SerializerMethodField()
    is_locked         = serializers.BooleanField(read_only=True)
    password_expired  = serializers.BooleanField(
        source='password_is_expired', read_only=True
    )

    class Meta:
        model  = User
        fields = [
            'id', 'username', 'email', 'full_name', 'staff_id', 'phone',
            'primary_role', 'role_display',
            'division', 'division_name',
            'is_active', 'is_first_login', 'is_locked',
            'failed_login_attempts', 'locked_at',
            'offline_enabled',
            'password_expired', 'password_changed_at',
            'additional_roles',
            'created_at', 'last_login',
        ]
        read_only_fields = [
            'is_first_login', 'is_locked', 'failed_login_attempts',
            'locked_at', 'password_changed_at', 'created_at', 'last_login',
        ]

    def get_additional_roles(self, obj):
        return [
            {
                'role_level':   ar.role_level,
                'role_display': ar.get_role_level_display(),
            }
            for ar in obj.additional_roles.all()
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    """Used by admin to create new users. System assigns default password."""
    class Meta:
        model  = User
        fields = [
            'username', 'email', 'full_name', 'staff_id', 'phone',
            'primary_role', 'division',
        ]

    def create(self, validated_data):
        # Generate default password: AuditPS@2024 (admin must change)
        default_password = 'AuditPS@2024'
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=default_password,
            full_name=validated_data.get('full_name', ''),
            staff_id=validated_data.get('staff_id'),
            phone=validated_data.get('phone', ''),
            primary_role=validated_data.get('primary_role', RoleLevel.AUDITOR),
            division=validated_data.get('division'),
            is_first_login=True,
        )
        # Record initial password in history
        PasswordHistory.objects.create(
            user=user, password_hash=user.password
        )
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password     = serializers.CharField(required=True)
    new_password     = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match.'}
            )
        return data

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def save(self, user):
        old_password = self.validated_data['old_password']
        new_password = self.validated_data['new_password']

        if not user.check_password(old_password):
            raise serializers.ValidationError(
                {'old_password': 'Current password is incorrect.'}
            )

        # Check password history
        history_count = getattr(settings, 'PASSWORD_HISTORY_COUNT', 3)
        recent_hashes = (
            PasswordHistory.objects
            .filter(user=user)
            .order_by('-created_at')[:history_count]
            .values_list('password_hash', flat=True)
        )
        from django.contrib.auth.hashers import check_password
        for old_hash in recent_hashes:
            if check_password(new_password, old_hash):
                raise serializers.ValidationError(
                    {'new_password':
                     f'You cannot reuse any of your last '
                     f'{history_count} passwords.'}
                )

        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        user.is_first_login = False
        user.save(update_fields=['password', 'password_changed_at', 'is_first_login'])

        # Save new hash to history
        PasswordHistory.objects.create(
            user=user, password_hash=user.password
        )

        # Prune history older than history_count
        old_ids = (
            PasswordHistory.objects
            .filter(user=user)
            .order_by('-created_at')
            .values_list('id', flat=True)[history_count:]
        )
        PasswordHistory.objects.filter(id__in=list(old_ids)).delete()


# ─────────────────────────────────────────────────────────────
# SUPERVISION LINK SERIALIZER
# ─────────────────────────────────────────────────────────────
class SupervisionLinkSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.CharField(
        source='supervisor.full_name', read_only=True
    )
    supervised_name = serializers.CharField(
        source='supervised.full_name', read_only=True
    )

    class Meta:
        model  = SupervisionLink
        fields = [
            'id', 'supervisor', 'supervisor_name',
            'supervised', 'supervised_name', 'created_at',
        ]
