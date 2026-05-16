"""
Engagements app models — Engagement, EngagementTeam, DocumentType, DocumentAssignment
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


# ─────────────────────────────────────────────────────────────
# ENGAGEMENT
# ─────────────────────────────────────────────────────────────

class Engagement(models.Model):
    STATUS_ACTIVE    = 'active'
    STATUS_COMPLETED = 'completed'
    STATUS_LOCKED    = 'locked'
    STATUS_ARCHIVED  = 'archived'

    STATUS_CHOICES = [
        (STATUS_ACTIVE,    'Active'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_LOCKED,    'Locked'),
        (STATUS_ARCHIVED,  'Archived'),
    ]

    LEAD_TYPE_CEA      = 'responsible_cea'
    LEAD_TYPE_OVERALL_TL = 'responsible_overall_tl'
    LEAD_TYPE_CHOICES = [
        ('responsible_cea',      'Responsible CEA'),
        ('responsible_overall_tl', 'Responsible Overall TL'),
    ]

    FRAMEWORK_CHOICES = [
        ('ipsas',      'IPSAS'),
        ('ifrs',       'IFRS'),
        ('ifrs_sme',   'IFRS for SMEs'),
        ('local_gaap', 'Local GAAP'),
        ('other',      'Other'),
    ]

    CURRENCY_CHOICES = [
        ('TZS', 'Tanzanian Shilling'),
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('GBP', 'British Pound'),
    ]

    entity              = models.ForeignKey(
        'entities.Entity', on_delete=models.PROTECT, related_name='engagements'
    )
    engagement_code     = models.CharField(max_length=20, unique=True, editable=False)
    audit_year          = models.PositiveIntegerField()
    audit_period_start  = models.DateField()
    audit_period_end    = models.DateField()
    reporting_framework = models.CharField(
        max_length=20, choices=FRAMEWORK_CHOICES, default='ipsas'
    )
    reporting_currency  = models.CharField(
        max_length=5, choices=CURRENCY_CHOICES, default='TZS'
    )
    status              = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default=STATUS_ACTIVE
    )

    lead_type           = models.CharField(
        max_length=30, choices=LEAD_TYPE_CHOICES, default='responsible_cea'
    )

    # People
    # Admin or DAG who created this engagement
    created_by          = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='created_engagements'
    )
    # The CEA or Overall TL assigned as responsible person
    responsible_person  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='responsible_engagements'
    )
    team_leader         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='led_engagements'
    )

    # Dates
    overall_deadline    = models.DateField(null=True, blank=True)
    submitted_to_cea_at = models.DateTimeField(null=True, blank=True)
    locked_at           = models.DateTimeField(null=True, blank=True)
    locked_by           = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='locked_engagements'
    )
    archived_at         = models.DateTimeField(null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('entity', 'audit_year')
        ordering = ['-audit_year', 'entity__name']

    def __str__(self):
        return f"{self.engagement_code} — {self.entity.name} ({self.audit_year})"

    def _generate_code(self):
        """Generate ENG-{YEAR}-{4-digit-seq} based on audit_year."""
        year = self.audit_year
        count = Engagement.objects.filter(audit_year=year).count() + 1
        return f"ENG-{year}-{count:04d}"

    def save(self, *args, **kwargs):
        if not self.engagement_code:
            # Keep trying until we find a unique code (handles race conditions)
            code = self._generate_code()
            while Engagement.objects.filter(engagement_code=code).exists():
                # Re-count and increment
                year = self.audit_year
                max_seq = (
                    Engagement.objects
                    .filter(engagement_code__startswith=f"ENG-{year}-")
                    .count()
                ) + 1
                code = f"ENG-{year}-{max_seq:04d}"
            self.engagement_code = code
        super().save(*args, **kwargs)


# ─────────────────────────────────────────────────────────────
# ENGAGEMENT TEAM
# ─────────────────────────────────────────────────────────────

class EngagementTeam(models.Model):
    ROLE_FINANCIAL_AUDITOR = 'financial_auditor'
    ROLE_IS_AUDITOR        = 'is_auditor'
    ROLE_TEAM_LEADER       = 'team_leader'
    ROLE_CEA               = 'cea'
    ROLE_OTHER             = 'other'

    ENGAGEMENT_ROLE_CHOICES = [
        (ROLE_FINANCIAL_AUDITOR, 'Financial Auditor'),
        (ROLE_IS_AUDITOR,        'IS Auditor'),
        (ROLE_TEAM_LEADER,       'Team Leader'),
        (ROLE_CEA,               'Chief External Auditor'),
        (ROLE_OTHER,             'Other'),
    ]

    engagement      = models.ForeignKey(
        Engagement, on_delete=models.CASCADE, related_name='team_members'
    )
    user            = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='engagement_memberships'
    )
    engagement_role = models.CharField(
        max_length=25, choices=ENGAGEMENT_ROLE_CHOICES, default=ROLE_FINANCIAL_AUDITOR
    )
    added_by        = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='added_team_members'
    )
    added_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('engagement', 'user')
        ordering = ['engagement_role', 'user__full_name']

    def __str__(self):
        return (
            f"{self.user.full_name} — {self.get_engagement_role_display()} "
            f"on {self.engagement.engagement_code}"
        )


# ─────────────────────────────────────────────────────────────
# DOCUMENT TYPE
# ─────────────────────────────────────────────────────────────

class DocumentType(models.Model):
    CATEGORY_PRE_ENGAGEMENT       = 'pre_engagement'
    CATEGORY_UNDERSTANDING_ENTITY = 'understanding_entity'
    CATEGORY_RISK_ASSESSMENT      = 'risk_assessment'

    CATEGORY_CHOICES = [
        (CATEGORY_PRE_ENGAGEMENT,       'Pre-Engagement'),
        (CATEGORY_UNDERSTANDING_ENTITY, 'Understanding the Entity'),
        (CATEGORY_RISK_ASSESSMENT,      'Risk Assessment'),
    ]

    code              = models.CharField(max_length=10, unique=True)
    name              = models.CharField(max_length=200)
    category          = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    sequence_order    = models.PositiveSmallIntegerField(default=0)
    # If not null: this doc is locked until the referenced doc is submitted
    unlock_after_code = models.CharField(
        max_length=10, blank=True, null=True,
        help_text='Code of the DocumentType that must be submitted before this one unlocks.'
    )
    workpaper_ref     = models.CharField(
        max_length=50, blank=True,
        help_text='TeamMate+ workpaper reference name.'
    )
    is_active         = models.BooleanField(default=True)

    class Meta:
        ordering = ['sequence_order']

    def __str__(self):
        return f"{self.code} — {self.name}"


# ─────────────────────────────────────────────────────────────
# DOCUMENT ASSIGNMENT
# ─────────────────────────────────────────────────────────────

class DocumentAssignment(models.Model):
    STATUS_NOT_STARTED = 'not_started'
    STATUS_LOCKED      = 'locked'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_SUBMITTED   = 'submitted'
    STATUS_TL_APPROVED = 'tl_approved'
    STATUS_IN_REVIEW   = 'in_review'
    STATUS_RETURNED    = 'returned'
    STATUS_FINALIZED   = 'finalized'

    STATUS_CHOICES = [
        (STATUS_NOT_STARTED, 'Not Started'),
        (STATUS_LOCKED,      'Locked'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_SUBMITTED,   'Submitted'),
        (STATUS_TL_APPROVED, 'TL Approved'),
        (STATUS_IN_REVIEW,   'In Review'),
        (STATUS_RETURNED,    'Returned'),
        (STATUS_FINALIZED,   'Finalized'),
    ]

    engagement    = models.ForeignKey(
        Engagement, on_delete=models.CASCADE, related_name='document_assignments'
    )
    document_type = models.ForeignKey(
        DocumentType, on_delete=models.PROTECT, related_name='assignments'
    )
    assigned_to   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='assigned_documents'
    )
    assigned_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='document_assignments_made'
    )
    deadline      = models.DateField(null=True, blank=True)
    status        = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default=STATUS_NOT_STARTED
    )

    submitted_at   = models.DateTimeField(null=True, blank=True)
    tl_approved_at = models.DateTimeField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('engagement', 'document_type')
        ordering = ['document_type__sequence_order']

    def __str__(self):
        return (
            f"{self.document_type.code} / {self.engagement.engagement_code} "
            f"→ {self.assigned_to.full_name}"
        )

    def save(self, *args, **kwargs):
        """
        After a document is submitted, unlock any documents that were waiting
        on this one (unlock_after_code == this document's code).
        """
        is_new_submission = False
        if self.pk:
            try:
                old = DocumentAssignment.objects.get(pk=self.pk)
                if (
                    old.status != self.STATUS_SUBMITTED
                    and self.status == self.STATUS_SUBMITTED
                ):
                    is_new_submission = True
                    if not self.submitted_at:
                        self.submitted_at = timezone.now()
            except DocumentAssignment.DoesNotExist:
                pass

        super().save(*args, **kwargs)

        if is_new_submission:
            self._unlock_dependents()

    def _unlock_dependents(self):
        """Unlock DocumentAssignments whose document_type.unlock_after_code == this code."""
        this_code = self.document_type.code
        dependents = DocumentAssignment.objects.filter(
            engagement=self.engagement,
            document_type__unlock_after_code=this_code,
            status=self.STATUS_LOCKED,
        )
        dependents.update(status=self.STATUS_NOT_STARTED)
