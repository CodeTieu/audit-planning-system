"""
Audit Trail — AuditLog model for recording all write operations.
"""

from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    ACTION_POST   = 'POST'
    ACTION_PUT    = 'PUT'
    ACTION_PATCH  = 'PATCH'
    ACTION_DELETE = 'DELETE'

    ACTION_CHOICES = [
        (ACTION_POST,   'Create'),
        (ACTION_PUT,    'Replace'),
        (ACTION_PATCH,  'Update'),
        (ACTION_DELETE, 'Delete'),
    ]

    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_logs'
    )
    action       = models.CharField(max_length=10, choices=ACTION_CHOICES)
    table_name   = models.CharField(
        max_length=100,
        help_text='Derived from the request URL path (app/resource name).'
    )
    record_id    = models.CharField(
        max_length=50, blank=True,
        help_text='Primary key extracted from the URL, if present.'
    )
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    request_body = models.JSONField(
        null=True, blank=True,
        help_text='Sanitised request payload (passwords redacted).'
    )
    timestamp    = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Audit Log'

    def __str__(self):
        user_str = self.user.username if self.user else 'anonymous'
        return f"{self.timestamp} | {self.action} {self.table_name}:{self.record_id} by {user_str}"
