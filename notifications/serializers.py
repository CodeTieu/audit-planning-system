"""
Notifications serializers.
"""

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(
        source='recipient.full_name', read_only=True
    )
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', read_only=True
    )
    tier_display = serializers.CharField(
        source='get_tier_display', read_only=True
    )

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_name',
            'notification_type', 'notification_type_display',
            'tier', 'tier_display',
            'title', 'message', 'engagement', 'document_type',
            'is_read', 'email_sent', 'created_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'recipient_name',
            'notification_type_display', 'tier_display',
        ]
