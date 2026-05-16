"""
Exports app models — ExportSettings, ExportPackage, TeamMateUploadChecklist
"""

from django.db import models
from django.conf import settings
from engagements.models import Engagement


class ExportSettings(models.Model):
    """Admin-configurable export settings (singleton)."""
    naming_pattern = models.CharField(
        max_length=200,
        default='[EngagementCode]_[WorkpaperRef]_[EntityName]_[Year]'
    )
    excel_password = models.CharField(
        max_length=100, blank=True,
        help_text='Password to protect exported Excel files. Leave blank for no protection.'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='export_settings_updates'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Export Settings'
        verbose_name_plural = 'Export Settings'

    def __str__(self):
        return 'Export Settings'


class ExportPackage(models.Model):
    """Tracks generated export packages."""
    STATUS_GENERATING = 'generating'
    STATUS_READY      = 'ready'
    STATUS_ERROR      = 'error'

    STATUS_CHOICES = [
        (STATUS_GENERATING, 'Generating'),
        (STATUS_READY,      'Ready'),
        (STATUS_ERROR,      'Error'),
    ]

    engagement   = models.ForeignKey(
        Engagement, on_delete=models.CASCADE, related_name='export_packages'
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='generated_export_packages'
    )
    package_path = models.CharField(max_length=500, blank=True)
    total_files  = models.IntegerField(default=0)
    status       = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_GENERATING
    )
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"Package {self.id} — {self.engagement.engagement_code} ({self.status})"


class TeamMateUploadChecklist(models.Model):
    """Tracks which files have been uploaded to TeamMate+."""
    export_package = models.ForeignKey(
        ExportPackage, on_delete=models.CASCADE, related_name='checklist_items'
    )
    document_type = models.CharField(max_length=20)
    file_name     = models.CharField(max_length=255)
    teammate_ref  = models.CharField(max_length=100, blank=True)
    uploaded      = models.BooleanField(default=False)
    uploaded_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='teammate_uploads'
    )
    uploaded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['document_type', 'file_name']

    def __str__(self):
        status = 'Uploaded' if self.uploaded else 'Pending'
        return f"{self.file_name} ({status})"
