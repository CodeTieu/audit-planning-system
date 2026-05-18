from django.urls import path
from . import views

urlpatterns = [
    path('lookups/',            views.LookupValuesView.as_view(),       name='lookup_values'),
    path('lookups/categories/', views.LookupCategoryListView.as_view(), name='lookup_categories'),
]
