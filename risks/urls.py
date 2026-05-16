"""Risks app URL routing."""

from django.urls import path
from . import views

urlpatterns = [
    path('risks/',                  views.RiskListView.as_view(),    name='risk_list'),
    path('risks/summary/',          views.risk_summary,              name='risk_summary'),
    path('risks/<int:pk>/',         views.RiskDetailView.as_view(),  name='risk_detail'),
    path('risks/<int:pk>/dismiss/', views.RiskDismissView.as_view(), name='risk_dismiss'),
    path('risks/<int:pk>/restore/', views.RiskRestoreView.as_view(), name='risk_restore'),
]
