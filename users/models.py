"""
Users app models — Custom User, Roles, Divisions, Supervision hierarchy
"""

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone
from django.conf import settings


# ─────────────────────────────────────────────────────────────
# ROLE LEVEL CONSTANTS
# ─────────────────────────────────────────────────────────────
class RoleLevel:
    AUDITOR      = 1
    TEAM_LEADER  = 2
    CEA          = 3
    AAG          = 4
    DAG          = 5
    TSSU         = 6
    ADMIN        = 99


ROLE_CHOICES = [
    (RoleLevel.AUDITOR,      'Auditor'),
    (RoleLevel.TEAM_LEADER,  'Team Leader'),
    (RoleLevel.CEA,          'Chief External Auditor'),
    (RoleLevel.AAG,          'Assistant Auditor General'),
    (RoleLevel.DAG,          'Deputy Auditor General'),
    (RoleLevel.TSSU,         'Technical Support and Service Unit'),
    (RoleLevel.ADMIN,        'System Administrator'),
]

# Fixed positions — from CEA upward
FIXED_POSITION_LEVELS = {
    RoleLevel.CEA, RoleLevel.AAG, RoleLevel.DAG, RoleLevel.TSSU
}


# ─────────────────────────────────────────────────────────────
# DIVISION  (Zone > Division > Unit)
# ─────────────────────────────────────────────────────────────
class Division(models.Model):
    name      = models.CharField(max_length=150)
    code      = models.CharField(max_length=30, unique=True, blank=True, null=True)
    parent    = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='children'
    )
    level     = models.PositiveSmallIntegerField(default=1)
    # 1 = Zone/Top level, 2 = Division, 3 = Unit
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['level', 'name']

    def __str__(self):
        return f"{self.name} (L{self.level})"

    def get_descendant_ids(self):
        """Return IDs of all child divisions recursively."""
        ids = []
        queue = list(self.children.filter(is_active=True))
        while queue:
            div = queue.pop()
            ids.append(div.id)
            queue.extend(list(div.children.filter(is_active=True)))
        return ids


# ─────────────────────────────────────────────────────────────
# USER MANAGER
# ─────────────────────────────────────────────────────────────
class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user  = self.model(username=username, email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('primary_role', RoleLevel.ADMIN)
        return self.create_user(username, email, password, **extra)


# ─────────────────────────────────────────────────────────────
# CUSTOM USER MODEL
# ─────────────────────────────────────────────────────────────
class User(AbstractBaseUser, PermissionsMixin):
    username   = models.CharField(max_length=50, unique=True)
    email      = models.EmailField(unique=True)
    full_name  = models.CharField(max_length=150)
    staff_id   = models.CharField(max_length=30, unique=True, blank=True, null=True)
    phone      = models.CharField(max_length=30, blank=True)

    # Primary role
    primary_role = models.PositiveSmallIntegerField(
        choices=ROLE_CHOICES, default=RoleLevel.AUDITOR
    )

    # Division
    division = models.ForeignKey(
        Division, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='members'
    )

    # Account state
    is_active      = models.BooleanField(default=True)
    is_staff       = models.BooleanField(default=False)
    is_first_login = models.BooleanField(default=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_at      = models.DateTimeField(null=True, blank=True)

    # Password tracking
    password_changed_at = models.DateTimeField(default=timezone.now)

    # Offline feature
    offline_enabled    = models.BooleanField(default=False)
    offline_enabled_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='offline_activations'
    )
    offline_enabled_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_users'
    )

    objects = UserManager()

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['email', 'full_name']

    class Meta:
        ordering = ['full_name']

    def __str__(self):
        return f"{self.full_name} ({self.get_primary_role_display()})"

    # ── Role shortcuts ────────────────────────────────────────
    @property
    def is_auditor_role(self):
        return self.primary_role == RoleLevel.AUDITOR

    @property
    def is_team_leader_role(self):
        return self.primary_role == RoleLevel.TEAM_LEADER

    @property
    def is_cea_role(self):
        return self.primary_role == RoleLevel.CEA

    @property
    def is_aag_role(self):
        return self.primary_role == RoleLevel.AAG

    @property
    def is_dag_role(self):
        return self.primary_role == RoleLevel.DAG

    @property
    def is_tssu_role(self):
        return self.primary_role in (RoleLevel.TSSU, RoleLevel.ADMIN)

    @property
    def can_see_all(self):
        """Full system visibility — TSSU and Admin only."""
        return self.primary_role in (RoleLevel.TSSU, RoleLevel.ADMIN)

    @property
    def is_reviewer(self):
        return self.primary_role >= RoleLevel.TEAM_LEADER

    # ── Account lock ──────────────────────────────────────────
    @property
    def is_locked(self):
        return self.locked_at is not None

    def lock_account(self):
        self.locked_at = timezone.now()
        self.save(update_fields=['locked_at'])

    def unlock_account(self):
        self.locked_at = None
        self.failed_login_attempts = 0
        self.save(update_fields=['locked_at', 'failed_login_attempts'])

    def record_failed_login(self):
        self.failed_login_attempts += 1
        max_attempts = getattr(settings, 'MAX_FAILED_LOGIN_ATTEMPTS', 5)
        if self.failed_login_attempts >= max_attempts:
            self.lock_account()
        else:
            self.save(update_fields=['failed_login_attempts'])

    def record_successful_login(self):
        self.failed_login_attempts = 0
        self.last_login = timezone.now()
        self.save(update_fields=['failed_login_attempts', 'last_login'])

    # ── Password expiry ───────────────────────────────────────
    @property
    def password_is_expired(self):
        if not self.password_changed_at:
            return True
        expiry_days = getattr(settings, 'PASSWORD_EXPIRY_DAYS', 90)
        delta = timezone.now() - self.password_changed_at
        return delta.days >= expiry_days

    def get_all_role_levels(self):
        """Primary role + any additional roles (dual-role support)."""
        levels = [self.primary_role]
        levels += list(
            self.additional_roles.values_list('role_level', flat=True)
        )
        return list(set(levels))


# ─────────────────────────────────────────────────────────────
# ADDITIONAL ROLES  (dual roles: e.g. Auditor who is also TSSU)
# ─────────────────────────────────────────────────────────────
class AdditionalRole(models.Model):
    user        = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='additional_roles'
    )
    role_level  = models.PositiveSmallIntegerField(choices=ROLE_CHOICES)
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name='assigned_additional_roles'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'role_level')

    def __str__(self):
        return f"{self.user.username} — {self.get_role_level_display()} (additional)"


# ─────────────────────────────────────────────────────────────
# SUPERVISION LINKS  (AAG supervises CEA, DAG supervises AAG …)
# ─────────────────────────────────────────────────────────────
class SupervisionLink(models.Model):
    supervisor  = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='supervises'
    )
    supervised  = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='supervised_by'
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    created_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name='created_links'
    )

    class Meta:
        unique_together = ('supervisor', 'supervised')

    def __str__(self):
        return (
            f"{self.supervisor.full_name} "
            f"supervises {self.supervised.full_name}"
        )


# ─────────────────────────────────────────────────────────────
# PASSWORD HISTORY  (prevent reuse of last N passwords)
# ─────────────────────────────────────────────────────────────
class PasswordHistory(models.Model):
    user          = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='password_history'
    )
    password_hash = models.CharField(max_length=255)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} — {self.created_at.date()}"
