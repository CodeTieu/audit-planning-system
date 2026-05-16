"""
Management command: import_entities
Reads the Audit Universe Excel file and NAOT Contacts file, then
populates Division, EntityType, and Entity tables idempotently.

Usage:
    python manage.py import_entities
    python manage.py import_entities --dry-run
"""

import re
import openpyxl
from django.core.management.base import BaseCommand

AUDIT_UNIVERSE_PATH = r"C:/Users/kanza/WP Automation/Audit Universe 2025-26_UPDATED.xlsx"
NAOT_CONTACTS_PATH  = r"C:/Users/kanza/WP Automation/NAOT_Contacts_Cleaned (1).xlsx"

AUDIT_SHEET = "Database 25"


def normalise(val):
    """Strip and title-case a string, or return None."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def normalise_report_type(val):
    """Return a canonical report-type name (handle case/spacing variants)."""
    if val is None:
        return None
    s = str(val).strip()
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s)
    # Map known variants to canonical
    mapping = {
        "main":       "MAIN",
        "Main":       "MAIN",
        "MAIN":       "MAIN",
        "Main - HPC": "MAIN-HPC",
        "main - HPC": "MAIN-HPC",
        "Project - HPC": "PROJECT-HPC",
    }
    return mapping.get(s, s)


class Command(BaseCommand):
    help = "Import Division hierarchy, EntityTypes, and Entities from Excel files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without touching the database.",
        )

    def handle(self, *args, **options):
        from users.models import Division
        from entities.models import EntityType, Entity

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no DB changes.\n"))

        # ──────────────────────────────────────────────────────────
        # STEP 1 — Read the Audit Universe sheet
        # ──────────────────────────────────────────────────────────
        self.stdout.write("Reading Audit Universe …")
        wb = openpyxl.load_workbook(AUDIT_UNIVERSE_PATH, read_only=True, data_only=True)
        ws = wb[AUDIT_SHEET]
        rows = list(ws.iter_rows(values_only=True))
        wb.close()

        # Row 0 is the header
        # Columns: Division | Sectors | Sub-Sector/Region/Theme | Reported entity | Report type | Responsible CEA/TL
        data_rows = rows[1:]
        self.stdout.write(f"  Found {len(data_rows)} data rows.\n")

        # ──────────────────────────────────────────────────────────
        # STEP 2 — Build the 3-level Division hierarchy from the sheet
        # ──────────────────────────────────────────────────────────
        # Level 1: Division column  (LGA, MDA, NA, PAD, Performance)
        # Level 2: Sectors column
        # Level 3: Sub-Sector/Region/Theme column
        #
        # We also normalise some obvious typos so we don't create duplicates.
        DIVISION_ALIASES = {
            "PAD": "PAD",   # keep as-is (contacts sheet uses PA — we map there separately)
        }

        SECTOR_ALIASES = {
            "Central zone":        "Central Zone",
            "Coastal zone":        "Coastal Zone",
            "Lake zone":           "Lake Zone",
            "Nothern Zone":        "Northern Zone",   # typo fix
            "Souther Highlands":   "Southern Highlands",  # typo fix
            "Regulatory Authorities": "Regulatory Bodies",
        }

        SUBSECTOR_ALIASES = {
            "singida": "Singida",
            "tanga":   "Tanga",
        }

        # Collect (division, sector, subsector) tuples
        hierarchy = {}  # div -> {sector -> set(subsector)}
        for row in data_rows:
            div_raw = normalise(row[0])
            sec_raw = normalise(row[1])
            sub_raw = normalise(row[2])

            if not div_raw:
                continue

            div = DIVISION_ALIASES.get(div_raw, div_raw)
            sec = SECTOR_ALIASES.get(sec_raw, sec_raw) if sec_raw else None
            sub = SUBSECTOR_ALIASES.get(sub_raw, sub_raw) if sub_raw else None

            if div not in hierarchy:
                hierarchy[div] = {}
            if sec:
                if sec not in hierarchy[div]:
                    hierarchy[div][sec] = set()
                if sub:
                    hierarchy[div][sec].add(sub)

        # ──────────────────────────────────────────────────────────
        # STEP 3 — Upsert Divisions
        # ──────────────────────────────────────────────────────────
        div_l1_created = div_l2_created = div_l3_created = 0
        div_l1_map = {}   # name -> Division instance
        div_l2_map = {}   # (parent_name, name) -> Division instance
        div_l3_map = {}   # (l2_name, name) -> Division instance

        self.stdout.write("\n--- Division Hierarchy ---")
        for div_name in sorted(hierarchy):
            code_l1 = div_name.upper().replace(" ", "_")[:30]
            if not dry_run:
                obj_l1, created_l1 = Division.objects.get_or_create(
                    code=code_l1,
                    defaults={"name": div_name, "level": 1, "is_active": True},
                )
                if created_l1:
                    div_l1_created += 1
            else:
                created_l1 = True
                div_l1_created += 1
                obj_l1 = None
            div_l1_map[div_name] = obj_l1

            self.stdout.write(f"  [L1] {div_name}  (code={code_l1}) {'[NEW]' if created_l1 else '[exists]'}")

            for sec_name in sorted(hierarchy[div_name]):
                code_l2 = f"{code_l1}__{sec_name.upper().replace(' ', '_').replace('/', '_')}"[:30]
                if not dry_run:
                    obj_l2, created_l2 = Division.objects.get_or_create(
                        code=code_l2,
                        defaults={
                            "name": sec_name,
                            "parent": obj_l1,
                            "level": 2,
                            "is_active": True,
                        },
                    )
                    if created_l2:
                        div_l2_created += 1
                else:
                    created_l2 = True
                    div_l2_created += 1
                    obj_l2 = None
                div_l2_map[(div_name, sec_name)] = obj_l2

                self.stdout.write(f"      [L2] {sec_name}  (code={code_l2}) {'[NEW]' if created_l2 else '[exists]'}")

                for sub_name in sorted(hierarchy[div_name][sec_name]):
                    code_l3 = f"{code_l2}__{sub_name.upper().replace(' ', '_').replace('/', '_').replace('-', '_')}"[:30]
                    if not dry_run:
                        obj_l3, created_l3 = Division.objects.get_or_create(
                            code=code_l3,
                            defaults={
                                "name": sub_name,
                                "parent": obj_l2,
                                "level": 3,
                                "is_active": True,
                            },
                        )
                        if created_l3:
                            div_l3_created += 1
                    else:
                        created_l3 = True
                        div_l3_created += 1
                        obj_l3 = None
                    div_l3_map[(sec_name, sub_name)] = obj_l3

        self.stdout.write(
            f"\nDivisions created — L1: {div_l1_created}, "
            f"L2: {div_l2_created}, L3: {div_l3_created}"
        )

        # ──────────────────────────────────────────────────────────
        # STEP 4 — Upsert EntityTypes from Report type column
        # ──────────────────────────────────────────────────────────
        raw_types = set()
        for row in data_rows:
            rt = normalise_report_type(row[4])
            if rt:
                raw_types.add(rt)

        et_created = 0
        entity_type_map = {}   # canonical_name -> EntityType instance

        self.stdout.write("\n--- Entity Types ---")
        for rt in sorted(raw_types):
            code = rt.upper().replace(" ", "_").replace("-", "_")[:20]
            if not dry_run:
                obj, created = EntityType.objects.get_or_create(
                    code=code,
                    defaults={"name": rt, "is_active": True},
                )
                if created:
                    et_created += 1
            else:
                created = True
                et_created += 1
                obj = None
            entity_type_map[rt] = obj
            self.stdout.write(f"  {rt}  (code={code}) {'[NEW]' if created else '[exists]'}")

        self.stdout.write(f"\nEntityTypes created: {et_created}")

        # ──────────────────────────────────────────────────────────
        # STEP 5 — Upsert Entities
        # ──────────────────────────────────────────────────────────
        entity_created = entity_skipped = entity_errors = 0
        # We need a unique code per entity. We'll use a slug from the name.
        # Format: {DIV_CODE}-{seq:04d}
        # But we want idempotent, so we derive a stable code from name.

        def make_entity_code(name, division_code):
            """Build a deterministic ≤30-char code from name + division_code."""
            slug = re.sub(r"[^A-Z0-9]", "", name.upper())[:15]
            div_slug = (division_code or "NODIV")[:10]
            return f"{div_slug}-{slug}"[:30]

        self.stdout.write("\n--- Importing Entities (this may take a moment) …")

        SECTOR_ALIASES_REV = {v: v for v in SECTOR_ALIASES.values()}  # canonical set
        SECTOR_ALIASES_REV.update(SECTOR_ALIASES)

        for idx, row in enumerate(data_rows, start=2):
            div_raw = normalise(row[0])
            sec_raw = normalise(row[1])
            sub_raw = normalise(row[2])
            name    = normalise(row[3])
            rt_raw  = normalise_report_type(row[4])

            if not name:
                entity_skipped += 1
                continue
            if not rt_raw:
                self.stdout.write(
                    self.style.WARNING(f"  Row {idx}: '{name}' has no Report type — skipping.")
                )
                entity_skipped += 1
                continue

            # Resolve division (prefer L3 > L2 > L1)
            div_obj = None
            if not dry_run:
                div_name = DIVISION_ALIASES.get(div_raw, div_raw) if div_raw else None
                sec_name = SECTOR_ALIASES_REV.get(sec_raw, sec_raw) if sec_raw else None
                sub_name_resolved = SUBSECTOR_ALIASES.get(sub_raw, sub_raw) if sub_raw else None

                if sec_name and sub_name_resolved:
                    div_obj = div_l3_map.get((sec_name, sub_name_resolved))
                if div_obj is None and div_name and sec_name:
                    div_obj = div_l2_map.get((div_name, sec_name))
                if div_obj is None and div_name:
                    div_obj = div_l1_map.get(div_name)

            et_obj = entity_type_map.get(rt_raw)

            div_code_for_slug = (
                div_obj.code if div_obj else (div_raw or "NODIV")
            )
            entity_code = make_entity_code(name, div_code_for_slug)

            if not dry_run:
                try:
                    _, created = Entity.objects.get_or_create(
                        code=entity_code,
                        defaults={
                            "name": name,
                            "entity_type": et_obj,
                            "division": div_obj,
                            "is_active": True,
                        },
                    )
                    if created:
                        entity_created += 1
                    else:
                        entity_skipped += 1
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"  Row {idx}: ERROR saving '{name}': {e}")
                    )
                    entity_errors += 1
            else:
                entity_created += 1

        self.stdout.write(
            f"\nEntities — created: {entity_created}, "
            f"already existed / skipped: {entity_skipped}, "
            f"errors: {entity_errors}"
        )

        # ──────────────────────────────────────────────────────────
        # STEP 6 — NAOT Management Team (DAG mapping)
        # ──────────────────────────────────────────────────────────
        self.stdout.write("\n--- NAOT Management Team (DAG -> Division mapping) ---")
        wb2 = openpyxl.load_workbook(NAOT_CONTACTS_PATH, read_only=True, data_only=True)
        ws_mgmt = wb2["Management Team"]
        mgmt_rows = list(ws_mgmt.iter_rows(values_only=True))
        wb2_regional = openpyxl.load_workbook(NAOT_CONTACTS_PATH, read_only=True, data_only=True)
        ws_regional = wb2_regional["Regional Contacts"]
        regional_rows = list(ws_regional.iter_rows(values_only=True))

        # DAG mapping: contacts sheet column 3 is the division abbreviation
        dag_plan = []
        for row in mgmt_rows[1:]:   # skip header
            if not row[1]:
                continue
            name  = str(row[1]).strip()
            title = str(row[2]).strip() if row[2] else ""
            div_abbr = str(row[3]).strip() if row[3] else ""

            # Map abbreviation to L1 Division name used in DB
            abbr_to_div = {
                "LGA":         "LGA",
                "NA":          "NA",
                "PERFORMANCE": "Performance",
                "PA":          "PAD",
                "MDA":         "MDA",
            }
            div_db_name = abbr_to_div.get(div_abbr, div_abbr)

            dag_plan.append({
                "name": name,
                "title": title,
                "division_abbr": div_abbr,
                "division_db": div_db_name,
            })

            self.stdout.write(
                f"  {name:35s} | {title:55s} | Division: {div_db_name}"
            )

        self.stdout.write("\n  USER CREATION PLAN (DAG accounts):")
        for p in dag_plan:
            username = p["name"].split()[0].lower() + "." + p["name"].split()[-1].lower()
            self.stdout.write(
                f"    username={username:25s}  full_name='{p['name']}'  "
                f"role=DAG  division={p['division_db']}"
            )

        # ──────────────────────────────────────────────────────────
        # STEP 7 — Regional Contacts mapping
        # ──────────────────────────────────────────────────────────
        self.stdout.write("\n--- Regional Contacts (name -> region/division) ---")
        regional_plan = []
        for row in regional_rows[1:]:
            if not row[1]:
                continue
            name   = str(row[1]).strip()
            region = str(row[2]).strip() if row[2] else ""
            regional_plan.append({"name": name, "region": region})
            self.stdout.write(f"  {name:35s} | Region/Sub-office: {region}")

        self.stdout.write("\n  USER CREATION PLAN (Regional Contacts):")
        for p in regional_plan:
            username = p["name"].split()[0].lower() + "." + p["name"].split()[-1].lower()
            # Regional contacts are under LGA division (they manage LGA audits by region)
            self.stdout.write(
                f"    username={username:28s}  full_name='{p['name']}'  "
                f"role=CEA/TL  region={p['region']}  division=LGA"
            )

        # ──────────────────────────────────────────────────────────
        # SUMMARY
        # ──────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("\n========== IMPORT COMPLETE =========="))
        self.stdout.write(f"  Divisions created  — L1: {div_l1_created}, L2: {div_l2_created}, L3: {div_l3_created}")
        self.stdout.write(f"  EntityTypes created: {et_created}")
        self.stdout.write(f"  Entities created   : {entity_created}")
        self.stdout.write(f"  Entities skipped   : {entity_skipped}")
        if entity_errors:
            self.stdout.write(self.style.ERROR(f"  Errors             : {entity_errors}"))
        self.stdout.write(f"  DAG accounts planned: {len(dag_plan)}")
        self.stdout.write(f"  Regional contacts planned: {len(regional_plan)}")
