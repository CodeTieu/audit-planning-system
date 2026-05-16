from django.contrib import admin
from .models import Engagement, EngagementTeam, DocumentType, DocumentAssignment


class EngagementTeamInline(admin.TabularInline):
    model           = EngagementTeam
    extra           = 0
    fields          = ('user', 'engagement_role', 'added_by', 'added_at')
    readonly_fields = ('added_at',)
    raw_id_fields   = ('user', 'added_by')


class DocumentAssignmentInline(admin.TabularInline):
    model           = DocumentAssignment
    extra           = 0
    fields          = ('document_type', 'assigned_to', 'status', 'deadline', 'submitted_at')
    readonly_fields = ('submitted_at',)
    raw_id_fields   = ('assigned_to',)
    ordering        = ('document_type__sequence_order',)


@admin.register(DocumentType)
class DocumentTypeAdmin(admin.ModelAdmin):
    list_display  = (
        'code', 'name', 'category', 'sequence_order',
        'unlock_after_code', 'is_active',
    )
    list_filter   = ('category', 'is_active')
    search_fields = ('code', 'name')
    ordering      = ('sequence_order',)


@admin.register(Engagement)
class EngagementAdmin(admin.ModelAdmin):
    list_display  = (
        'engagement_code', 'entity', 'audit_year', 'status',
        'team_leader', 'responsible_person', 'overall_deadline', 'locked_at',
    )
    list_filter   = ('status', 'audit_year', 'lead_type')
    search_fields = ('engagement_code', 'entity__name')
    ordering      = ('-audit_year', 'engagement_code')
    readonly_fields = (
        'engagement_code', 'created_at',
        'submitted_to_cea_at', 'locked_at', 'archived_at',
    )
    raw_id_fields   = ('entity', 'team_leader', 'responsible_person', 'created_by', 'locked_by')
    inlines         = [EngagementTeamInline, DocumentAssignmentInline]

    fieldsets = (
        ('Engagement', {'fields': (
            'engagement_code', 'entity', 'audit_year',
            'audit_period_start', 'audit_period_end',
            'reporting_framework', 'reporting_currency',
        )}),
        ('Assignment', {'fields': (
            'lead_type', 'responsible_person', 'team_leader', 'overall_deadline',
        )}),
        ('Status', {'fields': (
            'status', 'submitted_to_cea_at',
            'locked_at', 'locked_by', 'archived_at',
        )}),
        ('Audit Trail', {'fields': ('created_by', 'created_at')}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'entity', 'team_leader', 'responsible_person'
        )


@admin.register(EngagementTeam)
class EngagementTeamAdmin(admin.ModelAdmin):
    list_display  = ('engagement', 'user', 'engagement_role', 'added_by', 'added_at')
    list_filter   = ('engagement_role',)
    search_fields = ('engagement__engagement_code', 'user__full_name', 'user__username')
    raw_id_fields = ('engagement', 'user', 'added_by')


@admin.register(DocumentAssignment)
class DocumentAssignmentAdmin(admin.ModelAdmin):
    list_display  = (
        'engagement', 'document_type', 'assigned_to',
        'status', 'deadline', 'submitted_at',
    )
    list_filter   = ('status', 'document_type')
    search_fields = ('engagement__engagement_code', 'assigned_to__full_name')
    raw_id_fields = ('engagement', 'assigned_to', 'assigned_by')
    ordering      = ('engagement', 'document_type__sequence_order')
