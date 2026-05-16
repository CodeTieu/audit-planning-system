"""
Reviews app views — TL document review, package submission, reviewer actions,
package detail, engagement lock/unlock.
"""

from django.utils import timezone

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from engagements.models import Engagement, EngagementTeam, DocumentAssignment
from notifications.models import Notification
from users.models import RoleLevel
from users.permissions import IsTSSUOrAdmin

from .models import (
    ReviewPackage,
    ReviewAction,
    DocumentReviewFlag,
    TLDocumentReview,
)
from .serializers import (
    ReviewPackageSerializer,
    ReviewPackageLightSerializer,
    ReviewActionSerializer,
    TLDocumentReviewSerializer,
)


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

LEVEL_LABEL = {
    1: 'Auditor',
    2: 'Team Leader',
    3: 'CEA',
    4: 'AAG',
    5: 'DAG',
    6: 'TSSU',
}


def _get_users_at_level(level):
    """Return active users whose primary_role == level."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.filter(primary_role=level, is_active=True)


def _notify(recipient, notification_type, tier, title, message, engagement=None, document_type=''):
    """Create a single Notification record."""
    Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        tier=tier,
        title=title,
        message=message,
        engagement=engagement,
        document_type=document_type,
    )


def _notify_many(recipients, notification_type, tier, title, message, engagement=None):
    """Create Notification records for a queryset/list of users."""
    for user in recipients:
        _notify(user, notification_type, tier, title, message, engagement)


# ─────────────────────────────────────────────────────────────
# 1. TL DOCUMENT REVIEW
# ─────────────────────────────────────────────────────────────

class TLDocumentReviewView(APIView):
    """
    POST /api/reviews/tl-review/
    TL reviews an individual document before submitting the whole package.

    Body: { engagement_id, document_type, action, comment }
    action: 'approve' | 'return' | 'comment'
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.primary_role < RoleLevel.TEAM_LEADER:
            return Response(
                {'detail': 'Only Team Leaders or above may review documents.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        engagement_id = request.data.get('engagement_id')
        document_type = request.data.get('document_type', '').strip()
        action        = request.data.get('action', '').strip()
        comment       = request.data.get('comment', '').strip()

        if not engagement_id or not document_type or not action:
            return Response(
                {'detail': 'engagement_id, document_type, and action are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_actions = [
            TLDocumentReview.ACTION_APPROVE,
            TLDocumentReview.ACTION_RETURN,
            TLDocumentReview.ACTION_COMMENT,
        ]
        if action not in valid_actions:
            return Response(
                {'detail': f'action must be one of {valid_actions}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            engagement = Engagement.objects.get(pk=engagement_id)
        except Engagement.DoesNotExist:
            return Response({'detail': 'Engagement not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Resolve document assignment by code
        assignment = (
            DocumentAssignment.objects
            .filter(engagement=engagement, document_type__code=document_type)
            .select_related('document_type', 'assigned_to')
            .first()
        )
        if not assignment:
            return Response(
                {'detail': f'No assignment found for document type {document_type}.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action == TLDocumentReview.ACTION_APPROVE:
            assignment.status = DocumentAssignment.STATUS_TL_APPROVED
            assignment.tl_approved_at = timezone.now()
            assignment.save(update_fields=['status', 'tl_approved_at'])

        elif action == TLDocumentReview.ACTION_RETURN:
            assignment.status = DocumentAssignment.STATUS_RETURNED
            assignment.save(update_fields=['status'])
            # Notify assigned auditor
            _notify(
                recipient=assignment.assigned_to,
                notification_type=Notification.TYPE_REJECTION,
                tier=Notification.TIER_STANDARD,
                title=f'Document {document_type} returned by TL',
                message=(
                    f'Your document {document_type} for engagement '
                    f'{engagement.engagement_code} has been returned by the Team Leader. '
                    f'Comment: {comment or "No comment provided."}'
                ),
                engagement=engagement,
                document_type=document_type,
            )

        # Record TL review
        review = TLDocumentReview.objects.create(
            engagement=engagement,
            document_type=document_type,
            reviewer=user,
            action=action,
            comment=comment,
        )

        return Response(
            {
                'detail': f'Document {document_type} {action}d.',
                'assignment_status': assignment.status,
                'review': TLDocumentReviewSerializer(review).data,
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# 2. SUBMIT PACKAGE
# ─────────────────────────────────────────────────────────────

class SubmitPackageView(APIView):
    """
    POST /api/reviews/submit-package/
    TL submits the entire engagement package to CEA.

    Body: { engagement_id }
    Validates: all DocumentAssignments must be 'tl_approved'.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.primary_role < RoleLevel.TEAM_LEADER:
            return Response(
                {'detail': 'Only Team Leaders may submit a package.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        engagement_id = request.data.get('engagement_id')
        if not engagement_id:
            return Response(
                {'detail': 'engagement_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            engagement = Engagement.objects.get(pk=engagement_id)
        except Engagement.DoesNotExist:
            return Response({'detail': 'Engagement not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Validate all assignments are TL-approved
        assignments = DocumentAssignment.objects.filter(engagement=engagement)
        not_approved = assignments.exclude(
            status=DocumentAssignment.STATUS_TL_APPROVED
        )
        if not_approved.exists():
            codes = list(
                not_approved.values_list('document_type__code', flat=True)
            )
            return Response(
                {
                    'detail': 'All documents must be TL-approved before submitting the package.',
                    'not_approved': codes,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine version
        last_package = (
            ReviewPackage.objects
            .filter(engagement=engagement)
            .order_by('-package_version')
            .first()
        )
        version = (last_package.package_version + 1) if last_package else 1

        # Create the package at CEA level (3)
        package = ReviewPackage.objects.create(
            engagement=engagement,
            package_version=version,
            submitted_by=user,
            current_level=RoleLevel.CEA,
            status=ReviewPackage.STATUS_PENDING,
        )

        # Mark engagement's submitted_to_cea_at
        engagement.submitted_to_cea_at = timezone.now()
        engagement.save(update_fields=['submitted_to_cea_at'])

        # Notify the engagement's responsible person (CEA, AAG, or Overall TL),
        # plus any other CEAs in the same division. This guarantees a reviewer
        # is always notified even if the responsible_person isn't a level-3 CEA.
        from django.contrib.auth import get_user_model
        User = get_user_model()

        recipient_ids = set()
        if engagement.responsible_person_id:
            recipient_ids.add(engagement.responsible_person_id)

        # Include all CEAs whose division matches the entity's division (or any CEA if no division match)
        cea_qs = User.objects.filter(primary_role=RoleLevel.CEA, is_active=True)
        if getattr(engagement.entity, 'division_id', None):
            scoped = cea_qs.filter(division_id=engagement.entity.division_id)
            if scoped.exists():
                cea_qs = scoped
        recipient_ids.update(cea_qs.values_list('id', flat=True))

        cea_users = User.objects.filter(id__in=recipient_ids)
        _notify_many(
            recipients=cea_users,
            notification_type=Notification.TYPE_SUBMISSION,
            tier=Notification.TIER_STANDARD,
            title=f'Package ready for review: {engagement.engagement_code}',
            message=(
                f'Team Leader {user.full_name} has submitted the audit package for '
                f'{engagement.engagement_code} (v{version}). Please review.'
            ),
            engagement=engagement,
        )

        return Response(
            ReviewPackageSerializer(package).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────
# 3. PACKAGE LIST  &  MY PENDING
# ─────────────────────────────────────────────────────────────

class ReviewPackageListView(APIView):
    """
    GET /api/reviews/packages/?engagement=<id>
    Returns all review packages for an engagement (version history).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        engagement_id = request.query_params.get('engagement')
        if not engagement_id:
            return Response(
                {'detail': 'engagement query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        packages = ReviewPackage.objects.filter(
            engagement_id=engagement_id
        ).select_related('engagement', 'submitted_by')

        serializer = ReviewPackageLightSerializer(packages, many=True)
        return Response(serializer.data)


class MyPendingPackagesView(APIView):
    """
    GET /api/reviews/my-pending/
    Returns packages currently pending the authenticated user's review level.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        level = user.primary_role
        if level < RoleLevel.TEAM_LEADER:
            return Response([], status=status.HTTP_200_OK)

        packages = ReviewPackage.objects.filter(
            current_level=level,
            status=ReviewPackage.STATUS_PENDING,
        ).select_related('engagement', 'submitted_by')

        serializer = ReviewPackageLightSerializer(packages, many=True)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────
# 4. REVIEWER ACTION (approve / return)
# ─────────────────────────────────────────────────────────────

class ReviewActionView(APIView):
    """
    POST /api/reviews/packages/<pk>/action/
    Reviewer approves or returns a package.

    Body:
    {
        action: 'approve' | 'return',
        returned_to_level: <int>,       # required if action=='return'
        general_comment: "",
        flagged_documents: [            # required if action=='return'
            { document_type: "UE1", comment: "..." },
            ...
        ]
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            package = ReviewPackage.objects.select_related(
                'engagement', 'submitted_by'
            ).get(pk=pk)
        except ReviewPackage.DoesNotExist:
            return Response({'detail': 'Package not found.'}, status=status.HTTP_404_NOT_FOUND)

        if package.status != ReviewPackage.STATUS_PENDING:
            return Response(
                {'detail': 'This package is no longer pending review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.primary_role != package.current_level and not user.can_see_all:
            return Response(
                {'detail': 'You are not the designated reviewer for this package level.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        action          = request.data.get('action', '').strip()
        general_comment = request.data.get('general_comment', '').strip()
        flagged_docs    = request.data.get('flagged_documents', [])
        returned_to     = request.data.get('returned_to_level')

        valid_actions = [ReviewAction.ACTION_APPROVE, ReviewAction.ACTION_RETURN]
        if action not in valid_actions:
            return Response(
                {'detail': f'action must be one of {valid_actions}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        engagement = package.engagement
        tl         = engagement.team_leader

        if action == ReviewAction.ACTION_APPROVE:
            review_action = ReviewAction.objects.create(
                package=package,
                reviewer=user,
                action=ReviewAction.ACTION_APPROVE,
                general_comment=general_comment,
            )

            if package.current_level < RoleLevel.TSSU:
                # Advance to next level
                next_level = package.current_level + 1
                package.current_level = next_level
                package.save(update_fields=['current_level'])

                # Notify next level reviewers
                next_users = _get_users_at_level(next_level)
                _notify_many(
                    recipients=next_users,
                    notification_type=Notification.TYPE_APPROVAL,
                    tier=Notification.TIER_STANDARD,
                    title=(
                        f'Package approved — now at {LEVEL_LABEL.get(next_level, str(next_level))} level'
                    ),
                    message=(
                        f'{user.full_name} approved the package for '
                        f'{engagement.engagement_code} v{package.package_version}. '
                        f'Awaiting your review.'
                    ),
                    engagement=engagement,
                )
            else:
                # TSSU final approval — lock everything
                package.status = ReviewPackage.STATUS_LOCKED
                package.completed_at = timezone.now()
                package.save(update_fields=['status', 'completed_at'])

                # Lock the engagement
                engagement.status = Engagement.STATUS_LOCKED
                engagement.locked_at = timezone.now()
                engagement.locked_by = user
                engagement.save(update_fields=['status', 'locked_at', 'locked_by'])

                # Mark all document assignments as finalized
                DocumentAssignment.objects.filter(
                    engagement=engagement,
                    status=DocumentAssignment.STATUS_TL_APPROVED,
                ).update(status=DocumentAssignment.STATUS_FINALIZED)

                # Notify whole team
                team_members = list(
                    EngagementTeam.objects.filter(engagement=engagement)
                    .select_related('user')
                    .values_list('user', flat=True)
                )
                from django.contrib.auth import get_user_model
                User = get_user_model()
                recipients = User.objects.filter(pk__in=team_members)
                _notify_many(
                    recipients=recipients,
                    notification_type=Notification.TYPE_APPROVAL,
                    tier=Notification.TIER_CRITICAL,
                    title=f'Engagement locked: {engagement.engagement_code}',
                    message=(
                        f'TSSU has given final approval. '
                        f'Engagement {engagement.engagement_code} is now locked.'
                    ),
                    engagement=engagement,
                )

            return Response(
                ReviewPackageSerializer(package).data,
                status=status.HTTP_200_OK,
            )

        # ── RETURN ───────────────────────────────────────────────
        if returned_to is None:
            return Response(
                {'detail': 'returned_to_level is required when returning a package.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        returned_to = int(returned_to)

        review_action = ReviewAction.objects.create(
            package=package,
            reviewer=user,
            action=ReviewAction.ACTION_RETURN,
            returned_to_level=returned_to,
            general_comment=general_comment,
        )

        # Create document flags
        for flag_data in flagged_docs:
            doc_type    = flag_data.get('document_type', '')
            flag_comment = flag_data.get('comment', '')
            if doc_type:
                DocumentReviewFlag.objects.update_or_create(
                    package=package,
                    document_type=doc_type,
                    defaults={
                        'is_flagged': True,
                        'flag_comment': flag_comment,
                        'flagged_by': user,
                        'flagged_at': timezone.now(),
                    },
                )

        # Update package
        package.status = ReviewPackage.STATUS_RETURNED
        package.save(update_fields=['status'])

        # Flagged document codes
        flagged_codes = [fd.get('document_type') for fd in flagged_docs if fd.get('document_type')]

        if returned_to == RoleLevel.TEAM_LEADER:
            # Reset flagged assignments to 'returned'
            if flagged_codes:
                DocumentAssignment.objects.filter(
                    engagement=engagement,
                    document_type__code__in=flagged_codes,
                ).update(status=DocumentAssignment.STATUS_RETURNED)

            # Notify TL
            _notify(
                recipient=tl,
                notification_type=Notification.TYPE_REJECTION,
                tier=Notification.TIER_CRITICAL,
                title=f'Package returned to TL: {engagement.engagement_code}',
                message=(
                    f'{user.full_name} returned the package for '
                    f'{engagement.engagement_code} v{package.package_version} '
                    f'to Team Leader level. '
                    f'Flagged documents: {", ".join(flagged_codes) or "none"}. '
                    f'Comment: {general_comment or "No comment."}'
                ),
                engagement=engagement,
            )

        elif returned_to == RoleLevel.AUDITOR:
            # Reset flagged assignments to 'returned', notify specific auditors
            if flagged_codes:
                flagged_assignments = DocumentAssignment.objects.filter(
                    engagement=engagement,
                    document_type__code__in=flagged_codes,
                ).select_related('assigned_to', 'document_type')

                flagged_assignments.update(status=DocumentAssignment.STATUS_RETURNED)

                notified_auditors = set()
                for assign in flagged_assignments:
                    if assign.assigned_to.pk not in notified_auditors:
                        _notify(
                            recipient=assign.assigned_to,
                            notification_type=Notification.TYPE_REJECTION,
                            tier=Notification.TIER_STANDARD,
                            title=f'Document returned: {assign.document_type.code}',
                            message=(
                                f'{user.full_name} returned document {assign.document_type.code} '
                                f'for {engagement.engagement_code}. '
                                f'Comment: {general_comment or "No comment."}'
                            ),
                            engagement=engagement,
                            document_type=assign.document_type.code,
                        )
                        notified_auditors.add(assign.assigned_to.pk)

            # CC TL on any return
            _notify(
                recipient=tl,
                notification_type=Notification.TYPE_REJECTION,
                tier=Notification.TIER_STANDARD,
                title=f'[CC] Package returned to Auditor: {engagement.engagement_code}',
                message=(
                    f'{user.full_name} returned flagged documents to individual auditors '
                    f'for {engagement.engagement_code} v{package.package_version}. '
                    f'Flagged: {", ".join(flagged_codes) or "none"}.'
                ),
                engagement=engagement,
            )

        else:
            # Generic return to an intermediate level — CC TL
            next_users = _get_users_at_level(returned_to)
            _notify_many(
                recipients=next_users,
                notification_type=Notification.TYPE_REJECTION,
                tier=Notification.TIER_STANDARD,
                title=f'Package returned to level {LEVEL_LABEL.get(returned_to, str(returned_to))}',
                message=(
                    f'{user.full_name} returned the package for '
                    f'{engagement.engagement_code} v{package.package_version}. '
                    f'Comment: {general_comment or "No comment."}'
                ),
                engagement=engagement,
            )
            _notify(
                recipient=tl,
                notification_type=Notification.TYPE_REJECTION,
                tier=Notification.TIER_STANDARD,
                title=f'[CC] Package returned: {engagement.engagement_code}',
                message=(
                    f'{user.full_name} returned the package to level '
                    f'{LEVEL_LABEL.get(returned_to, str(returned_to))}.'
                ),
                engagement=engagement,
            )

        return Response(
            ReviewPackageSerializer(package).data,
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# 5. PACKAGE DETAIL
# ─────────────────────────────────────────────────────────────

class GetPackageDetailView(APIView):
    """
    GET /api/reviews/packages/<pk>/
    Returns full package with documents, their status, and review history.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            package = ReviewPackage.objects.select_related(
                'engagement', 'submitted_by'
            ).prefetch_related('actions__reviewer', 'document_flags__flagged_by').get(pk=pk)
        except ReviewPackage.DoesNotExist:
            return Response({'detail': 'Package not found.'}, status=status.HTTP_404_NOT_FOUND)

        engagement = package.engagement

        # Build per-document info from assignments
        assignments = (
            DocumentAssignment.objects
            .filter(engagement=engagement)
            .select_related('document_type', 'assigned_to')
            .order_by('document_type__sequence_order')
        )

        flags_by_type = {
            f.document_type: f
            for f in package.document_flags.all()
        }

        documents = []
        for assign in assignments:
            code = assign.document_type.code
            flag = flags_by_type.get(code)
            documents.append({
                'document_type': code,
                'document_name': assign.document_type.name,
                'assignment_status': assign.status,
                'assigned_to': assign.assigned_to.full_name,
                'is_flagged': flag.is_flagged if flag else False,
                'flag_comment': flag.flag_comment if flag else '',
                'flagged_by': flag.flagged_by.full_name if (flag and flag.flagged_by) else None,
                'flagged_at': flag.flagged_at if flag else None,
            })

        data = ReviewPackageSerializer(package).data
        data['documents'] = documents
        return Response(data)


# ─────────────────────────────────────────────────────────────
# 6. LOCK ENGAGEMENT
# ─────────────────────────────────────────────────────────────

class LockEngagementView(APIView):
    """
    POST /api/reviews/packages/<pk>/lock/
    TSSU or Admin only — manually lock engagement after final review.
    """

    permission_classes = [IsAuthenticated, IsTSSUOrAdmin]

    def post(self, request, pk):
        try:
            package = ReviewPackage.objects.select_related('engagement').get(pk=pk)
        except ReviewPackage.DoesNotExist:
            return Response({'detail': 'Package not found.'}, status=status.HTTP_404_NOT_FOUND)

        engagement = package.engagement

        if engagement.status == Engagement.STATUS_LOCKED:
            return Response(
                {'detail': 'Engagement is already locked.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Lock the package
        package.status = ReviewPackage.STATUS_LOCKED
        package.completed_at = timezone.now()
        package.save(update_fields=['status', 'completed_at'])

        # Lock the engagement
        engagement.status = Engagement.STATUS_LOCKED
        engagement.locked_at = timezone.now()
        engagement.locked_by = request.user
        engagement.save(update_fields=['status', 'locked_at', 'locked_by'])

        # Finalize all tl_approved assignments
        DocumentAssignment.objects.filter(
            engagement=engagement,
            status=DocumentAssignment.STATUS_TL_APPROVED,
        ).update(status=DocumentAssignment.STATUS_FINALIZED)

        return Response(
            {
                'detail': f'Engagement {engagement.engagement_code} has been locked.',
                'engagement_status': engagement.status,
                'package_status': package.status,
                'export_package': 'placeholder',  # export generation hook
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# 7. UNLOCK ENGAGEMENT
# ─────────────────────────────────────────────────────────────

class UnlockEngagementView(APIView):
    """
    POST /api/reviews/engagements/<engagement_pk>/unlock/
    TSSU or Admin only — unlock engagement for corrections.

    Body: { reason: "..." }
    """

    permission_classes = [IsAuthenticated, IsTSSUOrAdmin]

    def post(self, request, engagement_pk):
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'detail': 'A reason is required to unlock an engagement.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            engagement = Engagement.objects.get(pk=engagement_pk)
        except Engagement.DoesNotExist:
            return Response({'detail': 'Engagement not found.'}, status=status.HTTP_404_NOT_FOUND)

        if engagement.status != Engagement.STATUS_LOCKED:
            return Response(
                {'detail': 'Engagement is not locked.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        engagement.status = Engagement.STATUS_ACTIVE
        engagement.locked_at = None
        engagement.locked_by = None
        engagement.save(update_fields=['status', 'locked_at', 'locked_by'])

        # Notify TL
        _notify(
            recipient=engagement.team_leader,
            notification_type=Notification.TYPE_COMMENT,
            tier=Notification.TIER_CRITICAL,
            title=f'Engagement unlocked: {engagement.engagement_code}',
            message=(
                f'{request.user.full_name} has unlocked engagement '
                f'{engagement.engagement_code} for corrections. '
                f'Reason: {reason}'
            ),
            engagement=engagement,
        )

        return Response(
            {
                'detail': f'Engagement {engagement.engagement_code} has been unlocked.',
                'engagement_status': engagement.status,
            },
            status=status.HTTP_200_OK,
        )
