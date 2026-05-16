"""
Reviews app serializers.
"""

from rest_framework import serializers

from .models import (
    ReviewPackage,
    ReviewAction,
    DocumentReviewFlag,
    TLDocumentReview,
)


# ─────────────────────────────────────────────────────────────
# NESTED / SIMPLE
# ─────────────────────────────────────────────────────────────

class ReviewActionSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(
        source='reviewer.full_name', read_only=True
    )
    reviewer_role = serializers.IntegerField(
        source='reviewer.primary_role', read_only=True
    )

    class Meta:
        model = ReviewAction
        fields = [
            'id', 'package', 'reviewer', 'reviewer_name', 'reviewer_role',
            'action', 'returned_to_level', 'general_comment', 'acted_at',
        ]
        read_only_fields = ['id', 'acted_at']


class DocumentReviewFlagSerializer(serializers.ModelSerializer):
    flagged_by_name = serializers.CharField(
        source='flagged_by.full_name', read_only=True
    )

    class Meta:
        model = DocumentReviewFlag
        fields = [
            'id', 'package', 'document_type', 'is_flagged',
            'flag_comment', 'flagged_by', 'flagged_by_name', 'flagged_at',
        ]
        read_only_fields = ['id']


class TLDocumentReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(
        source='reviewer.full_name', read_only=True
    )

    class Meta:
        model = TLDocumentReview
        fields = [
            'id', 'engagement', 'document_type', 'reviewer',
            'reviewer_name', 'action', 'comment', 'acted_at',
        ]
        read_only_fields = ['id', 'acted_at']


# ─────────────────────────────────────────────────────────────
# PACKAGE — LIGHT (list view)
# ─────────────────────────────────────────────────────────────

class ReviewPackageLightSerializer(serializers.ModelSerializer):
    engagement_code = serializers.CharField(
        source='engagement.engagement_code', read_only=True
    )
    submitted_by_name = serializers.CharField(
        source='submitted_by.full_name', read_only=True
    )

    class Meta:
        model = ReviewPackage
        fields = [
            'id', 'engagement', 'engagement_code', 'package_version',
            'submitted_by', 'submitted_by_name', 'submitted_at',
            'current_level', 'status', 'completed_at',
        ]


# ─────────────────────────────────────────────────────────────
# PACKAGE — FULL (detail view: includes actions + flags)
# ─────────────────────────────────────────────────────────────

class ReviewPackageSerializer(serializers.ModelSerializer):
    engagement_code = serializers.CharField(
        source='engagement.engagement_code', read_only=True
    )
    submitted_by_name = serializers.CharField(
        source='submitted_by.full_name', read_only=True
    )
    actions      = ReviewActionSerializer(many=True, read_only=True)
    document_flags = DocumentReviewFlagSerializer(many=True, read_only=True)

    class Meta:
        model = ReviewPackage
        fields = [
            'id', 'engagement', 'engagement_code', 'package_version',
            'submitted_by', 'submitted_by_name', 'submitted_at',
            'current_level', 'status', 'completed_at',
            'actions', 'document_flags',
        ]
