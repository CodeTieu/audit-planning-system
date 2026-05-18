"""
Lookups app — centralised dropdown / reference data store.

A `LookupCategory` is a named group of values (e.g. "ENTITY_TYPE",
"PERSONNEL_STATUS", "FRF_OPTIONS"). A `Lookup` is a single value within
a category. Frontend dropdowns and schema-driven forms query these
endpoints instead of hardcoding option lists.
"""

from django.db import models


class LookupCategory(models.Model):
    """A named collection of dropdown values."""
    code        = models.SlugField(max_length=60, unique=True)
    name        = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']
        verbose_name_plural = 'Lookup categories'

    def __str__(self):
        return f"{self.code} — {self.name}"


class Lookup(models.Model):
    """A single value within a `LookupCategory`."""
    category      = models.ForeignKey(
        LookupCategory, on_delete=models.CASCADE, related_name='values'
    )
    value         = models.CharField(max_length=250)
    display_label = models.CharField(max_length=250, blank=True)
    extra         = models.JSONField(default=dict, blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'display_order', 'value']
        unique_together = [('category', 'value')]

    def __str__(self):
        return f"{self.category.code}: {self.value}"

    @property
    def label(self):
        return self.display_label or self.value
