"""
Risks app models — Risk register, auto-populated from workpaper answers.
"""

from django.db import models
from django.conf import settings
from django.contrib.postgres.fields import ArrayField


class Risk(models.Model):
    SEVERITY_LOW           = 'Low'
    SEVERITY_MEDIUM        = 'Medium'
    SEVERITY_HIGH          = 'High'
    SEVERITY_HIGH_PERVASIVE = 'High-Pervasive'

    SEVERITY_CHOICES = [
        (SEVERITY_LOW,            'Low'),
        (SEVERITY_MEDIUM,         'Medium'),
        (SEVERITY_HIGH,           'High'),
        (SEVERITY_HIGH_PERVASIVE, 'High-Pervasive'),
    ]

    STATUS_ACTIVE    = 'active'
    STATUS_ADDRESSED = 'addressed'
    STATUS_DISMISSED = 'dismissed'

    STATUS_CHOICES = [
        (STATUS_ACTIVE,    'Active'),
        (STATUS_ADDRESSED, 'Addressed'),
        (STATUS_DISMISSED, 'Dismissed'),
    ]

    engagement         = models.ForeignKey(
        'engagements.Engagement', on_delete=models.CASCADE, related_name='risks'
    )
    workpaper          = models.ForeignKey(
        'workpapers.Workpaper', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='triggered_risks'
    )
    source_document    = models.CharField(max_length=20)
    source_section     = models.CharField(max_length=50)
    trigger_question   = models.TextField()
    trigger_answer     = models.CharField(max_length=20)
    risk_no            = models.CharField(max_length=20, unique=True, editable=False)
    inherent_risk_factor = models.TextField(blank=True)
    risk_description   = models.TextField()
    assertions         = ArrayField(
        models.CharField(max_length=50), default=list, blank=True
    )
    is_cotabd_specific = models.BooleanField(default=False)
    is_pervasive       = models.BooleanField(default=False)
    severity           = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    cotabd             = models.CharField(max_length=100, blank=True)
    status             = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default=STATUS_ACTIVE
    )
    dismissed_at       = models.DateTimeField(null=True, blank=True)
    dismissed_by       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='dismissed_risks'
    )
    dismissal_reason   = models.TextField(blank=True)
    from_library       = models.BooleanField(default=False)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.risk_no} — {self.risk_description[:60]}"

    def save(self, *args, **kwargs):
        if not self.risk_no:
            self.risk_no = self._generate_risk_no()
        super().save(*args, **kwargs)

    def _generate_risk_no(self):
        """Auto-generate RISK-NNN scoped to engagement."""
        count = Risk.objects.filter(engagement=self.engagement).count() + 1
        base = f"RISK-{count:03d}"
        # Ensure uniqueness across all engagements (global unique constraint on risk_no)
        while Risk.objects.filter(risk_no=base).exists():
            count += 1
            base = f"RISK-{count:03d}"
        return base
