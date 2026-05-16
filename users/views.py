"""
Users app views — Auth endpoints, user management, supervision links
"""

from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Division, AdditionalRole, SupervisionLink, RoleLevel
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    UserLightSerializer,
    ChangePasswordSerializer,
    DivisionSerializer,
    DivisionLightSerializer,
    SupervisionLinkSerializer,
)
from .permissions import IsAdmin, IsAdminOrSelf


# ─────────────────────────────────────────────────────────────
# AUTH VIEWS
# ─────────────────────────────────────────────────────────────
class LoginView(TokenObtainPairView):
    """POST /api/auth/login/ — returns tokens + user profile."""
    serializer_class   = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    """POST /api/auth/logout/ — blacklists the refresh token."""
    def post(self, request):
        try:
            token = RefreshToken(request.data.get('refresh'))
            token.blacklist()
            return Response({'detail': 'Logged out successfully.'})
        except Exception:
            return Response({'detail': 'Invalid token.'}, status=400)


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/ — enforces policy + history check."""
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save(user=request.user)
                return Response({'detail': 'Password changed successfully.'})
            except Exception as e:
                return Response({'detail': str(e)}, status=400)
        return Response(serializer.errors, status=400)


class SessionHeartbeatView(APIView):
    """
    POST /api/auth/heartbeat/
    Frontend calls this every 60 s to keep session alive.
    Returns session timeout info for countdown display.
    """
    def post(self, request):
        idle_timeout = getattr(settings, 'SESSION_IDLE_TIMEOUT', 300)
        return Response({
            'status':                   'active',
            'session_timeout_seconds':  idle_timeout,
            'server_time':              timezone.now().isoformat(),
        })


# ─────────────────────────────────────────────────────────────
# USER MANAGEMENT
# ─────────────────────────────────────────────────────────────
class UserListCreateView(generics.ListCreateAPIView):
    """GET /api/users/  POST /api/users/  (admin only)"""
    permission_classes = [IsAdmin]
    filterset_fields   = ['primary_role', 'division', 'is_active']
    search_fields      = ['username', 'full_name', 'email', 'staff_id']
    ordering_fields    = ['full_name', 'created_at', 'primary_role']

    def get_queryset(self):
        return User.objects.select_related('division').prefetch_related(
            'additional_roles'
        ).all()

    def get_serializer_class(self):
        return UserCreateSerializer if self.request.method == 'POST' \
               else UserDetailSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        user.created_by = self.request.user
        user.save(update_fields=['created_by'])


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET PATCH DELETE /api/users/:id/"""
    permission_classes = [IsAdminOrSelf]
    queryset           = User.objects.select_related('division').all()
    serializer_class   = UserDetailSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response({'detail': 'User deactivated.'})


class UserProfileView(generics.RetrieveUpdateAPIView):
    """GET PATCH /api/users/me/"""
    serializer_class = UserDetailSerializer

    def get_object(self):
        return self.request.user


@api_view(['POST'])
@permission_classes([IsAdmin])
def unlock_user(request, pk):
    """POST /api/users/:id/unlock/"""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)
    user.unlock_account()
    return Response({'detail': f'{user.full_name} account unlocked.', 'is_locked': False})


@api_view(['POST'])
@permission_classes([IsAdmin])
def lock_user(request, pk):
    """POST /api/users/:id/lock/"""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)
    user.lock_account()
    return Response({'detail': f'{user.full_name} account locked.', 'is_locked': True})


@api_view(['POST'])
@permission_classes([IsAdmin])
def toggle_offline(request, pk):
    """POST /api/users/:id/offline/  — enable/disable offline mode."""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    user.offline_enabled     = not user.offline_enabled
    user.offline_enabled_by  = request.user if user.offline_enabled else None
    user.offline_enabled_at  = timezone.now() if user.offline_enabled else None
    user.save(update_fields=[
        'offline_enabled', 'offline_enabled_by', 'offline_enabled_at'
    ])
    state = 'enabled' if user.offline_enabled else 'disabled'
    return Response({'detail': f'Offline mode {state} for {user.full_name}.'})


