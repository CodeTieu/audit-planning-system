from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from django.utils import timezone
from .models import ExportPackage, ExportSettings, TeamMateUploadChecklist
from .package_builder import ExportPackageBuilder
from engagements.models import Engagement


class GenerateExportView(APIView):
    def post(self, request):
        eng_id = request.data.get('engagement_id')
        try:
            eng = Engagement.objects.select_related('entity').get(id=eng_id)
        except Engagement.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        pkg = ExportPackageBuilder().build(eng, request.user)
        checklist = list(pkg.checklist_items.values('id', 'document_type', 'file_name', 'teammate_ref', 'uploaded'))
        return Response({'id': pkg.id, 'status': pkg.status, 'total_files': pkg.total_files, 'checklist': checklist})


class DownloadZipView(APIView):
    def get(self, request, pk):
        try:
            pkg = ExportPackage.objects.get(pk=pk)
        except ExportPackage.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        zip_bytes = ExportPackageBuilder().build_zip(pkg)
        resp = HttpResponse(zip_bytes, content_type='application/zip')
        resp['Content-Disposition'] = f'attachment; filename="{pkg.engagement.engagement_code}_package.zip"'
        return resp


class MarkUploadedView(APIView):
    def patch(self, request, pk):
        try:
            item = TeamMateUploadChecklist.objects.get(pk=pk)
        except TeamMateUploadChecklist.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        item.uploaded = request.data.get('uploaded', True)
        if item.uploaded:
            item.uploaded_by = request.user
            item.uploaded_at = timezone.now()
        item.save()
        return Response({'id': item.id, 'uploaded': item.uploaded})


class ExportPackageListView(APIView):
    def get(self, request):
        eng_id = request.query_params.get('engagement')
        if not eng_id:
            return Response([])
        pkgs = ExportPackage.objects.filter(engagement_id=eng_id).order_by('-generated_at')
        data = []
        for pkg in pkgs:
            data.append({
                'id': pkg.id,
                'status': pkg.status,
                'total_files': pkg.total_files,
                'generated_at': pkg.generated_at,
                'package_path': pkg.package_path,
                'generated_by': pkg.generated_by.full_name if pkg.generated_by else None,
                'checklist': list(pkg.checklist_items.values('id', 'document_type', 'file_name', 'teammate_ref', 'uploaded', 'uploaded_at'))
            })
        return Response(data)


class ExportSettingsView(APIView):
    def get(self, request):
        s = ExportSettings.objects.first() or ExportSettings()
        return Response({
            'naming_pattern': s.naming_pattern or '[EngagementCode]_[WorkpaperRef]_[EntityName]_[Year]',
            'excel_password': ''
        })

    def patch(self, request):
        s = ExportSettings.objects.first()
        if not s:
            s = ExportSettings.objects.create()
        if 'naming_pattern' in request.data:
            s.naming_pattern = request.data['naming_pattern']
        if 'excel_password' in request.data:
            s.excel_password = request.data['excel_password']
        s.updated_by = request.user
        s.save()
        return Response({'naming_pattern': s.naming_pattern})
