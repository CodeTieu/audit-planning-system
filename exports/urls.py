from django.urls import path
from . import views

urlpatterns = [
    path('exports/', views.ExportPackageListView.as_view()),
    path('exports/generate/', views.GenerateExportView.as_view()),
    path('exports/settings/', views.ExportSettingsView.as_view()),
    path('exports/packages/<int:pk>/download/', views.DownloadZipView.as_view()),
    path('exports/checklist/<int:pk>/', views.MarkUploadedView.as_view()),
]
