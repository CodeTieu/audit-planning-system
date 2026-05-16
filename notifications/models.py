"""
Notifications app models — system notifications for audit workflow events.
"""

from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_SUBMISSION      = 'submission'
    TYPE_APPROVAL        = 'approval'
    TYPE_REJECTION       = 'rejection'
    TYPE_DEADLINE_WARNING = 'deadline_warning'
    TYPE_COMMENT         = 'comment'

    TYPE_CHOICES = [
        (TYPE_SUBMISSION,       'Submission'),
        (TYPE_APPROVAL,         'Approval'),
        (TYPE_REJECTION,        'Rejection'),
        (TYPE_DEADLINE_WARNING, 'Deadline Warning'),
        (TYPE_COMMENT,          'Comment'),
    ]

    TIER_CRITICAL = 'critical'
    TIER_STANDARD = 'standard'

    TIER_CHOICES = [
        (TIER_CRITICAL, 'Critical'),
        (TIER_STANDARD, 'Standard'),
    ]

    recipient         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    tier              = models.CharField(
        max_length=10, choices=TIER_CHOICES, default=TIER_STANDARD
    )
    title             = models.CharField(max_length=200)
    message           = models.TextField()
    engagement        = models.ForeignKey(
        'engagements.Engagement', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notifications'
    )
    document_type     = models.CharField(max_length=20, blank=True)
    is_read           = models.BooleanField(default=False)
    email_sent        = models.BooleanField(default=False)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_tier_display()}] {self.title} → {self.recipient.full_name}"