# ─────────────────────────────────────────────────────────────
# ADDITIONAL ROLES (dual-role management)
# ─────────────────────────────────────────────────────────────
@api_view(['POST', 'DELETE'])
@permission_classes([IsAdmin])
def manage_additional_role(request, user_id):
    """POST/DELETE /api/users/:id/roles/  — body: { role_level: 6 }"""
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    role_level = request.data.get('role_level')
    if not role_level:
        return Response({'detail': 'role_level is required.'}, status=400)

    if request.method == 'POST':
        _, created = AdditionalRole.objects.get_or_create(
            user=user, role_level=role_level,
            defaults={'assigned_by': request.user}
        )
        if not created:
            return Response({'detail': 'Role already assigned.'}, status=400)
        return Response({'detail': 'Additional role added.'})

    deleted, _ = AdditionalRole.objects.filter(
        user=user, role_level=role_level
    ).delete()
    if not deleted:
        return Response({'detail': 'Role not found.'}, status=404)
    return Response({'detail': 'Additional role removed.'})


# ─────────────────────────────────────────────────────────────
# SUPERVISION LINKS
# ─────────────────────────────────────────────────────────────
class SupervisionLinkListCreateView(generics.ListCreateAPIView):
    """GET POST /api/supervision/"""
    permission_classes = [IsAdmin]
    serializer_class   = SupervisionLinkSerializer

    def get_queryset(self):
        return SupervisionLink.objects.select_related(
            'supervisor', 'supervised'
        ).all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@api_view(['DELETE'])
@permission_classes([IsAdmin])
def delete_supervision_link(request, pk):
    """DELETE /api/supervision/:id/"""
    try:
        SupervisionLink.objects.get(pk=pk).delete()
        return Response({'detail': 'Supervision link removed.'})
    except SupervisionLink.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)


@api_view(['GET'])
def my_supervised_users(request):
    """
    GET /api/supervision/mine/
    Returns all users the current user supervises (direct + indirect).
    Drives dashboard scoping for AAG/DAG.
    """
    def collect_supervised(user, visited=None):
        if visited is None:
            visited = set()
        result = []
        for link in SupervisionLink.objects.filter(
            supervisor=user
        ).select_related('supervised'):
            if link.supervised_id not in visited:
                visited.add(link.supervised_id)
                result.append(link.supervised)
                result.extend(collect_supervised(link.supervised, visited))
        return result

    supervised = collect_supervised(request.user)
    return Response(UserLightSerializer(supervised, many=True).data)


# ─────────────────────────────────────────────────────────────
# DIVISION VIEWS
# ─────────────────────────────────────────────────────────────
class DivisionListCreateView(generics.ListCreateAPIView):
    """GET POST /api/divisions/"""
    permission_classes = [IsAdmin]
    queryset           = Division.objects.filter(is_active=True)

    def get_serializer_class(self):
        return DivisionSerializer if self.request.query_params.get('tree') \
               else DivisionLightSerializer


class DivisionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET PATCH DELETE /api/divisions/:id/"""
    permission_classes = [IsAdmin]
    queryset           = Division.objects.all()
    serializer_class   = DivisionLightSerializer


# ─────────────────────────────────────────────────────────────
# DROPDOWN HELPERS
# ─────────────────────────────────────────────────────────────
@api_view(['GET'])
def users_by_role(request):
    """
    GET /api/users/by-role/?role=1
    Light user list filtered by primary role — used in assignment pickers.
    """
    role = request.query_params.get('role')
    qs   = User.objects.filter(is_active=True)
    if role:
        qs = qs.filter(primary_role=role)
    return Response(UserLightSerializer(qs.order_by('full_name'), many=True).data)
