"""
Entities app views
"""

from rest_framework import generics, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from users.permissions import IsAdmin
from .models import EntityType, Entity
from .serializers import EntityTypeSerializer, EntityListSerializer, EntityDetailSerializer


# ─────────────────────────────────────────────────────────────
# EntityType views — admin only for write, authenticated for read
# ─────────────────────────────────────────────────────────────

class EntityTypeListCreateView(generics.ListCreateAPIView):
    """List all entity types or create a new one (admin only for create)."""
    queryset         = EntityType.objects.all()
    serializer_class = EntityTypeSerializer
    filter_backends  = [SearchFilter, OrderingFilter]
    search_fields    = ['name', 'code']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]


class EntityTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an entity type (admin only for write)."""
    queryset         = EntityType.objects.all()
    serializer_class = EntityTypeSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]


# ─────────────────────────────────────────────────────────────
# Entity views
# ─────────────────────────────────────────────────────────────

class EntityListCreateView(generics.ListCreateAPIView):
    """
    GET  — accessible to all authenticated users (for dropdowns).
    POST — admin only.
    """
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['entity_type', 'is_active', 'division']
    search_fields    = ['name', 'code', 'contact_person']
    ordering_fields  = ['name', 'created_at']

    def get_queryset(self):
        return Entity.objects.select_related('entity_type', 'division', 'created_by').all()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EntityDetailSerializer
        return EntityListSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]


class EntityDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an entity (admin only for write)."""
    queryset = Entity.objects.select_related('entity_type', 'division', 'created_by').all()
    serializer_class = EntityDetailSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]
