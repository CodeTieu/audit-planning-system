"""Entities app URL routing."""

from django.urls import path
from . import views

urlpatterns = [
    path('entity-types/',       views.EntityTypeListCreateView.as_view(), name='entity_type_list'),
    path('entity-types/<int:pk>/', views.EntityTypeDetailView.as_view(), name='entity_type_detail'),
    path('entities/',           views.EntityListCreateView.as_view(),    name='entity_list'),
    path('entities/<int:pk>/',  views.EntityDetailView.as_view(),        name='entity_detail'),
]
