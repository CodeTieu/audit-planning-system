from django.contrib import admin
from .models import ReviewPackage, ReviewAction, DocumentReviewFlag, TLDocumentReview


class ReviewActionInline(admin.TabularInline):
    model           = ReviewAction
    extra           = 0
    fields          = ('reviewer', 'action', 'returned_to_level', 'general_comment', 'acted_at')
    readonly_fields = ('acted_at',)
    raw_id_fields   = ('reviewer',)
    ordering        = ('acted_at',)


class DocumentReviewFlagInline(admin.TabularInline):
    model           = DocumentReviewFlag
    extra           = 0
    fields          = ('document_type', 'is_flagged', 'flag_comment', 'flagged_by', 'flagged_at')
    readonly_fields = ('flagged_at',)
    raw_id_fields   = ('flagged_by',)


@admin.register(ReviewPackage)
class ReviewPackageAdmin(admin.ModelAdmin):
    list_display    = (
        'id', 'engagement', 'package_version', 'status',
        'current_level', 'submitted_by', 'submitted_at', 'completed_at',
    )
    list_filter     = ('status', 'current_level')
    search_fields   = ('engagement__engagement_code',)
    readonly_fields = ('submitted_at', 'completed_at')
    raw_id_fields   = ('engagement', 'submitted_by')
    inlines         = [ReviewActionInline, DocumentReviewFlagInline]
    ordering        = ('-submitted_at',)


@admin.register(ReviewAction)
class ReviewActionAdmin(admin.ModelAdmin):
    list_display    = (
        'package', 'reviewer', 'action', 'returned_to_level', 'acted_at',
    )
    list_filter     = ('action', 'returned_to_level')
    search_fields   = ('package__engagement__engagement_code', 'reviewer__full_name')
    readonly_fields = ('acted_at',)
    raw_id_fields   = ('package', 'reviewer')


@admin.register(DocumentReviewFlag)
class DocumentReviewFlagAdmin(admin.ModelAdmin):
    list_display    = (
        'package', 'document_type', 'is_flagged', 'flagged_by', 'flagged_at',
    )
    list_filter     = ('is_flagged',)
    search_fields   = ('package__engagement__engagement_code', 'document_type')
    readonly_fields = ('flagged_at',)
    raw_id_fields   = ('package', 'flagged_by')


@admin.register(TLDocumentReview)
class TLDocumentReviewAdmin(admin.ModelAdmin):
    list_display    = (
        'engagement', 'document_type', 'reviewer', 'action', 'acted_at',
    )
    list_filter     = ('action',)
    search_fields   = ('engagement__engagement_code', 'document_type')
    readonly_fields = ('acted_at',)
    raw_id_fields   = ('engagement', 'reviewer')
    ordering        = ('-acted_at',)
