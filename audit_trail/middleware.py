"""
AuditTrailMiddleware — logs all POST/PATCH/PUT/DELETE requests to AuditLog.
"""

import json
import re
import logging

logger = logging.getLogger(__name__)

WRITE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# Fields whose values should be redacted from logged request bodies
SENSITIVE_KEYS = {'password', 'password1', 'password2', 'old_password', 'new_password', 'token', 'secret'}

# Regex to pull a numeric ID from the end of a URL path segment
_RECORD_ID_RE = re.compile(r'/(\d+)/?(?:\w+/?)*$')

# Map URL path prefixes to human-readable table names
_PATH_TABLE_MAP = [
    (re.compile(r'^/api/users/'),         'users'),
    (re.compile(r'^/api/entities/entity-types/'), 'entity_types'),
    (re.compile(r'^/api/entities/'),      'entities'),
    (re.compile(r'^/api/engagements/\d+/team/'),        'engagement_team'),
    (re.compile(r'^/api/engagements/\d+/documents/'),   'document_assignments'),
    (re.compile(r'^/api/engagements/\d+/progress/'),    'engagement_progress'),
    (re.compile(r'^/api/engagements/'),   'engagements'),
    (re.compile(r'^/api/document-types/'), 'document_types'),
    (re.compile(r'^/api/supervision/'),   'supervision'),
    (re.compile(r'^/api/divisions/'),     'divisions'),
    (re.compile(r'^/api/'),               'api'),
]


def _infer_table_name(path: str) -> str:
    for pattern, name in _PATH_TABLE_MAP:
        if pattern.match(path):
            return name
    return path.strip('/').replace('/', '_') or 'unknown'


def _extract_record_id(path: str) -> str:
    match = _RECORD_ID_RE.search(path)
    return match.group(1) if match else ''


def _get_client_ip(request) -> str | None:
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _sanitize_body(body_bytes: bytes) -> dict | None:
    if not body_bytes:
        return None
    try:
        data = json.loads(body_bytes.decode('utf-8', errors='replace'))
        if isinstance(data, dict):
            return {
                k: ('***' if k.lower() in SENSITIVE_KEYS else v)
                for k, v in data.items()
            }
        return data
    except (json.JSONDecodeError, ValueError):
        return None


class AuditTrailMiddleware:
    """
    Logs write requests (POST/PUT/PATCH/DELETE) to the AuditLog model.

    Runs *after* the response is produced so it doesn't delay the response.
    Uses Django's process_response hook rather than process_request to avoid
    logging requests that are rejected before authentication.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Buffer request body before the view consumes it
        if request.method in WRITE_METHODS:
            try:
                body_bytes = request.body  # noqa: reading body here buffers it
            except Exception:
                body_bytes = b''
        else:
            body_bytes = b''

        response = self.get_response(request)

        if request.method in WRITE_METHODS:
            self._log(request, body_bytes)

        return response

    def _log(self, request, body_bytes: bytes):
        try:
            from .models import AuditLog  # local import to avoid circular imports at startup

            user = request.user if request.user.is_authenticated else None
            AuditLog.objects.create(
                user=user,
                action=request.method,
                table_name=_infer_table_name(request.path),
                record_id=_extract_record_id(request.path),
                ip_address=_get_client_ip(request),
                request_body=_sanitize_body(body_bytes),
            )
        except Exception as exc:
            # Never let audit logging break the main request
            logger.exception('AuditTrailMiddleware failed to write log: %s', exc)
