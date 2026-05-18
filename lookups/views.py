"""
Lookups app views — read endpoints for the frontend, admin CRUD via Django admin.
"""

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Lookup, LookupCategory
from .serializers import LookupCategorySerializer, LookupSerializer


class LookupCategoryListView(generics.ListAPIView):
    """GET /api/lookups/categories/  — list all active categories with values."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = LookupCategorySerializer
    pagination_class   = None

    def get_queryset(self):
        return LookupCategory.objects.filter(is_active=True).prefetch_related('values')


class LookupValuesView(APIView):
    """GET /api/lookups/?code=ENTITY_TYPE  — list values for a single category."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        code = request.query_params.get('code')
        if not code:
            return Response({'detail': 'code query param required.'}, status=400)
        values = Lookup.objects.filter(
            category__code=code, is_active=True
        ).order_by('display_order', 'value')
        return Response(LookupSerializer(values, many=True).data)
