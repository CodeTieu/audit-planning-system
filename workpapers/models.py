"""
Workpapers app models — Workpaper, WorkpaperVersion, WorkpaperAttachment
"""

from django.db import models
from django.conf import settings


class Workpaper(models.Model):
    STATUS_DRAFT       = 'draft'
    STATUS_SUBMITTED   = 'submitted'
    STATUS_TL_APPROVED = 'tl_approved'
    STATUS_IN_REVIEW   = 'in_review'
    STATUS_RETURNED    = 'returned'
    STATUS_FINALIZED   = 'finalized'

    STATUS_CHOICES = [
        (STATUS_DRAFT,       'Draft'),
        (STATUS_SUBMITTED,   'Submitted'),
        (STATUS_TL_APPROVED, 'TL Approved'),
        (STATUS_IN_REVIEW,   'In Review'),
        (STATUS_RETURNED,    'Returned'),
        (STATUS_FINALIZED,   'Finalized'),
    ]

    engagement       = models.ForeignKey(
        'engagements.Engagement', on_delete=models.CASCADE, related_name='workpapers'
    )
    document_type    = models.ForeignKey(
        'engagements.DocumentType', on_delete=models.PROTECT, related_name='workpapers'
    )
    version          = models.IntegerField(default=1)
    form_data        = models.JSONField(default=dict)
    status           = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )
    created_by       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='created_workpapers'
    )
    last_updated_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='updated_workpapers'
    )
    last_updated_at  = models.DateTimeField(auto_now=True)
    submitted_at     = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('engagement', 'document_type')
        ordering = ['document_type__sequence_order']

    def __str__(self):
        return (
            f"{self.document_type.code} / {self.engagement.engagement_code} "
            f"(v{self.version}) — {self.get_status_display()}"
        )


class WorkpaperVersion(models.Model):
    CHANGE_AUTOSAVE       = 'autosave'
    CHANGE_MANUAL_SAVE    = 'manual_save'
    CHANGE_SUBMISSION     = 'submission'
    CHANGE_REVIEWER_EDIT  = 'reviewer_edit'
    CHANGE_RETURN         = 'return'

    CHANGE_TYPE_CHOICES = [
        (CHANGE_AUTOSAVE,      'Auto Save'),
        (CHANGE_MANUAL_SAVE,   'Manual Save'),
        (CHANGE_SUBMISSION,    'Submission'),
        (CHANGE_REVIEWER_EDIT, 'Reviewer Edit'),
        (CHANGE_RETURN,        'Return'),
    ]

    workpaper      = models.ForeignKey(
        Workpaper, on_delete=models.CASCADE, related_name='versions'
    )
    version        = models.IntegerField()
    form_data      = models.JSONField()
    changed_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='workpaper_versions'
    )
    changed_at     = models.DateTimeField(auto_now_add=True)
    change_type    = models.CharField(
        max_length=20, choices=CHANGE_TYPE_CHOICES, default=CHANGE_AUTOSAVE
    )
    change_summary = models.TextField(blank=True)

    class Meta:
        ordering = ['-changed_at']
        unique_together = ('workpaper', 'version')

    def __str__(self):
        return (
            f"{self.workpaper} — v{self.version} "
            f"({self.get_change_type_display()}) by {self.changed_by.full_name}"
        )


class WorkpaperAttachment(models.Model):
    workpaper    = models.ForeignKey(
        Workpaper, on_delete=models.CASCADE, related_name='attachments'
    )
    question_ref = models.CharField(max_length=50, blank=True)
    file_name    = models.CharField(max_length=255)
    file         = models.FileField(upload_to='attachments/%Y/%m/')
    file_type    = models.CharField(max_length=50)
    file_size_kb = models.IntegerField()
    uploaded_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='uploaded_attachments'
    )
    uploaded_at  = models.DateTimeField(auto_now_add=True)
    description  = models.TextField(blank=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.file_name} ({self.workpaper})"
