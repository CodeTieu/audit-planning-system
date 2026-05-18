"""
URL configuration for the Audit Planning System.
All app URLs are mounted under the /api/ prefix.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # ── API routes ────────────────────────────────────────────
    path('api/', include('users.urls')),
    path('api/', include('entities.urls')),
    path('api/', include('engagements.urls')),
    path('api/', include('workpapers.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('risks.urls')),
    path('api/', include('findings.urls')),
    path('api/reviews/', include('reviews.urls')),
    path('api/', include('exports.urls')),
    path('api/', include('lookups.urls')),
    path('api/workpapers/', include('workpapers.schema_urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
