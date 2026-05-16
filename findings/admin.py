from django.contrib import admin
from .models import Finding, FindingRiskLink


@admin.register(Finding)
class FindingAdmin(admin.ModelAdmin):
    list_display  = ['finding_ref', 'engagement', 'title', 'status', 'created_at']
    list_filter   = ['status', 'engagement']
    search_fields = ['finding_ref', 'title']
    readonly_fields = ['finding_ref', 'created_at', 'last_updated_at']


@admin.register(FindingRiskLink)
class FindingRiskLinkAdmin(admin.ModelAdmin):
    list_display  = ['finding', 'risk', 'linked_by', 'linked_at']
    list_filter   = ['finding__engagement']
