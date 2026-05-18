from rest_framework import serializers
from .models import Lookup, LookupCategory


class LookupSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)

    class Meta:
        model  = Lookup
        fields = ['id', 'value', 'label', 'display_label',
                  'extra', 'display_order', 'is_active']


class LookupCategorySerializer(serializers.ModelSerializer):
    values = LookupSerializer(many=True, read_only=True)

    class Meta:
        model  = LookupCategory
        fields = ['id', 'code', 'name', 'description', 'is_active', 'values']
