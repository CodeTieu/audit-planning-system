from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'recipient', 'notification_type', 'tier',
        'title', 'is_read', 'email_sent', 'created_at'
    ]
    list_filter = ['notification_type', 'tier', 'is_read', 'email_sent']
    search_fields = ['recipient__full_name', 'title', 'message']
    readonly_fields = ['created_at']
