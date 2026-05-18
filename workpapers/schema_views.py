"""
Schema endpoints — expose workpaper JSON schemas to the frontend.
"""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .schema_loader import get_schema, list_available_codes


class SchemaDetailView(APIView):
    """GET /api/workpapers/schema/<code>/  — returns the JSON schema for a workpaper."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code):
        schema = get_schema(code.upper())
        if schema is None:
            return Response({'detail': f'No schema for {code}'}, status=404)
        return Response(schema)


class SchemaListView(APIView):
    """GET /api/workpapers/schemas/  — list available workpaper codes with schemas."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        codes = list_available_codes()
        # Include titles for convenience
        items = []
        for c in codes:
            s = get_schema(c)
            items.append({
                'code': c,
                'title': s.get('title') if s else c,
                'version': s.get('version') if s else 1,
            })
        return Response(items)
