"""
Findings app serializers.
"""

from rest_framework import serializers
from .models import Finding, FindingRiskLink
from risks.models import Risk


# ─────────────────────────────────────────────────────────────
# RISK INLINE (used inside FindingDetailSerializer)
# ─────────────────────────────────────────────────────────────

class LinkedRiskSerializer(serializers.Serializer):
    """Compact risk info for embedding in finding detail."""
    id               = serializers.IntegerField(source='risk.id')
    risk_no          = serializers.CharField(source='risk.risk_no')
    risk_description = serializers.CharField(source='risk.risk_description')
    severity         = serializers.CharField(source='risk.severity')


# ─────────────────────────────────────────────────────────────
# FINDING LIGHT
# ─────────────────────────────────────────────────────────────

class FindingLightSerializer(serializers.ModelSerializer):
    linked_risk_count = serializers.SerializerMethodField()

    class Meta:
        model  = Finding
        fields = [
            'id', 'finding_ref', 'title', 'status',
            'created_at', 'linked_risk_count',
        ]

    def get_linked_risk_count(self, obj):
        return obj.risk_links.count()


# ─────────────────────────────────────────────────────────────
# FINDING DETAIL
# ─────────────────────────────────────────────────────────────

class FindingDetailSerializer(serializers.ModelSerializer):
    linked_risks      = LinkedRiskSerializer(source='risk_links', many=True, read_only=True)
    created_by_name   = serializers.CharField(
        source='created_by.full_name', read_only=True, default=None
    )
    dismissed_by_name = serializers.CharField(
        source='dismissed_by.full_name', read_only=True, default=None
    )

    class Meta:
        model  = Finding
        fields = [
            'id', 'finding_ref', 'engagement',
            'title', 'criteria', 'finding_body', 'cause',
            'implication', 'recommendation',
            'status',
            'dismissed_at', 'dismissed_by', 'dismissed_by_name', 'dismissal_reason',
            'created_by', 'created_by_name', 'created_at', 'last_updated_at',
            'linked_risks',
        ]
        read_only_fields = ['finding_ref', 'created_at', 'last_updated_at']


# ─────────────────────────────────────────────────────────────
# FINDING CREATE
# ─────────────────────────────────────────────────────────────

class FindingCreateSerializer(serializers.ModelSerializer):
    initial_risk_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        default=list,
    )

    class Meta:
        model  = Finding
        fields = [
            'engagement',
            'title', 'criteria', 'finding_body', 'cause',
            'implication', 'recommendation',
            'initial_risk_ids',
        ]

    def validate_initial_risk_ids(self, value):
        if value:
            existing = set(
                Risk.objects.filter(id__in=value).values_list('id', flat=True)
            )
            missing = set(value) - existing
            if missing:
                raise serializers.ValidationError(
                    f"Risk IDs not found: {sorted(missing)}"
                )
        return value

    def create(self, validated_data):
        initial_risk_ids = validated_data.pop('initial_risk_ids', [])
        request = self.context.get('request')
        finding = Finding.objects.create(
            created_by=request.user if request else None,
            **validated_data,
        )
        for risk_id in initial_risk_ids:
            FindingRiskLink.objects.create(
                finding=finding,
                risk_id=risk_id,
                linked_by=request.user if request else None,
            )
        return finding
