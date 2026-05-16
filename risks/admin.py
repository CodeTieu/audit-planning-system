from django.contrib import admin
from .models import Risk


@admin.register(Risk)
class RiskAdmin(admin.ModelAdmin):
    list_display = [
        'risk_no', 'engagement', 'source_document', 'severity',
        'is_pervasive', 'status', 'created_at'
    ]
    list_filter = ['severity', 'status', 'is_pervasive', 'source_document']
    search_fields = ['risk_no', 'risk_description', 'engagement__engagement_code']
    readonly_fields = ['risk_no', 'created_at']
