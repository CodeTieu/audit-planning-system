"""
Engagements app serializers
"""

from rest_framework import serializers
from .models import Engagement, EngagementTeam, DocumentType, DocumentAssignment


# ─────────────────────────────────────────────────────────────
# DocumentType
# ─────────────────────────────────────────────────────────────

class DocumentTypeSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model  = DocumentType
        fields = [
            'id', 'code', 'name', 'category', 'category_display',
            'sequence_order', 'unlock_after_code', 'workpaper_ref', 'is_active',
        ]
        read_only_fields = ['id']


# ─────────────────────────────────────────────────────────────
# DocumentAssignment
# ─────────────────────────────────────────────────────────────

class DocumentAssignmentSerializer(serializers.ModelSerializer):
    document_type_code = serializers.CharField(source='document_type.code', read_only=True)
    document_type_name = serializers.CharField(source='document_type.name', read_only=True)
    assigned_to_name   = serializers.CharField(source='assigned_to.full_name', read_only=True)
    assigned_by_name   = serializers.CharField(source='assigned_by.full_name', read_only=True)
    status_display     = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = DocumentAssignment
        fields = [
            'id', 'engagement', 'document_type', 'document_type_code', 'document_type_name',
            'assigned_to', 'assigned_to_name', 'assigned_by', 'assigned_by_name',
            'deadline', 'status', 'status_display',
            'submitted_at', 'tl_approved_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'assigned_by', 'submitted_at', 'tl_approved_at', 'created_at',
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['assigned_by'] = request.user
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────
# EngagementTeam
# ─────────────────────────────────────────────────────────────

class EngagementTeamSerializer(serializers.ModelSerializer):
    user_full_name       = serializers.CharField(source='user.full_name', read_only=True)
    user_role_display    = serializers.CharField(
        source='user.get_primary_role_display', read_only=True
    )
    engagement_role_display = serializers.CharField(
        source='get_engagement_role_display', read_only=True
    )
    added_by_name        = serializers.CharField(source='added_by.full_name', read_only=True)

    class Meta:
        model  = EngagementTeam
        fields = [
            'id', 'engagement', 'user', 'user_full_name', 'user_role_display',
            'engagement_role', 'engagement_role_display',
            'added_by', 'added_by_name', 'added_at',
        ]
        read_only_fields = ['id', 'added_by', 'added_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['added_by'] = request.user
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────
# Engagement — List (compact)
# ─────────────────────────────────────────────────────────────

class EngagementListSerializer(serializers.ModelSerializer):
    entity_name        = serializers.CharField(source='entity.name', read_only=True)
    entity_code        = serializers.CharField(source='entity.code', read_only=True)
    team_leader_name   = serializers.CharField(source='team_leader.full_name', read_only=True)
    created_by_name    = serializers.CharField(source='created_by.full_name', read_only=True)
    status_display     = serializers.CharField(source='get_status_display', read_only=True)
    documents_total    = serializers.SerializerMethodField()
    documents_submitted = serializers.SerializerMethodField()

    def get_documents_total(self, obj):
        return obj.document_assignments.count()

    def get_documents_submitted(self, obj):
        return obj.document_assignments.filter(
            status__in=['submitted', 'tl_approved', 'in_review', 'finalized', 'locked']
        ).count()

    class Meta:
        model  = Engagement
        fields = [
            'id', 'engagement_code', 'entity', 'entity_name', 'entity_code',
            'audit_year', 'status', 'status_display',
            'team_leader', 'team_leader_name', 'created_by_name',
            'overall_deadline', 'created_at',
            'documents_total', 'documents_submitted',
        ]


# ─────────────────────────────────────────────────────────────
# Engagement — Detail (full)
# ─────────────────────────────────────────────────────────────

class EngagementDetailSerializer(serializers.ModelSerializer):
    entity_name             = serializers.CharField(source='entity.name', read_only=True)
    team_leader_name        = serializers.CharField(source='team_leader.full_name', read_only=True)
    created_by_name         = serializers.CharField(source='created_by.full_name', read_only=True)
    locked_by_name          = serializers.CharField(
        source='locked_by.full_name', read_only=True, default=None
    )
    status_display          = serializers.CharField(source='get_status_display', read_only=True)
    framework_display       = serializers.CharField(
        source='get_reporting_framework_display', read_only=True
    )
    lead_type_display       = serializers.CharField(source='get_lead_type_display', read_only=True)
    responsible_person_name = serializers.CharField(
        source='responsible_person.full_name', read_only=True, default=None
    )
    team_members            = EngagementTeamSerializer(many=True, read_only=True)
    document_assignments    = DocumentAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model  = Engagement
        fields = [
            'id', 'engagement_code', 'entity', 'entity_name',
            'audit_year', 'audit_period_start', 'audit_period_end',
            'reporting_framework', 'framework_display', 'reporting_currency',
            'status', 'status_display',
            'lead_type', 'lead_type_display',
            'created_by', 'created_by_name',
            'responsible_person', 'responsible_person_name',
            'team_leader', 'team_leader_name',
            'overall_deadline', 'submitted_to_cea_at',
            'locked_at', 'locked_by', 'locked_by_name',
            'archived_at', 'created_at',
            'team_members', 'document_assignments',
        ]
        read_only_fields = [
            'id', 'engagement_code', 'created_by', 'created_at',
            'submitted_to_cea_at', 'locked_at', 'locked_by', 'archived_at',
        ]


# ─────────────────────────────────────────────────────────────
# Engagement — Create (Admin or DAG creates, assigns responsible person and TL)
# ─────────────────────────────────────────────────────────────

class EngagementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Engagement
        fields = [
            'entity', 'audit_year', 'audit_period_start', 'audit_period_end',
            'reporting_framework', 'reporting_currency',
            'lead_type', 'responsible_person',
            'team_leader', 'overall_deadline',
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        engagement = Engagement.objects.create(**validated_data)

        # Auto-add team leader and CEA (creator) as team members
        EngagementTeam.objects.get_or_create(
            engagement=engagement,
            user=engagement.team_leader,
            defaults={
                'engagement_role': EngagementTeam.ROLE_TEAM_LEADER,
                'added_by': request.user if request else None,
            }
        )
        if request and request.user != engagement.team_leader:
            EngagementTeam.objects.get_or_create(
                engagement=engagement,
                user=request.user,
                defaults={
                    'engagement_role': EngagementTeam.ROLE_CEA,
                    'added_by': request.user,
                }
            )
        return engagement
