"""
Reviews app models — ReviewPackage, ReviewAction, DocumentReviewFlag, TLDocumentReview
"""

from django.db import models
from django.conf import settings


class ReviewPackage(models.Model):
    """Created when TL submits full package for CEA+ review."""

    STATUS_PENDING  = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_RETURNED = 'returned'
    STATUS_LOCKED   = 'locked'

    STATUS_CHOICES = [
        (STATUS_PENDING,  'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_RETURNED, 'Returned'),
        (STATUS_LOCKED,   'Locked'),
    ]

    engagement      = models.ForeignKey(
        'engagements.Engagement', on_delete=models.CASCADE, related_name='review_packages'
    )
    package_version = models.IntegerField(default=1)  # increments each resubmission
    submitted_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='submitted_packages'
    )
    submitted_at    = models.DateTimeField(auto_now_add=True)
    # 2=TL, 3=CEA, 4=AAG, 5=DAG, 6=TSSU
    current_level   = models.IntegerField()
    status          = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    completed_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return (
            f"{self.engagement.engagement_code} "
            f"v{self.package_version} — level {self.current_level} ({self.status})"
        )


class ReviewAction(models.Model):
    """Each approval, return, or comment by a reviewer."""

    ACTION_APPROVE = 'approve'
    ACTION_RETURN  = 'return'
    ACTION_COMMENT = 'comment'

    ACTION_CHOICES = [
        (ACTION_APPROVE, 'Approve'),
        (ACTION_RETURN,  'Return'),
        (ACTION_COMMENT, 'Comment'),
    ]

    package           = models.ForeignKey(
        ReviewPackage, on_delete=models.CASCADE, related_name='actions'
    )
    reviewer          = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='review_actions'
    )
    action            = models.CharField(max_length=10, choices=ACTION_CHOICES)
    returned_to_level = models.IntegerField(null=True, blank=True)  # if returning
    general_comment   = models.TextField(blank=True)
    acted_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-acted_at']

    def __str__(self):
        return (
            f"{self.reviewer.full_name} — {self.action} "
            f"on {self.package}"
        )


class DocumentReviewFlag(models.Model):
    """Which documents are flagged within a package review."""

    package       = models.ForeignKey(
        ReviewPackage, on_delete=models.CASCADE, related_name='document_flags'
    )
    document_type = models.CharField(max_length=20)  # 'UE1', 'UE2', etc.
    is_flagged    = models.BooleanField(default=False)
    flag_comment  = models.TextField(blank=True)
    flagged_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name='document_flags'
    )
    flagged_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['document_type']
        unique_together = ('package', 'document_type')

    def __str__(self):
        return f"{self.document_type} flagged on {self.package}"


class TLDocumentReview(models.Model):
    """TL document-by-document review (before package goes to CEA)."""

    ACTION_APPROVE = 'approve'
    ACTION_RETURN  = 'return'
    ACTION_COMMENT = 'comment'

    ACTION_CHOICES = [
        (ACTION_APPROVE, 'Approve'),
        (ACTION_RETURN,  'Return'),
        (ACTION_COMMENT, 'Comment'),
    ]

    engagement    = models.ForeignKey(
        'engagements.Engagement', on_delete=models.CASCADE,
        related_name='tl_document_reviews'
    )
    document_type = models.CharField(max_length=20)
    reviewer      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='tl_document_reviews'
    )
    action        = models.CharField(max_length=10, choices=ACTION_CHOICES)
    comment       = models.TextField(blank=True)
    acted_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-acted_at']

    def __str__(self):
        return (
            f"TL review: {self.document_type} "
            f"by {self.reviewer.full_name} — {self.action}"
        )
