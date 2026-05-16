"""
Workpapers app serializers.
"""

from rest_framework import serializers
from .models import Workpaper, WorkpaperVersion, WorkpaperAttachment
from engagements.models import DocumentType
from risks.models import Risk


# ─────────────────────────────────────────────────────────────
# WORKPAPER SERIALIZERS
# ─────────────────────────────────────────────────────────────

class WorkpaperLightSerializer(serializers.ModelSerializer):
    """Lightweight — excludes form_data. Used for list views."""
    # Accept code string OR integer PK on write; return code on read
    document_type = serializers.SlugRelatedField(
        slug_field='code',
        queryset=DocumentType.objects.all()
    )
    document_type_name = serializers.CharField(
        source='document_type.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    last_updated_by_name = serializers.CharField(
        source='last_updated_by.full_name', read_only=True
    )

    class Meta:
        model = Workpaper
        fields = [
            'id', 'engagement', 'document_type', 'document_type_name',
            'version', 'status',
            'created_by', 'created_by_name',
            'last_updated_by', 'last_updated_by_name',
            'last_updated_at', 'submitted_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'version', 'last_updated_at', 'submitted_at', 'created_at',
            'document_type_name', 'created_by_name', 'last_updated_by_name',
        ]


class WorkpaperSerializer(serializers.ModelSerializer):
    """Full serializer including form_data."""
    # Accept code string on write; return code on read
    document_type = serializers.SlugRelatedField(
        slug_field='code',
        queryset=DocumentType.objects.all()
    )
    document_type_name = serializers.CharField(
        source='document_type.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )
    last_updated_by_name = serializers.CharField(
        source='last_updated_by.full_name', read_only=True
    )

    class Meta:
        model = Workpaper
        fields = [
            'id', 'engagement', 'document_type', 'document_type_name',
            'version', 'form_data', 'status',
            'created_by', 'created_by_name',
            'last_updated_by', 'last_updated_by_name',
            'last_updated_at', 'submitted_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'version', 'status', 'last_updated_at', 'submitted_at', 'created_at',
            'document_type_name', 'created_by', 'created_by_name',
            'last_updated_by', 'last_updated_by_name',
        ]


# ─────────────────────────────────────────────────────────────
# WORKPAPER VERSION SERIALIZER
# ─────────────────────────────────────────────────────────────

class WorkpaperVersionSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(
        source='changed_by.full_name', read_only=True
    )

    class Meta:
        model = WorkpaperVersion
        fields = [
            'id', 'workpaper', 'version', 'form_data',
            'changed_by', 'changed_by_name',
            'changed_at', 'change_type', 'change_summary',
        ]
        read_only_fields = ['id', 'changed_at', 'changed_by_name']


# ─────────────────────────────────────────────────────────────
# WORKPAPER ATTACHMENT SERIALIZER
# ─────────────────────────────────────────────────────────────

class WorkpaperAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.full_name', read_only=True
    )
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = WorkpaperAttachment
        fields = [
            'id', 'workpaper', 'question_ref', 'file_name',
            'file', 'file_url', 'file_type', 'file_size_kb',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at', 'description',
        ]
        read_only_fields = [
            'id', 'uploaded_at', 'uploaded_by_name', 'file_url',
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


# ─────────────────────────────────────────────────────────────
# RISK SERIALIZERS
# ─────────────────────────────────────────────────────────────

class RiskSerializer(serializers.ModelSerializer):
    dismissed_by_name = serializers.CharField(
        source='dismissed_by.full_name', read_only=True, default=None
    )
    severity_display = serializers.CharField(
        source='get_severity_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = Risk
        fields = [
            'id', 'engagement', 'workpaper', 'source_document', 'source_section',
            'trigger_question', 'trigger_answer', 'risk_no',
            'inherent_risk_factor', 'risk_description', 'assertions',
            'is_cotabd_specific', 'is_pervasive', 'severity', 'severity_display',
            'cotabd', 'status', 'status_display',
            'dismissed_at', 'dismissed_by', 'dismissed_by_name', 'dismissal_reason',
            'from_library', 'created_at',
        ]
        read_only_fields = [
            'id', 'risk_no', 'created_at',
            'dismissed_by_name', 'severity_display', 'status_display',
        ]


class RiskLightSerializer(serializers.ModelSerializer):
    """Lightweight risk serializer for summary views."""
    severity_display = serializers.CharField(
        source='get_severity_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = Risk
        fields = [
            'id', 'risk_no', 'source_document', 'risk_description',
            'severity', 'severity_display', 'is_pervasive',
            'status', 'status_display', 'created_at',
        ]
        read_only_fields = fields
