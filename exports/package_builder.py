import os, io, zipfile
from pathlib import Path
from django.conf import settings
from .models import ExportPackage, TeamMateUploadChecklist, ExportSettings
from .excel_generator import WorkpaperExcelGenerator
from .word_generator import FindingsWordGenerator
from workpapers.models import Workpaper
from findings.models import Finding

class ExportPackageBuilder:
    def build(self, engagement, generated_by):
        pkg = ExportPackage.objects.create(engagement=engagement, generated_by=generated_by, status='generating')
        try:
            settings_obj = ExportSettings.objects.first()
            pattern = settings_obj.naming_pattern if settings_obj else '[EngagementCode]_[WorkpaperRef]_[EntityName]_[Year]'
            password = settings_obj.excel_password if settings_obj else ''

            excel_gen = WorkpaperExcelGenerator()
            findings_gen = FindingsWordGenerator()
            export_dir = Path(settings.EXPORT_ROOT) / str(engagement.engagement_code)
            export_dir.mkdir(parents=True, exist_ok=True)

            file_count = 0
            workpapers = Workpaper.objects.filter(engagement=engagement).select_related('document_type', 'created_by', 'last_updated_by')

            for wp in workpapers:
                file_name = self._build_filename(pattern, engagement, wp.document_type.workpaper_ref or wp.document_type.code, '.xlsx')
                try:
                    excel_bytes = excel_gen.generate(wp)
                    if password:
                        excel_bytes = excel_gen.protect_workbook(excel_bytes, password)
                    (export_dir / file_name).write_bytes(excel_bytes)
                    TeamMateUploadChecklist.objects.create(
                        export_package=pkg,
                        document_type=wp.document_type.code,
                        file_name=file_name,
                        teammate_ref=wp.document_type.workpaper_ref or ''
                    )
                    file_count += 1
                except Exception as e:
                    pass

            findings = Finding.objects.filter(engagement=engagement).exclude(status='dismissed').prefetch_related('risk_links__risk')
            if findings.exists():
                fname = self._build_filename('[EngagementCode]_FINDINGS_[EntityName]_[Year]', engagement, 'FINDINGS', '.docx')
                try:
                    (export_dir / fname).write_bytes(findings_gen.generate(engagement, list(findings)))
                    TeamMateUploadChecklist.objects.create(
                        export_package=pkg,
                        document_type='FINDINGS',
                        file_name=fname,
                        teammate_ref='FINDINGS'
                    )
                    file_count += 1
                except Exception:
                    pass

            pkg.package_path = str(export_dir)
            pkg.total_files = file_count
            pkg.status = 'ready'
            pkg.save()
        except Exception as e:
            pkg.status = 'error'
            pkg.error_message = str(e)[:500]
            pkg.save()
        return pkg

    def build_zip(self, export_package):
        buf = io.BytesIO()
        pkg_path = Path(export_package.package_path)
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in pkg_path.iterdir():
                if f.is_file():
                    zf.write(f, f.name)
        buf.seek(0)
        return buf.read()

    def _build_filename(self, pattern, engagement, wp_ref, ext):
        name = pattern
        name = name.replace('[EngagementCode]', engagement.engagement_code)
        name = name.replace('[WorkpaperRef]', str(wp_ref or 'WP'))
        name = name.replace('[EntityName]', engagement.entity.name[:20].replace(' ', '_'))
        name = name.replace('[Year]', str(engagement.audit_year))
        for c in r'\/:*?"<>|':
            name = name.replace(c, '_')
        return name + ext
