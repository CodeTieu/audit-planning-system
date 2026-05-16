"""
Risks app views — Risk register API endpoints.
"""

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Risk
from .serializers import RiskSerializer, RiskLightSerializer
from users.permissions import IsTeamLeaderOrAbove


# ─────────────────────────────────────────────────────────────
# RISK LIST (per engagement or per workpaper)
# ─────────────────────────────────────────────────────────────
class RiskListView(generics.ListAPIView):
    """
    GET /api/risks/?engagement=:id
    GET /api/risks/?workpaper=:id
    GET /api/risks/?engagement=:id&severity=High&status=active
    """
    serializer_class = RiskLightSerializer
    filterset_fields = ['engagement', 'workpaper', 'severity',
                        'status', 'is_pervasive', 'is_cotabd_specific',
                        'source_document']
    search_fields    = ['risk_description', 'risk_no', 'cotabd']
    ordering_fields  = ['created_at', 'severity', 'risk_no']
    ordering         = ['created_at']

    def get_queryset(self):
        qs = Risk.objects.select_related(
            'engagement', 'workpaper', 'dismissed_by'
        )
        engagement_id = self.request.query_params.get('engagement')
        workpaper_id  = self.request.query_params.get('workpaper')
        if engagement_id:
            qs = qs.filter(engagement_id=engagement_id)
        if workpaper_id:
            qs = qs.filter(workpaper_id=workpaper_id)
        return qs


class RiskDetailView(generics.RetrieveAPIView):
    """GET /api/risks/:id/"""
    serializer_class = RiskSerializer
    queryset = Risk.objects.select_related(
        'engagement', 'workpaper', 'dismissed_by'
    ).all()


# ─────────────────────────────────────────────────────────────
# DISMISS RISK
# ─────────────────────────────────────────────────────────────
class RiskDismissView(APIView):
    """
    POST /api/risks/:pk/dismiss/
    Body: { "reason": "Not applicable because..." }
    Requires: TL or above
    """
    permission_classes = [IsTeamLeaderOrAbove]

    def post(self, request, pk):
        try:
            risk = Risk.objects.get(pk=pk)
        except Risk.DoesNotExist:
            return Response({'detail': 'Risk not found.'}, status=404)

        if risk.status == Risk.STATUS_DISMISSED:
            return Response({'detail': 'Risk is already dismissed.'}, status=400)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'detail': 'A reason is required when dismissing a risk.'},
                status=400
            )

        risk.status       = Risk.STATUS_DISMISSED
        risk.dismissed_at = timezone.now()
        risk.dismissed_by = request.user
        risk.dismissal_reason = reason
        risk.save(update_fields=[
            'status', 'dismissed_at', 'dismissed_by', 'dismissal_reason'
        ])

        return Response({
            'detail': f'Risk {risk.risk_no} dismissed.',
            'risk':   RiskLightSerializer(risk).data,
        })


class RiskRestoreView(APIView):
    """
    POST /api/risks/:pk/restore/
    Restores a dismissed risk back to active (TL+ only).
    """
    permission_classes = [IsTeamLeaderOrAbove]

    def post(self, request, pk):
        try:
            risk = Risk.objects.get(pk=pk)
        except Risk.DoesNotExist:
            return Response({'detail': 'Risk not found.'}, status=404)

        risk.status       = Risk.STATUS_ACTIVE
        risk.dismissed_at = None
        risk.dismissed_by = None
        risk.dismissal_reason = ''
        risk.save(update_fields=[
            'status', 'dismissed_at', 'dismissed_by', 'dismissal_reason'
        ])
        return Response({'detail': f'Risk {risk.risk_no} restored to active.'})


# ─────────────────────────────────────────────────────────────
# RISK SUMMARY (dashboard stats per engagement)
# ─────────────────────────────────────────────────────────────
@api_view(['GET'])
def risk_summary(request):
    """
    GET /api/risks/summary/?engagement=:id
    Returns counts by severity and status — used by dashboards.
    """
    engagement_id = request.query_params.get('engagement')
    if not engagement_id:
        return Response({'detail': 'engagement param required.'}, status=400)

    qs = Risk.objects.filter(engagement_id=engagement_id)

    active = qs.filter(status=Risk.STATUS_ACTIVE)

    return Response({
        'total':           qs.count(),
        'active':          active.count(),
        'dismissed':       qs.filter(status=Risk.STATUS_DISMISSED).count(),
        'addressed':       qs.filter(status=Risk.STATUS_ADDRESSED).count(),
        'by_severity': {
            'high_pervasive': active.filter(severity=Risk.SEVERITY_HIGH_PERVASIVE).count(),
            'high':           active.filter(severity=Risk.SEVERITY_HIGH).count(),
            'medium':         active.filter(severity=Risk.SEVERITY_MEDIUM).count(),
            'low':            active.filter(severity=Risk.SEVERITY_LOW).count(),
        },
        'pervasive':       active.filter(is_pervasive=True).count(),
        'cotabd_specific': active.filter(is_cotabd_specific=True).count(),
    })
