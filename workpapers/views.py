"""
Workpapers app views — WorkpaperViewSet and RiskViewSet.
"""

from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Q

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Workpaper, WorkpaperVersion, WorkpaperAttachment
from .serializers import (
    WorkpaperSerializer,
    WorkpaperLightSerializer,
    WorkpaperVersionSerializer,
    WorkpaperAttachmentSerializer,
    RiskSerializer,
    RiskLightSerializer,
)
from .risk_engine import RiskEngine
from risks.models import Risk
from engagements.models import DocumentAssignment
from notifications.models import Notification


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

ALLOWED_FILE_TYPES = {
    'application/pdf', 'image/jpeg', 'image/png', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
}

MAX_FILE_SIZE_KB = 10240  # 10 MB


def _create_version_snapshot(workpaper, changed_by, change_type, change_summary=''):
    """Create a WorkpaperVersion snapshot at the current version number."""
    WorkpaperVersion.objects.create(
        workpaper=workpaper,
        version=workpaper.version,
        form_data=workpaper.form_data,
        changed_by=changed_by,
        change_type=change_type,
        change_summary=change_summary,
    )


# ─────────────────────────────────────────────────────────────
# WORKPAPER VIEWSET
# ─────────────────────────────────────────────────────────────

class WorkpaperViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkpaperLightSerializer
        return WorkpaperSerializer

    def get_queryset(self):
        qs = Workpaper.objects.select_related(
            'engagement', 'document_type', 'created_by', 'last_updated_by'
        )
        engagement_id = self.request.query_params.get('engagement')
        if engagement_id:
            qs = qs.filter(engagement_id=engagement_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            last_updated_by=self.request.user,
        )

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        """
        PATCH — auto-save or manual save.
        On each save:
          1. Increment version
          2. Save form_data
          3. Create WorkpaperVersion snapshot
          4. Run RiskEngine.evaluate()
          5. Return updated workpaper + new risks
        """
        workpaper = self.get_object()
        previous_data = dict(workpaper.form_data)

        form_data = request.data.get('form_data')
        change_type = request.data.get('change_type', WorkpaperVersion.CHANGE_AUTOSAVE)
        change_summary = request.data.get('change_summary', '')

        if form_data is not None:
            workpaper.form_data = form_data

        workpaper.version += 1
        workpaper.last_updated_by = request.user
        workpaper.save()

        _create_version_snapshot(
            workpaper, request.user, change_type, change_summary
        )

        # Run risk engine
        engine = RiskEngine()
        new_risks = engine.evaluate(workpaper, workpaper.form_data, previous_data)

        serializer = WorkpaperSerializer(workpaper, context={'request': request})
        data = serializer.data
        data['new_risks'] = RiskSerializer(new_risks, many=True).data
        data['new_risks_count'] = len(new_risks)

        return Response(data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def submit(self, request, pk=None):
        """
        POST /api/workpapers/:id/submit/

        Validates status is draft, transitions to submitted, unlocks dependent docs,
        creates a version snapshot, and sends TL notification.
        """
        workpaper = self.get_object()

        if workpaper.status not in [Workpaper.STATUS_DRAFT, Workpaper.STATUS_RETURNED]:
            return Response(
                {'detail': f'Cannot submit a workpaper with status "{workpaper.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate required fields (basic: form_data must not be empty)
        if not workpaper.form_data:
            return Response(
                {'detail': 'Cannot submit an empty workpaper.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Update workpaper status
        workpaper.status = Workpaper.STATUS_SUBMITTED
        workpaper.submitted_at = timezone.now()
        workpaper.version += 1
        workpaper.last_updated_by = request.user
        workpaper.save()

        # 2. Create submission version snapshot
        _create_version_snapshot(
            workpaper, request.user,
            WorkpaperVersion.CHANGE_SUBMISSION,
            'Submitted for Team Leader review.',
        )

        # 3. Update DocumentAssignment status to submitted
        try:
            assignment = DocumentAssignment.objects.get(
                engagement=workpaper.engagement,
                document_type=workpaper.document_type,
            )
            assignment.status = DocumentAssignment.STATUS_SUBMITTED
            assignment.submitted_at = timezone.now()
            assignment.save()
            # DocumentAssignment.save() already handles unlocking dependents
        except DocumentAssignment.DoesNotExist:
            pass

        # 4. Send notification to Team Leader
        try:
            tl = workpaper.engagement.team_leader
            Notification.objects.create(
                recipient=tl,
                notification_type=Notification.TYPE_SUBMISSION,
                tier=Notification.TIER_STANDARD,
                title=f'Workpaper Submitted: {workpaper.document_type.code}',
                message=(
                    f'{request.user.full_name} has submitted workpaper '
                    f'"{workpaper.document_type.name}" for engagement '
                    f'{workpaper.engagement.engagement_code}.'
                ),
                engagement=workpaper.engagement,
                document_type=workpaper.document_type.code,
            )
        except Exception:
            pass  # Notification failure must not block submission

        serializer = WorkpaperSerializer(workpaper, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """GET /api/workpapers/:id/versions/ — version history."""
        workpaper = self.get_object()
        qs = WorkpaperVersion.objects.filter(workpaper=workpaper).order_by('-changed_at')
        serializer = WorkpaperVersionSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['post'],
        url_path='attachments',
        parser_classes=[MultiPartParser, FormParser],
    )
    @transaction.atomic
    def upload_attachment(self, request, pk=None):
        """POST /api/workpapers/:id/attachments/ — upload a file attachment."""
        workpaper = self.get_object()

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'detail': 'No file provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file type
        content_type = file_obj.content_type
        if content_type not in ALLOWED_FILE_TYPES:
            return Response(
                {'detail': f'File type "{content_type}" is not allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size
        file_size_kb = file_obj.size // 1024
        if file_size_kb > MAX_FILE_SIZE_KB:
            return Response(
                {'detail': f'File exceeds maximum size of {MAX_FILE_SIZE_KB} KB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attachment = WorkpaperAttachment.objects.create(
            workpaper=workpaper,
            question_ref=request.data.get('question_ref', ''),
            file_name=file_obj.name,
            file=file_obj,
            file_type=content_type,
            file_size_kb=file_size_kb,
            uploaded_by=request.user,
            description=request.data.get('description', ''),
        )

        serializer = WorkpaperAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['delete'],
        url_path='attachments/(?P<att_id>[^/.]+)',
    )
    @transaction.atomic
    def delete_attachment(self, request, pk=None, att_id=None):
        """DELETE /api/workpapers/:id/attachments/:att_id/"""
        workpaper = self.get_object()
        try:
            attachment = WorkpaperAttachment.objects.get(
                pk=att_id, workpaper=workpaper
            )
        except WorkpaperAttachment.DoesNotExist:
            return Response(
                {'detail': 'Attachment not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Only uploader or staff can delete
        if attachment.uploaded_by != request.user and not request.user.is_staff:
            return Response(
                {'detail': 'You do not have permission to delete this attachment.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────
# RISK VIEWSET
# ─────────────────────────────────────────────────────────────

class RiskViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return RiskSerializer

    def get_queryset(self):
        qs = Risk.objects.select_related(
            'engagement', 'workpaper', 'dismissed_by'
        )
        engagement_id = self.request.query_params.get('engagement')
        workpaper_id = self.request.query_params.get('workpaper')

        if engagement_id:
            qs = qs.filter(engagement_id=engagement_id)
        if workpaper_id:
            qs = qs.filter(workpaper_id=workpaper_id)

        return qs

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def dismiss(self, request, pk=None):
        """POST /api/risks/:id/dismiss/ — dismiss a risk with a reason."""
        risk = self.get_object()
        reason = request.data.get('reason', '').strip()

        if not reason:
            return Response(
                {'detail': 'A dismissal reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if risk.status == Risk.STATUS_DISMISSED:
            return Response(
                {'detail': 'Risk is already dismissed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        engine = RiskEngine()
        engine.dismiss_triggered_risk(risk, request.user, reason)

        serializer = RiskSerializer(risk, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        GET /api/risks/summary/?engagement=:id

        Returns summary counts: high/medium/low, total, dismissed.
        """
        engagement_id = request.query_params.get('engagement')
        if not engagement_id:
            return Response(
                {'detail': 'engagement parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = Risk.objects.filter(engagement_id=engagement_id)

        total = qs.count()
        active = qs.filter(status=Risk.STATUS_ACTIVE).count()
        dismissed = qs.filter(status=Risk.STATUS_DISMISSED).count()
        addressed = qs.filter(status=Risk.STATUS_ADDRESSED).count()

        high = qs.filter(
            status=Risk.STATUS_ACTIVE,
            severity__in=[Risk.SEVERITY_HIGH, Risk.SEVERITY_HIGH_PERVASIVE]
        ).count()
        medium = qs.filter(status=Risk.STATUS_ACTIVE, severity=Risk.SEVERITY_MEDIUM).count()
        low = qs.filter(status=Risk.STATUS_ACTIVE, severity=Risk.SEVERITY_LOW).count()
        pervasive = qs.filter(status=Risk.STATUS_ACTIVE, is_pervasive=True).count()

        return Response({
            'engagement_id': engagement_id,
            'total': total,
            'active': active,
            'dismissed': dismissed,
            'addressed': addressed,
            'by_severity': {
                'high': high,
                'medium': medium,
                'low': low,
            },
            'pervasive': pervasive,
        })
