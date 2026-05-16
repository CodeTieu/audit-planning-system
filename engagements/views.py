"""
Engagements app views
"""

from django.db.models import Count, Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from rest_framework.permissions import BasePermission

from users.models import RoleLevel
from users.permissions import IsCEAOrAbove, IsTeamLeaderOrAbove, IsAdmin


class IsAdminOrDAGOrAAG(BasePermission):
    """Permission allowing Admin, DAG, or AAG to create engagements."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.primary_role in [RoleLevel.ADMIN, RoleLevel.DAG, RoleLevel.AAG]
        )

from .models import Engagement, EngagementTeam, DocumentType, DocumentAssignment
from .serializers import (
    EngagementListSerializer,
    EngagementDetailSerializer,
    EngagementCreateSerializer,
    EngagementTeamSerializer,
    DocumentTypeSerializer,
    DocumentAssignmentSerializer,
)


# ─────────────────────────────────────────────────────────────
# Scoping helper
# ─────────────────────────────────────────────────────────────

def scoped_engagements(user):
    """Return Engagement queryset scoped to what the user may see."""
    role = user.primary_role

    # TSSU / Admin — see everything
    if user.can_see_all:
        return Engagement.objects.all()

    # DAG — sees all engagements for entities in their division (and children)
    if role == RoleLevel.DAG:
        if user.division:
            division_ids = [user.division.id] + user.division.get_descendant_ids()
            return Engagement.objects.filter(entity__division_id__in=division_ids)
        return Engagement.objects.none()

    # AAG — sees engagements for entities in their sector
    if role == RoleLevel.AAG:
        if user.division:
            division_ids = [user.division.id] + user.division.get_descendant_ids()
            return Engagement.objects.filter(entity__division_id__in=division_ids)
        return Engagement.objects.none()

    # CEA — sees ONLY engagements assigned to them as responsible_person
    if role == RoleLevel.CEA:
        return Engagement.objects.filter(responsible_person=user)

    # Team Leader — sees engagements where they are the team_leader
    if role == RoleLevel.TEAM_LEADER:
        return Engagement.objects.filter(team_leader=user)

    # Auditor — sees engagements they are a team member on
    return Engagement.objects.filter(team_members__user=user).distinct()


# ─────────────────────────────────────────────────────────────
# Engagement List + Create
# ─────────────────────────────────────────────────────────────

class EngagementListCreateView(generics.ListCreateAPIView):
    """
    GET  — authenticated users see their scoped engagements.
    POST — Admin, DAG, or AAG only.
    """
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'audit_year', 'entity']
    search_fields    = ['engagement_code', 'entity__name']
    ordering_fields  = ['audit_year', 'created_at', 'status']

    def get_queryset(self):
        return scoped_engagements(self.request.user).select_related(
            'entity', 'team_leader', 'created_by'
        ).prefetch_related('document_assignments')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EngagementCreateSerializer
        return EngagementListSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminOrDAGOrAAG()]
        return [permissions.IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        engagement = serializer.save()
        out = EngagementDetailSerializer(engagement, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────
# Engagement Detail
# ─────────────────────────────────────────────────────────────

class EngagementDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an engagement."""
    serializer_class = EngagementDetailSerializer

    def get_queryset(self):
        return scoped_engagements(self.request.user).select_related(
            'entity', 'team_leader', 'created_by', 'locked_by'
        ).prefetch_related(
            'team_members__user',
            'document_assignments__document_type',
            'document_assignments__assigned_to',
        )

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsCEAOrAbove()]
        return [permissions.IsAuthenticated()]


# ─────────────────────────────────────────────────────────────
# Engagement Team — list, add, remove
# ─────────────────────────────────────────────────────────────

