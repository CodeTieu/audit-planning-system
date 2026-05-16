from django.contrib import admin
from .models import Workpaper, WorkpaperVersion, WorkpaperAttachment


@admin.register(Workpaper)
class WorkpaperAdmin(admin.ModelAdmin):
    list_display = ['id', 'engagement', 'document_type', 'version', 'status', 'last_updated_at']
    list_filter = ['status', 'document_type']
    search_fields = ['engagement__engagement_code', 'document_type__code']
    readonly_fields = ['version', 'last_updated_at', 'submitted_at', 'created_at']


@admin.register(WorkpaperVersion)
class WorkpaperVersionAdmin(admin.ModelAdmin):
    list_display = ['id', 'workpaper', 'version', 'change_type', 'changed_by', 'changed_at']
    list_filter = ['change_type']
    readonly_fields = ['changed_at']


@admin.register(WorkpaperAttachment)
class WorkpaperAttachmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'workpaper', 'file_name', 'file_type', 'file_size_kb', 'uploaded_by', 'uploaded_at']
    readonly_fields = ['uploaded_at']
