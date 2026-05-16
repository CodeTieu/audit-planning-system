"""Engagements app URL routing."""

from django.urls import path
from . import views

urlpatterns = [
    path('engagements/',
         views.EngagementListCreateView.as_view(),
         name='engagement_list'),

    path('engagements/<int:pk>/',
         views.EngagementDetailView.as_view(),
         name='engagement_detail'),

    path('engagements/<int:pk>/progress/',
         views.EngagementProgressView.as_view(),
         name='engagement_progress'),

    path('engagements/<int:engagement_id>/team/',
         views.EngagementTeamView.as_view(),
         name='engagement_team'),

    path('engagements/<int:engagement_id>/team/<int:member_id>/',
         views.EngagementTeamMemberView.as_view(),
         name='engagement_team_member'),

    path('engagements/<int:engagement_id>/documents/',
         views.DocumentAssignmentView.as_view(),
         name='engagement_documents'),

    path('engagements/<int:engagement_id>/documents/<int:doc_id>/',
         views.DocumentAssignmentDetailView.as_view(),
         name='engagement_document_detail'),

    path('document-types/',
         views.DocumentTypeListView.as_view(),
         name='document_type_list'),

    path('document-types/<int:pk>/',
         views.DocumentTypeDetailView.as_view(),
         name='document_type_detail'),
]
