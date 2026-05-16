"""
Reviews app URL configuration.
"""

from django.urls import path
from . import views

urlpatterns = [
    # TL document-by-document review
    path('tl-review/', views.TLDocumentReviewView.as_view(), name='tl-document-review'),

    # Submit full package to CEA
    path('submit-package/', views.SubmitPackageView.as_view(), name='submit-package'),

    # Package list for an engagement
    path('packages/', views.ReviewPackageListView.as_view(), name='package-list'),

    # Packages pending the current user's review
    path('my-pending/', views.MyPendingPackagesView.as_view(), name='my-pending-packages'),

    # Package detail (with documents + review history)
    path('packages/<int:pk>/', views.GetPackageDetailView.as_view(), name='package-detail'),

    # Reviewer approve/return action
    path('packages/<int:pk>/action/', views.ReviewActionView.as_view(), name='package-action'),

    # Manually lock an engagement (TSSU/Admin)
    path('packages/<int:pk>/lock/', views.LockEngagementView.as_view(), name='package-lock'),

    # Unlock an engagement (TSSU/Admin)
    path('engagements/<int:engagement_pk>/unlock/', views.UnlockEngagementView.as_view(), name='engagement-unlock'),
]
