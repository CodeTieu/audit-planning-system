"""
Findings app views — FindingViewSet with custom actions.
"""

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from users.permissions import IsTeamLeaderOrAbove
from users.models import RoleLevel

from .models import Finding, FindingRiskLink
from .serializers import (
    FindingLightSerializer,
    FindingDetailSerializer,
    FindingCreateSerializer,
)
from risks.models import Risk


# ─────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────

def _is_tl_or_above(user):
    return (
        user.is_authenticated and
        hasattr(user, 'primary_role') and
        user.primary_role >= RoleLevel.TEAM_LEADER
    )


# ─────────────────────────────────────────────────────────────
# FINDING VIEWSET
# ─────────────────────────────────────────────────────────────

class FindingViewSet(viewsets.ModelViewSet):
    """
    CRUD + custom actions for audit findings.

    list            GET  /api/findings/?engagement=:id[&status=draft]
    retrieve        GET  /api/findings/:id/
    create          POST /api/findings/
    partial_update  PATCH /api/findings/:id/
    destroy         DELETE /api/findings/:id/  (TL+ only)

    dismiss         POST /api/findings/:id/dismiss/
    restore         POST /api/findings/:id/restore/
    link_risk       POST /api/findings/:id/link-risk/
    unlink_risk     DELETE /api/findings/:id/unlink-risk/:risk_id/
    collection      GET  /api/findings/collection/?engagement=:id
    """

    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    # ── Queryset ──────────────────────────────────────────────

    def get_queryset(self):
        qs = Finding.objects.select_related(
            'engagement', 'created_by', 'dismissed_by'
        ).prefetch_related('risk_links__risk')

        engagement_id = self.request.query_params.get('engagement')
        status_filter = self.request.query_params.get('status')

        if engagement_id:
            qs = qs.filter(engagement_id=engagement_id)
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    # ── Serializer selection ──────────────────────────────────

    def get_serializer_class(self):
        if self.action == 'create':
            return FindingCreateSerializer
        if self.action in ('retrieve', 'partial_update', 'collection'):
            return FindingDetailSerializer
        return FindingLightSerializer

    # ── Permission helpers ────────────────────────────────────

    def _require_tl(self, request):
        """Return None if TL+, else a 403 Response."""
        if not _is_tl_or_above(request.user):
            return Response(
                {'detail': 'Only Team Leaders and above may perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def _can_edit(self, request, finding):
        """Auditor may edit their own drafts; TL+ may edit anything."""
        if _is_tl_or_above(request.user):
            return True
        return (
            finding.status == Finding.STATUS_DRAFT and
            finding.created_by == request.user
        )

    # ── Standard actions ──────────────────────────────────────

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        finding = serializer.save()
        out = FindingDetailSerializer(finding, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        finding = self.get_object()
        if not self._can_edit(request, finding):
            return Response(
                {'detail': 'You do not have permission to edit this finding.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = FindingDetailSerializer(
            finding, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        err = self._require_tl(request)
        if err:
            return err
        finding = self.get_object()
        finding.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Custom action: dismiss ────────────────────────────────

    @action(detail=True, methods=['post'], url_path='dismiss')
    def dismiss(self, request, pk=None):
        finding = self.get_object()
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'detail': 'A dismissal reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if finding.status == Finding.STATUS_DISMISSED:
            return Response(
                {'detail': 'Finding is already dismissed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        finding.status           = Finding.STATUS_DISMISSED
        finding.dismissed_at     = timezone.now()
        finding.dismissed_by     = request.user
        finding.dismissal_reason = reason
        finding.save(update_fields=[
            'status', 'dismissed_at', 'dismissed_by', 'dismissal_reason'
        ])
        return Response(FindingDetailSerializer(finding).data)

    # ── Custom action: restore ────────────────────────────────

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        finding = self.get_object()
        if finding.status != Finding.STATUS_DISMISSED:
            return Response(
                {'detail': 'Only dismissed findings can be restored.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        finding.status           = Finding.STATUS_DRAFT
        finding.dismissed_at     = None
        finding.dismissed_by     = None
        finding.dismissal_reason = ''
        finding.save(update_fields=[
            'status', 'dismissed_at', 'dismissed_by', 'dismissal_reason'
        ])
        return Response(FindingDetailSerializer(finding).data)

    # ── Custom action: link-risk ──────────────────────────────

    @action(detail=True, methods=['post'], url_path='link-risk')
    def link_risk(self, request, pk=None):
        finding = self.get_object()
        if not self._can_edit(request, finding):
            return Response(
                {'detail': 'You do not have permission to edit this finding.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        risk_id = request.data.get('risk_id')
        if not risk_id:
            return Response(
                {'detail': 'risk_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            risk = Risk.objects.get(id=risk_id)
        except Risk.DoesNotExist:
            return Response(
                {'detail': f'Risk {risk_id} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        _, created = FindingRiskLink.objects.get_or_create(
            finding=finding,
            risk=risk,
            defaults={'linked_by': request.user},
        )
        if not created:
            return Response(
                {'detail': 'This risk is already linked to the finding.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            FindingDetailSerializer(finding).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Custom action: unlink-risk ────────────────────────────

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'unlink-risk/(?P<risk_id>[0-9]+)',
    )
    def unlink_risk(self, request, pk=None, risk_id=None):
        finding = self.get_object()
        if not self._can_edit(request, finding):
            return Response(
                {'detail': 'You do not have permission to edit this finding.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        deleted, _ = FindingRiskLink.objects.filter(
            finding=finding, risk_id=risk_id
        ).delete()
        if not deleted:
            return Response(
                {'detail': 'Risk link not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Custom action: collection ─────────────────────────────

    @action(detail=False, methods=['get'], url_path='collection')
    def collection(self, request):
        """
        GET /api/findings/collection/?engagement=:id
        Returns all non-dismissed findings for export, with full detail and linked risks.
        """
        engagement_id = request.query_params.get('engagement')
        if not engagement_id:
            return Response(
                {'detail': 'engagement query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        findings = (
            Finding.objects
            .filter(engagement_id=engagement_id)
            .exclude(status=Finding.STATUS_DISMISSED)
            .select_related('engagement', 'created_by', 'dismissed_by')
            .prefetch_related('risk_links__risk')
        )
        serializer = FindingDetailSerializer(findings, many=True)
        return Response(serializer.data)