class EngagementTeamView(APIView):
    """GET list of team members; POST to add; DELETE to remove."""
    permission_classes = [permissions.IsAuthenticated]

    def _get_engagement(self, engagement_id, user):
        try:
            engagement = scoped_engagements(user).get(pk=engagement_id)
        except Engagement.DoesNotExist:
            return None
        return engagement

    def get(self, request, engagement_id):
        engagement = self._get_engagement(engagement_id, request.user)
        if not engagement:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        members = EngagementTeam.objects.filter(engagement=engagement).select_related('user', 'added_by')
        serializer = EngagementTeamSerializer(members, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, engagement_id):
        """Add a team member — TL or CEA+ only."""
        if request.user.primary_role < RoleLevel.TEAM_LEADER:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        engagement = self._get_engagement(engagement_id, request.user)
        if not engagement:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = {**request.data, 'engagement': engagement.pk}
        serializer = EngagementTeamSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, engagement_id):
        """Remove a team member — TL or CEA+ only."""
        if request.user.primary_role < RoleLevel.TEAM_LEADER:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        engagement = self._get_engagement(engagement_id, request.user)
        if not engagement:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        member_id = request.data.get('user')
        try:
            member = EngagementTeam.objects.get(engagement=engagement, user_id=member_id)
            member.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except EngagementTeam.DoesNotExist:
            return Response({'detail': 'Team member not found.'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────────────────────────
# Document Assignment — TL assigns documents
# ─────────────────────────────────────────────────────────────

class DocumentAssignmentView(APIView):
    """GET assignments for an engagement; POST to assign; PATCH to update status."""
    permission_classes = [permissions.IsAuthenticated]

    def _get_engagement(self, engagement_id, user):
        try:
            return scoped_engagements(user).get(pk=engagement_id)
        except Engagement.DoesNotExist:
            return None

    def get(self, request, engagement_id):
        engagement = self._get_engagement(engagement_id, request.user)
        if not engagement:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        assignments = DocumentAssignment.objects.filter(
            engagement=engagement
        ).select_related('document_type', 'assigned_to', 'assigned_by').order_by(
            'document_type__sequence_order'
        )
        serializer = DocumentAssignmentSerializer(assignments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, engagement_id):
        """Create a new document assignment — TL or above only."""
        if request.user.primary_role < RoleLevel.TEAM_LEADER:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        engagement = self._get_engagement(engagement_id, request.user)
        if not engagement:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = {**request.data, 'engagement': engagement.pk}
        serializer = DocumentAssignmentSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request, engagement_id):
        """Update status of a document assignment."""
        engagement = self._get_engagement(engagement_id, request.user)
        if not engagement:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        assignment_id = request.data.get('id')
        try:
            assignment = DocumentAssignment.objects.get(
                pk=assignment_id, engagement=engagement
            )
        except DocumentAssignment.DoesNotExist:
            return Response({'detail': 'Assignment not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DocumentAssignmentSerializer(
            assignment, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────
# Progress endpoint
# ─────────────────────────────────────────────────────────────

class EngagementProgressView(APIView):
    """GET /api/engagements/:id/progress/ — completion % per document."""
    permission_classes = [permissions.IsAuthenticated]

    COMPLETED_STATUSES = {
        DocumentAssignment.STATUS_FINALIZED,
        DocumentAssignment.STATUS_TL_APPROVED,
    }

    def get(self, request, pk):
        try:
            engagement = scoped_engagements(request.user).get(pk=pk)
        except Engagement.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        assignments = DocumentAssignment.objects.filter(
            engagement=engagement
        ).select_related('document_type')

        total     = assignments.count()
        completed = sum(1 for a in assignments if a.status in self.COMPLETED_STATUSES)

        overall_pct = round((completed / total * 100), 1) if total else 0

        per_document = []
        for a in assignments:
            per_document.append({
                'document_type_code': a.document_type.code,
                'document_type_name': a.document_type.name,
                'status': a.status,
                'status_display': a.get_status_display(),
                'is_complete': a.status in self.COMPLETED_STATUSES,
                'assigned_to': a.assigned_to.full_name,
                'deadline': a.deadline,
            })

        return Response({
            'engagement_code': engagement.engagement_code,
            'total_documents': total,
            'completed_documents': completed,
            'overall_completion_pct': overall_pct,
            'documents': per_document,
        })


# ─────────────────────────────────────────────────────────────
# DocumentType views (admin manages)
# ─────────────────────────────────────────────────────────────

class EngagementTeamMemberView(APIView):
    """DELETE /api/engagements/:engagement_id/team/:member_id/ — remove a single team member."""
    permission_classes = [IsTeamLeaderOrAbove]

    def delete(self, request, engagement_id, member_id):
        try:
            engagement = scoped_engagements(request.user).get(pk=engagement_id)
        except Engagement.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            member = EngagementTeam.objects.get(pk=member_id, engagement=engagement)
            member.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except EngagementTeam.DoesNotExist:
            return Response({'detail': 'Team member not found.'}, status=status.HTTP_404_NOT_FOUND)


class DocumentAssignmentDetailView(APIView):
    """PATCH /api/engagements/:engagement_id/documents/:doc_id/ — update a specific assignment."""
    permission_classes = [IsTeamLeaderOrAbove]

    def patch(self, request, engagement_id, doc_id):
        try:
            engagement = scoped_engagements(request.user).get(pk=engagement_id)
        except Engagement.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            assignment = DocumentAssignment.objects.get(pk=doc_id, engagement=engagement)
        except DocumentAssignment.DoesNotExist:
            return Response({'detail': 'Assignment not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DocumentAssignmentSerializer(
            assignment, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DocumentTypeListView(generics.ListAPIView):
    queryset         = DocumentType.objects.filter(is_active=True)
    serializer_class = DocumentTypeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends  = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['category', 'is_active']
    search_fields    = ['code', 'name']


class DocumentTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = DocumentType.objects.all()
    serializer_class = DocumentTypeSerializer
    permission_classes = [IsAdmin]
