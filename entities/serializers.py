"""
Entities app serializers
"""

from rest_framework import serializers
from .models import EntityType, Entity


class EntityTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EntityType
        fields = ['id', 'name', 'code', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class EntityListSerializer(serializers.ModelSerializer):
    """Compact serializer for dropdown lists and table views."""
    entity_type_name = serializers.CharField(source='entity_type.name', read_only=True)

    class Meta:
        model  = Entity
        fields = ['id', 'name', 'code', 'entity_type_name', 'is_active']


class EntityDetailSerializer(serializers.ModelSerializer):
    """Full serializer with all fields."""
    entity_type_name = serializers.CharField(source='entity_type.name', read_only=True)
    division_name    = serializers.CharField(source='division.name', read_only=True)
    created_by_name  = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model  = Entity
        fields = [
            'id', 'name', 'entity_type', 'entity_type_name', 'code',
            'physical_address', 'postal_address', 'phone', 'email',
            'division', 'division_name', 'contact_person', 'contact_title',
            'is_active', 'created_at', 'created_by', 'created_by_name',
        ]
        read_only_fields = ['id', 'created_at', 'created_by']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)
