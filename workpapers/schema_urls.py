"""
Schema-related URL routes (mounted under /api/workpapers/).
Kept separate from workpapers/urls.py so the schema layer can evolve
independently of the existing CRUD endpoints.
"""

from django.urls import path
from . import schema_views

urlpatterns = [
    path('schemas/',            schema_views.SchemaListView.as_view(),  name='schema_list'),
    path('schema/<str:code>/',  schema_views.SchemaDetailView.as_view(), name='schema_detail'),
]
