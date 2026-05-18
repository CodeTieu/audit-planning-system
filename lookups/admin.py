from django.contrib import admin
from .models import Lookup, LookupCategory


class LookupInline(admin.TabularInline):
    model  = Lookup
    extra  = 0
    fields = ('value', 'display_label', 'display_order', 'is_active', 'extra')


@admin.register(LookupCategory)
class LookupCategoryAdmin(admin.ModelAdmin):
    list_display  = ('code', 'name', 'is_active', 'created_at')
    list_filter   = ('is_active',)
    search_fields = ('code', 'name')
    inlines       = [LookupInline]


@admin.register(Lookup)
class LookupAdmin(admin.ModelAdmin):
    list_display  = ('category', 'value', 'display_label', 'display_order', 'is_active')
    list_filter   = ('category', 'is_active')
    search_fields = ('value', 'display_label')
    list_select_related = ('category',)
