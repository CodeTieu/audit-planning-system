"""
Management command: create_initial_users
Creates real staff accounts from the NAOT contacts data plus test accounts
for each role. Idempotent — safe to re-run.

Usage:
    python manage.py create_initial_users
    python manage.py create_initial_users --dry-run
"""

import re
import unicodedata
import openpyxl
from django.core.management.base import BaseCommand

NAOT_CONTACTS_PATH = r"C:/Users/kanza/WP Automation/NAOT_Contacts_Cleaned (1).xlsx"
DEFAULT_PASSWORD = "AuditPS@2024"


def slugify_name(full_name):
    """
    Convert 'Charles E. Kichere' -> 'charles.kichere'
    Takes first word and last word, strips punctuation, lowercases.
    """
    parts = full_name.strip().split()
    if len(parts) < 2:
        return full_name.strip().lower().replace(" ", ".")
    first = parts[0]
    last  = parts[-1]
    # Normalise unicode, remove non-ascii, strip punctuation
    def clean(s):
        s = unicodedata.normalize("NFKD", s)
        s = s.encode("ascii", "ignore").decode("ascii")
        s = re.sub(r"[^a-zA-Z0-9]", "", s)
        return s.lower()
    return f"{clean(first)}.{clean(last)}"


class Command(BaseCommand):
    help = "Create initial user accounts from NAOT contacts data (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without touching the database.",
        )

    def handle(self, *args, **options):
        from users.models import User, Division, SupervisionLink, RoleLevel

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no DB changes.\n"))

        stats = {
            "users_created": 0,
            "users_existed": 0,
            "supervision_created": 0,
            "supervision_existed": 0,
            "errors": [],
        }

        # ──────────────────────────────────────────────────────────
        # HELPER: create or retrieve a user
        # ──────────────────────────────────────────────────────────
        def make_user(username, full_name, email, role, division_obj):
            if dry_run:
                self.stdout.write(
                    f"    [DRY] Would create: {username:30s} | {full_name:35s} | "
                    f"role={role} | div={division_obj}"
                )
                stats["users_created"] += 1
                return None

            try:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "full_name": full_name,
                        "primary_role": role,
                        "division": division_obj,
                        "is_first_login": True,
                        "is_active": True,
                    },
                )
                if created:
                    user.set_password(DEFAULT_PASSWORD)
                    user.save(update_fields=["password"])
                    stats["users_created"] += 1
                    self.stdout.write(
                        f"    [NEW]    {username:30s} | {full_name:35s} | "
                        f"role={role}"
                    )
                else:
                    stats["users_existed"] += 1
                    self.stdout.write(
                        f"    [EXISTS] {username:30s} | {full_name}"
                    )
                return user
            except Exception as exc:
                msg = f"ERROR creating {username}: {exc}"
                self.stdout.write(self.style.ERROR(f"    {msg}"))
                stats["errors"].append(msg)
                return None

        # ──────────────────────────────────────────────────────────
        # HELPER: create supervision link
        # ──────────────────────────────────────────────────────────
        def link(supervisor, supervised):
            if supervisor is None or supervised is None:
                return
            if dry_run:
                self.stdout.write(
                    f"    [DRY] Supervision: {supervisor.username} -> {supervised.username}"
                    if supervisor and supervised
                    else "    [DRY] Supervision: (skipped — dry-run placeholder)"
                )
                stats["supervision_created"] += 1
                return
            try:
                _, created = SupervisionLink.objects.get_or_create(
                    supervisor=supervisor,
                    supervised=supervised,
                )
                if created:
                    stats["supervision_created"] += 1
                    self.stdout.write(
                        f"    [LINK NEW]    {supervisor.username} -> {supervised.username}"
                    )
                else:
                    stats["supervision_existed"] += 1
                    self.stdout.write(
                        f"    [LINK EXISTS] {supervisor.username} -> {supervised.username}"
                    )
            except Exception as exc:
                msg = f"ERROR linking {supervisor.username} -> {supervised.username}: {exc}"
                self.stdout.write(self.style.ERROR(f"    {msg}"))
                stats["errors"].append(msg)

        # ──────────────────────────────────────────────────────────
        # STEP 1 — Read the NAOT contacts Excel file
        # ──────────────────────────────────────────────────────────
        self.stdout.write("Reading NAOT contacts file …")
        try:
            wb = openpyxl.load_workbook(NAOT_CONTACTS_PATH, read_only=True, data_only=True)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(
                f"Cannot find contacts file: {NAOT_CONTACTS_PATH}\n"
                "Please check the path and re-run."
            ))
            return

        # ── Management Team sheet ──
        ws_mgmt = wb["Management Team"]
        mgmt_rows = list(ws_mgmt.iter_rows(values_only=True))

        # ── Regional Contacts sheet ──
        ws_reg = wb["Regional Contacts"]
        regional_rows = list(ws_reg.iter_rows(values_only=True))
        wb.close()

        self.stdout.write(
            f"  Management Team rows : {len(mgmt_rows) - 1} (excl. header)\n"
            f"  Regional Contact rows: {len(regional_rows) - 1} (excl. header)"
        )

        # ──────────────────────────────────────────────────────────
        # STEP 2 — MANAGEMENT TEAM
        # Division abbreviation -> L1 Division name stored in DB
        # (matches what import_entities.py creates)
        # ──────────────────────────────────────────────────────────
        ABBR_TO_DIV = {
            "LGA":         "LGA",
            "NA":          "NA",
            "PERFORMANCE": "Performance",
            "PA":          "PAD",
            "PAD":         "PAD",
            "MDA":         "MDA",
        }

        def get_l1_division(name):
            """Return L1 Division object or None."""
            if not name:
                return None
            try:
                return Division.objects.get(name=name, level=1)
            except Division.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f"    WARNING: L1 division '{name}' not found in DB — "
                    "run import_entities first."
                ))
                return None
            except Division.MultipleObjectsReturned:
                return Division.objects.filter(name=name, level=1).first()

        self.stdout.write("\n========== MANAGEMENT TEAM ==========")

        # Parse rows: skip header, skip blank rows
        # Columns: [0]=row_no?, [1]=Name, [2]=Title/Position, [3]=Division abbr
        cag_user = None
        dag_users = []   # list of (User, division_name)

        for row in mgmt_rows[1:]:
            # Skip completely blank rows
            if not any(row):
                continue

            name_raw  = str(row[1]).strip() if row[1] else ""
            title_raw = str(row[2]).strip() if row[2] else ""
            div_raw   = str(row[3]).strip() if row[3] else ""

            if not name_raw:
                continue

            username = slugify_name(name_raw)
            email    = f"{username}@audit.go.tz"
            div_name = ABBR_TO_DIV.get(div_raw.upper(), div_raw)
            div_obj  = None if not div_name else get_l1_division(div_name)

            title_upper = title_raw.upper()

            if "CAG" in title_upper or "CONTROLLER" in title_upper:
                self.stdout.write(f"  CAG: {name_raw}")
                cag_user = make_user(
                    username=username,
                    full_name=name_raw,
                    email=email,
                    role=RoleLevel.TSSU,
                    division_obj=None,
                )

            elif "DAG" in title_upper or "DEPUTY" in title_upper:
                self.stdout.write(f"  DAG: {name_raw} | Division: {div_name}")
                dag_user = make_user(
                    username=username,
                    full_name=name_raw,
                    email=email,
                    role=RoleLevel.DAG,
                    division_obj=div_obj,
                )
                dag_users.append((dag_user, div_name))

        # ──────────────────────────────────────────────────────────
        # STEP 3 — REGIONAL CONTACTS (CEAs)
        # Columns: [0]=row_no?, [1]=Name, [2]=Region, [3]=phone?, …
        # Each contact maps to an LGA sub-division (L3) by region name.
        # ──────────────────────────────────────────────────────────
        self.stdout.write("\n========== REGIONAL CONTACTS (CEAs) ==========")

        def get_lga_region_division(region_name):
            """
            Find the L3 Division that matches this region under LGA.
            The L3 division name typically equals the region name (e.g. 'Arusha').
            Falls back to L1 LGA if not found.
            """
            if not region_name:
                return get_l1_division("LGA")

            # Try exact match at level 3
            try:
                return Division.objects.get(name__iexact=region_name, level=3)
            except Division.DoesNotExist:
                pass
            except Division.MultipleObjectsReturned:
                return Division.objects.filter(name__iexact=region_name, level=3).first()

            # Try partial match at level 3
            qs = Division.objects.filter(name__icontains=region_name, level=3)
            if qs.exists():
                return qs.first()

            # Fall back to LGA L1
            self.stdout.write(self.style.WARNING(
                f"    WARNING: No L3 division found for region '{region_name}' — "
                "assigning to LGA L1."
            ))
            return get_l1_division("LGA")

        cea_users = []   # list of User objects

        for row in regional_rows[1:]:
            if not any(row):
                continue

            name_raw   = str(row[1]).strip() if row[1] else ""
            region_raw = str(row[2]).strip() if row[2] else ""

            if not name_raw:
                continue

            username = slugify_name(name_raw)
            email    = f"{username}@audit.go.tz"
            div_obj  = get_lga_region_division(region_raw)

            self.stdout.write(f"  CEA: {name_raw:35s} | Region: {region_raw}")
            cea_user = make_user(
                username=username,
                full_name=name_raw,
                email=email,
                role=RoleLevel.CEA,
                division_obj=div_obj,
            )
            if cea_user is not None:
                cea_users.append(cea_user)

        # ──────────────────────────────────────────────────────────
        # STEP 4 — TEST USERS (one per role)
        # ──────────────────────────────────────────────────────────
        self.stdout.write("\n========== TEST USERS ==========")

        # Resolve divisions for test users
        def get_div(name, level):
            try:
                return Division.objects.get(name__iexact=name, level=level)
            except Division.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f"    WARNING: Division '{name}' (L{level}) not found."
                ))
                return None
            except Division.MultipleObjectsReturned:
                return Division.objects.filter(name__iexact=name, level=level).first()

        lga_arusha_div = get_div("Arusha", 3)   # L3 under LGA
        lga_l1_div     = get_div("LGA", 1)

        test_users = [
            {
                "username": "test.auditor",
                "full_name": "Test Auditor",
                "email": "test.auditor@audit.go.tz",
                "role": RoleLevel.AUDITOR,
                "division": lga_arusha_div,
            },
            {
                "username": "test.teamleader",
                "full_name": "Test TeamLeader",
                "email": "test.teamleader@audit.go.tz",
                "role": RoleLevel.TEAM_LEADER,
                "division": lga_arusha_div,
            },
            {
                "username": "test.cea",
                "full_name": "Test CEA",
                "email": "test.cea@audit.go.tz",
                "role": RoleLevel.CEA,
                "division": lga_arusha_div,
            },
            {
                "username": "test.aag",
                "full_name": "Test AAG",
                "email": "test.aag@audit.go.tz",
                "role": RoleLevel.AAG,
                "division": lga_l1_div,
            },
            {
                "username": "test.tssu",
                "full_name": "Test TSSU",
                "email": "test.tssu@audit.go.tz",
                "role": RoleLevel.TSSU,
                "division": None,
            },
        ]

        test_user_objs = []
        for td in test_users:
            u = make_user(
                username=td["username"],
                full_name=td["full_name"],
                email=td["email"],
                role=td["role"],
                division_obj=td["division"],
            )
            test_user_objs.append(u)

        # ──────────────────────────────────────────────────────────
        # STEP 5 — SUPERVISION LINKS
        # CAG -> each DAG
        # LGA DAG -> each LGA CEA
        # ──────────────────────────────────────────────────────────
        self.stdout.write("\n========== SUPERVISION LINKS ==========")

        # CAG supervises all DAGs
        for dag_user, _ in dag_users:
            link(cag_user, dag_user)

        # Identify the LGA DAG
        lga_dag = None
        for dag_user, div_name in dag_users:
            if div_name and div_name.upper() == "LGA":
                lga_dag = dag_user
                break

        # LGA DAG supervises all LGA CEAs
        if lga_dag:
            self.stdout.write(f"\n  LGA DAG ({lga_dag.username if lga_dag else 'N/A'}) -> all CEAs:")
            for cea_user in cea_users:
                link(lga_dag, cea_user)
        else:
            self.stdout.write(self.style.WARNING(
                "  WARNING: LGA DAG not found — cannot create CEA supervision links."
            ))

        # ──────────────────────────────────────────────────────────
        # SUMMARY
        # ──────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("\n========== SUMMARY =========="))
        self.stdout.write(f"  Users created   : {stats['users_created']}")
        self.stdout.write(f"  Users existed   : {stats['users_existed']}")
        self.stdout.write(f"  Supervision new : {stats['supervision_created']}")
        self.stdout.write(f"  Supervision dup : {stats['supervision_existed']}")

        self.stdout.write("\n  DAGs with divisions:")
        for dag_user, div_name in dag_users:
            uname = dag_user.username if dag_user else "(dry-run)"
            self.stdout.write(f"    {uname:30s} -> {div_name}")

        self.stdout.write(f"\n  CEAs created: {len(cea_users)}")

        self.stdout.write("\n  Test users:")
        for td in test_users:
            self.stdout.write(f"    {td['username']:25s} role={td['role']}")

        if stats["errors"]:
            self.stdout.write(self.style.ERROR(f"\n  ERRORS ({len(stats['errors'])}):" ))
            for e in stats["errors"]:
                self.stdout.write(self.style.ERROR(f"    - {e}"))
        else:
            self.stdout.write(self.style.SUCCESS("\n  No errors."))
