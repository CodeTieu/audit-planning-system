"""
ASGI configuration for the Audit Planning System.
Supports both HTTP (Django) and WebSocket (Django Channels) connections.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Initialise Django's WSGI application first so that apps are loaded before
# importing channels routing (which imports models).
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.auth import AuthMiddlewareStack               # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

# Import app-level WebSocket URL patterns when they exist.
# Each app should expose a `websocket_urlpatterns` list in a routing.py module.
websocket_urlpatterns = []

try:
    from notifications.routing import websocket_urlpatterns as notifications_ws
    websocket_urlpatterns += notifications_ws
except ImportError:
    pass

application = ProtocolTypeRouter({
    # Standard HTTP requests handled by Django
    'http': django_asgi_app,

    # WebSocket connections wrapped in JWT/session auth
    'websocket': AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
