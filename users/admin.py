from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Division, AdditionalRole, SupervisionLink, PasswordHistory


@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display  = ('name', 'code', 'level', 'parent')
    list_filter   = ('level',)
    search_fields = ('name', 'code')
    ordering      = ('level', 'name')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display    = (
        'username', 'full_name', 'email', 'primary_role',
        'division', 'is_active', 'locked_at', 'last_login',
    )
    list_filter     = ('primary_role', 'is_active', 'division')
    search_fields   = ('username', 'full_name', 'email')
    ordering        = ('primary_role', 'username')
    readonly_fields = ('last_login', 'password_changed_at', 'locked_at')

    fieldsets = (
        ('Account', {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'email')}),
        ('Role & Division', {'fields': ('primary_role', 'division')}),
        ('Status', {'fields': (
            'is_active', 'is_staff', 'is_superuser',
            'is_first_login', 'offline_enabled',
            'failed_login_attempts', 'locked_at',
            'password_changed_at',
        )}),
        ('Timestamps', {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        ('Create User', {
            'classes': ('wide',),
            'fields': (
                'username', 'full_name', 'email',
                'primary_role', 'division',
                'password1', 'password2',
            ),
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('division')


@admin.register(AdditionalRole)
class AdditionalRoleAdmin(admin.ModelAdmin):
    list_display  = ('user', 'role_level', 'assigned_by', 'assigned_at')
    list_filter   = ('role_level',)
    search_fields = ('user__username', 'user__full_name')
    raw_id_fields = ('user', 'assigned_by')


@admin.register(SupervisionLink)
class SupervisionLinkAdmin(admin.ModelAdmin):
    list_display  = ('supervisor', 'supervised', 'created_at', 'created_by')
    search_fields = ('supervisor__username', 'supervised__username')
    raw_id_fields = ('supervisor', 'supervised', 'created_by')


@admin.register(PasswordHistory)
class PasswordHistoryAdmin(admin.ModelAdmin):
    list_display  = ('user', 'created_at')
    search_fields = ('user__username',)
    raw_id_fields = ('user',)
