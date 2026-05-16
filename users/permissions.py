"""
Custom DRF permission classes for the Audit Planning System.
"""

from rest_framework.permissions import BasePermission
from .models import RoleLevel


class IsAdmin(BasePermission):
    """Only system administrators."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.primary_role == RoleLevel.ADMIN
        )


class IsAdminOrSelf(BasePermission):
    """Admin or the user viewing/editing their own record."""
    def has_object_permission(self, request, view, obj):
        return (
            request.user.primary_role == RoleLevel.ADMIN or
            obj == request.user
        )


class IsTeamLeaderOrAbove(BasePermission):
    """Team Leader and all roles above."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.primary_role >= RoleLevel.TEAM_LEADER
        )


class IsCEAOrAbove(BasePermission):
    """CEA and all roles above (CEA, AAG, DAG, TSSU, Admin)."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.primary_role >= RoleLevel.CEA or
             request.user.primary_role == RoleLevel.ADMIN)
        )


class IsTSSUOrAdmin(BasePermission):
    """TSSU and Admin only — for final approval and full visibility."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.can_see_all
        )


class IsEngagementTeamMember(BasePermission):
    """
    Checks that the requesting user is a member of the engagement's team.
    Used for workpaper access control.
    """
    def has_object_permission(self, request, view, obj):
        # obj is an Engagement instance
        if request.user.can_see_all:
            return True
        from engagements.models import EngagementTeam
        return EngagementTeam.objects.filter(
            engagement=obj,
            user=request.user
        ).exists()


class CanReviewEngagement(BasePermission):
    """
    User is in the review chain for this engagement at the current level.
    The detailed level check happens in the view itself.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.primary_role >= RoleLevel.TEAM_LEADER
        )
