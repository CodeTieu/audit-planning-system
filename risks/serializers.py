"""Risks app serializers."""

from rest_framework import serializers
from .models import Risk


class RiskLightSerializer(serializers.ModelSerializer):
    """Compact risk — for lists and inline banners."""
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display   = serializers.CharField(source='get_status_display',   read_only=True)
    dismissed_by_name = serializers.CharField(
        source='dismissed_by.full_name', read_only=True, default=None
    )

    class Meta:
        model  = Risk
        fields = [
            'id', 'risk_no', 'source_document', 'source_section',
            'risk_description', 'severity', 'severity_display',
            'is_pervasive', 'is_cotabd_specific', 'cotabd',
            'status', 'status_display',
            'dismissed_at', 'dismissed_by_name', 'dismissal_reason',
            'trigger_question', 'trigger_answer',
            'created_at',
        ]


class RiskSerializer(RiskLightSerializer):
    """Full risk detail."""
    class Meta(RiskLightSerializer.Meta):
        fields = RiskLightSerializer.Meta.fields + [
            'engagement', 'workpaper',
            'inherent_risk_factor', 'assertions',
        ]
