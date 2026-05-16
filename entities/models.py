"""
Entities app models — EntityType and Entity
"""

from django.db import models
from django.conf import settings


class EntityType(models.Model):
    name      = models.CharField(max_length=100, unique=True)
    code      = models.CharField(max_length=20, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Entity(models.Model):
    name            = models.CharField(max_length=200)
    entity_type     = models.ForeignKey(
        EntityType, on_delete=models.PROTECT, related_name='entities'
    )
    code            = models.CharField(max_length=30, unique=True)
    physical_address = models.TextField(blank=True)
    postal_address  = models.TextField(blank=True)
    phone           = models.CharField(max_length=30, blank=True)
    email           = models.EmailField(blank=True)
    division        = models.ForeignKey(
        'users.Division', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='entities'
    )
    contact_person  = models.CharField(max_length=150, blank=True)
    contact_title   = models.CharField(max_length=100, blank=True)
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    created_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_entities'
    )
    responsible_person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='responsible_entities',
        help_text='Current responsible CEA/TL from audit universe. Used as suggestion when creating engagements.'
    )
    lead_type       = models.CharField(
        max_length=30,
        choices=[('responsible_cea', 'Responsible CEA'), ('responsible_overall_tl', 'Responsible Overall TL')],
        default='responsible_cea',
        blank=True
    )

    class Meta:
        ordering  = ['name']
        verbose_name_plural = 'entities'

    def __str__(self):
        return f"{self.name} ({self.code})"
