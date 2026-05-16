from django.contrib import admin
from .models import Entity, EntityType


@admin.register(EntityType)
class EntityTypeAdmin(admin.ModelAdmin):
    list_display  = ('name', 'code')
    search_fields = ('name', 'code')
    ordering      = ('name',)


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    list_display  = (
        'name', 'code', 'entity_type', 'division',
        'responsible_person', 'lead_type', 'is_active',
    )
    list_filter   = ('entity_type', 'lead_type', 'is_active', 'division')
    search_fields = ('name', 'code')
    ordering      = ('name',)
    raw_id_fields = ('responsible_person',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'entity_type', 'division', 'responsible_person'
        )
