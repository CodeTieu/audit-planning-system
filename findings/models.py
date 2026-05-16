"""
Findings app models — Finding, FindingRiskLink
"""

from django.db import models
from django.conf import settings


class Finding(models.Model):
    STATUS_DRAFT     = 'draft'
    STATUS_SUBMITTED = 'submitted'
    STATUS_REVIEWED  = 'reviewed'
    STATUS_DISMISSED = 'dismissed'
    STATUS_FINALIZED = 'finalized'
    STATUS_CHOICES = [(s, s.title()) for s in [
        'draft', 'submitted', 'reviewed', 'dismissed', 'finalized'
    ]]

    engagement       = models.ForeignKey(
        'engagements.Engagement', on_delete=models.CASCADE, related_name='findings'
    )
    finding_ref      = models.CharField(max_length=20, editable=False)  # auto FIND-001
    title            = models.CharField(max_length=300)
    criteria         = models.TextField(blank=True)
    finding_body     = models.TextField(blank=True)
    cause            = models.TextField(blank=True)
    implication      = models.TextField(blank=True)
    recommendation   = models.TextField(blank=True)
    status           = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='draft'
    )
    dismissed_at     = models.DateTimeField(null=True, blank=True)
    dismissed_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='dismissed_findings'
    )
    dismissal_reason = models.TextField(blank=True)
    created_by       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_findings'
    )
    created_at       = models.DateTimeField(auto_now_add=True)
    last_updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['finding_ref']

    def __str__(self):
        return f"{self.finding_ref} — {self.title[:60]}"

    def save(self, *args, **kwargs):
        if not self.finding_ref:
            # Auto-generate: FIND-001, FIND-002, etc.
            count = Finding.objects.filter(engagement=self.engagement).count()
            self.finding_ref = f'FIND-{count + 1:03d}'
        super().save(*args, **kwargs)


class FindingRiskLink(models.Model):
    finding   = models.ForeignKey(
        Finding, on_delete=models.CASCADE, related_name='risk_links'
    )
    risk      = models.ForeignKey(
        'risks.Risk', on_delete=models.CASCADE, related_name='finding_links'
    )
    linked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='finding_risk_links'
    )
    linked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('finding', 'risk')

    def __str__(self):
        return f"{self.finding.finding_ref} ↔ {self.risk.risk_no}"
