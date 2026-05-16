"""
Management command: import_cea_users
Reads the Audit Universe Excel file and imports all unique CEA/TL names,
creates user accounts for new ones, and assigns responsible_person on Entity rows.

Usage:
    python manage.py import_cea_users
    python manage.py import_cea_users --dry-run
"""

import re
import unicodedata
from collections import defaultdict

import openpyxl
from django.core.management.base import BaseCommand

AUDIT_UNIVERSE_PATH = r"C:/Users/kanza/WP Automation/Audit Universe 2025-26_UPDATED.xlsx"
AUDIT_SHEET = "Database 25"
DEFAULT_PASSWORD = "AuditPS@2024"

# Known existing users (already imported from NAOT contacts).
# Fuzzy match will catch them, but listing explicitly helps documentation.
KNOWN_EXISTING_NAMES = [
    "Valence Rutakyamirwa", "Karim Mwinyimbeu", "Richson Ringo", "Lenatusi Leonard",
    "Fahad Masanja", "Godwin Rubara", "Chambi Ngeleja", "Wenzeslaus Nyalusi",
    "Honest Murya", "Hamza Zonga", "Gerald Mashingia", "Paschal Mabwago",
    "Deogratius Mtenga", "Mary Dibogo", "Anselm Tairo", "Andinile Mwabwanga",
    "Michael Magange", "Thomas Mhanga", "Hamuk Mwakosola", "Willy Undule",
]

# Separators for compound CEA/TL entries
NAME_SPLIT_RE = re.compile(r"\s*(?:,|&|/|\band\b)\s*", re.IGNORECASE)


def normalise(val):
    """Strip a cell value, return None if blank."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def slugify_name(full_name):
    """
    'Charles E. Kichere' -> 'charles.kichere'
    Takes first and last word, strips non-ascii punctuation.
    """
    parts = full_name.strip().split()
    if len(parts) < 2:
        return full_name.strip().lower().replace(" ", ".")

    def clean(s):
        s = unicodedata.normalize("NFKD", s)
        s = s.encode("ascii", "ignore").decode("ascii")
        s = re.sub(r"[^a-zA-Z0-9]", "", s)
        return s.lower()

    return f"{clean(parts[0])}.{clean(parts[-1])}"


def fuzzy_key(name):
    """
    Build a fuzzy key for deduplication:
    first_name_lower + first4_of_last_name_lower.
    E.g. 'John Doe' -> 'johndoe_'
    """
    parts = name.strip().split()
    if not parts:
        return ""
    first = re.sub(r"[^a-z]", "", parts[0].lower())
    last  = re.sub(r"[^a-z]", "", parts[-1].lower())[:4]
    return f"{first}_{last}"


def split_cea_names(raw):
    """
    Split a compound CEA/TL cell into individual names.
    E.g. 'Kelvin Amos, Alfa Stanley & Chausiku Maro' -> ['Kelvin Amos', 'Alfa Stanley', 'Chausiku Maro']
    """
    parts = NAME_SPLIT_RE.split(raw)
    result = []
    for p in parts:
        p = p.strip()
        if p:
            result.append(p)
    return result


class Command(BaseCommand):
    help = "Import CEA/TL names from Audit Universe and create user accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without touching the database.",
        )

    def handle(self, *args, **options):
        from users.models import User, Division, RoleLevel
        from entities.models import Entity

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN -- no DB changes.\n"))

        # ──────────────────────────────────────────────────────────
        # STEP 1 -- Read the Audit Universe Excel file
        # ──────────────────────────────────────────────────────────
        self.stdout.write("Reading Audit Universe …")
        try:
            wb = openpyxl.load_workbook(AUDIT_UNIVERSE_PATH, read_only=True, data_only=True)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(
                f"Cannot find file: {AUDIT_UNIVERSE_PATH}"
            ))
            return

        ws = wb[AUDIT_SHEET]
        rows = list(ws.iter_rows(values_only=True))
        wb.close()

        data_rows = rows[1:]   # skip header row
        self.stdout.write(f"  Found {len(data_rows)} data rows.\n")

        # ──────────────────────────────────────────────────────────
        # STEP 2 -- Extract unique CEA/TL names and build per-name
        #           division data
        # ──────────────────────────────────────────────────────────
        # Map: cea_name -> list of (division_l1, sector, sub_sector) tuples
        cea_division_data = defaultdict(list)
        # Map: cea_name -> list of entity_names
        cea_entity_map = defaultdict(list)

        raw_cea_count = 0  # includes duplicates / compounds

        for row in data_rows:
            div_raw = normalise(row[0])
            sec_raw = normalise(row[1])
            sub_raw = normalise(row[2])
            entity_name = normalise(row[3])
            cea_raw = normalise(row[5])

            if not cea_raw:
                continue

            individual_names = split_cea_names(cea_raw)
            raw_cea_count += len(individual_names)

            for name in individual_names:
                name = name.strip()
                if not name:
                    continue
                cea_division_data[name].append((div_raw, sec_raw, sub_raw))
                if entity_name:
                    cea_entity_map[name].append(entity_name)

        all_unique_names = sorted(cea_division_data.keys())
        self.stdout.write(
            f"  Unique CEA/TL names extracted: {len(all_unique_names)}\n"
        )

        # ──────────────────────────────────────────────────────────
        # STEP 3 -- Build fuzzy index of existing users
        # ──────────────────────────────────────────────────────────
        self.stdout.write("Building fuzzy index of existing users …")
        existing_users = list(User.objects.all().values("id", "username", "full_name"))
        # fuzzy_key -> full_name of existing user
        existing_fuzzy = {}
        for u in existing_users:
            fk = fuzzy_key(u["full_name"])
            if fk:
                existing_fuzzy[fk] = u["full_name"]

        self.stdout.write(f"  Existing users in DB: {len(existing_users)}\n")

        # ──────────────────────────────────────────────────────────
        # STEP 4 -- Determine division for each CEA name
        # ──────────────────────────────────────────────────────────
        def pick_division(name):
            """
            Return a Division object (or None) for this CEA.
            Logic:
              - Count frequency of each L1 division -> pick most common.
              - If there is a clear majority L1 -> use L1 division object.
              - If only one sector appears under that L1 -> use L2 division.
            """
            tuples = cea_division_data.get(name, [])
            if not tuples:
                return None

            # Count L1 occurrences
            l1_counts = defaultdict(int)
            for div, sec, sub in tuples:
                if div:
                    l1_counts[div] += 1

            if not l1_counts:
                return None

            best_l1 = max(l1_counts, key=lambda k: l1_counts[k])

            # Try to get L1 division from DB
            try:
                return Division.objects.get(name=best_l1, level=1)
            except Division.DoesNotExist:
                pass
            except Division.MultipleObjectsReturned:
                return Division.objects.filter(name=best_l1, level=1).first()
            return None

        # ──────────────────────────────────────────────────────────
        # STEP 5 -- Create users / detect duplicates
        # ──────────────────────────────────────────────────────────
        self.stdout.write("\n========== CEA/TL USER IMPORT ==========")

        stats = {
            "created": 0,
            "existed": 0,
            "duplicates": 0,
            "errors": [],
        }

        # Map: audit-universe name -> User object (for entity assignment later)
        cea_user_map = {}   # name -> User instance

        for name in all_unique_names:
            fk = fuzzy_key(name)
            if fk in existing_fuzzy:
                existing_name = existing_fuzzy[fk]
                self.stdout.write(
                    self.style.WARNING(
                        f"  WARNING Possible duplicate: '{name}' ~= '{existing_name}' -- SKIPPED"
                    )
                )
                stats["duplicates"] += 1
                # Still map this name to the existing user so entities can be updated
                try:
                    existing_user = User.objects.get(full_name=existing_name)
                    cea_user_map[name] = existing_user
                except User.DoesNotExist:
                    pass
                except User.MultipleObjectsReturned:
                    cea_user_map[name] = User.objects.filter(full_name=existing_name).first()
                continue

            # New user -- create it
            username = slugify_name(name)
            email = f"{username}@audit.go.tz"
            div_obj = None if dry_run else pick_division(name)

            if dry_run:
                self.stdout.write(
                    f"  [DRY] Would create: {username:35s} | '{name}'"
                )
                stats["created"] += 1
                continue

            try:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "full_name": name,
                        "primary_role": RoleLevel.CEA,
                        "division": div_obj,
                        "is_first_login": True,
                        "is_active": True,
                    },
                )
                if created:
                    user.set_password(DEFAULT_PASSWORD)
                    user.save(update_fields=["password"])
                    stats["created"] += 1
                    self.stdout.write(
                        f"  [NEW]    {username:35s} | '{name}'"
                        + (f" | div={div_obj.name}" if div_obj else "")
                    )
                    # Update fuzzy index so subsequent names don't double-create
                    existing_fuzzy[fk] = name
                else:
                    stats["existed"] += 1
                    self.stdout.write(f"  [EXISTS] {username:35s} | '{name}'")

                cea_user_map[name] = user

            except Exception as exc:
                msg = f"ERROR creating '{username}': {exc}"
                self.stdout.write(self.style.ERROR(f"  {msg}"))
                stats["errors"].append(msg)

        # ──────────────────────────────────────────────────────────
        # STEP 6 -- Check if Entity has responsible_person field
        # ──────────────────────────────────────────────────────────
        has_responsible_person = hasattr(Entity, "responsible_person")

        if not has_responsible_person:
            self.stdout.write(self.style.WARNING(
                "\nEntity model does not have 'responsible_person' field yet.\n"
                "Entity update will run after migration.\n"
                "Run: python manage.py migrate, then re-run this command."
            ))
        else:
            # ──────────────────────────────────────────────────────
            # STEP 7 -- Assign entity.responsible_person
            # ──────────────────────────────────────────────────────
            self.stdout.write("\n========== ENTITY ASSIGNMENT ==========")

            if dry_run:
                self.stdout.write("  [DRY RUN] Skipping entity updates.")
            else:
                # Build a lookup: entity_name -> Entity (case-insensitive)
                all_entities = {e.name.strip().lower(): e for e in Entity.objects.all()}

                entities_to_update = []
                entities_updated = 0
                entities_not_found = 0
                entities_no_user = 0

                for row in data_rows:
                    entity_name = normalise(row[3])
                    cea_raw     = normalise(row[5])

                    if not entity_name or not cea_raw:
                        continue

                    # Find the entity
                    entity = all_entities.get(entity_name.lower())
                    if entity is None:
                        entities_not_found += 1
                        continue

                    # Find the user -- try each name in a compound entry
                    individual_names = split_cea_names(cea_raw)
                    # Use the first resolvable name
                    assigned_user = None
                    for iname in individual_names:
                        iname = iname.strip()
                        if iname in cea_user_map:
                            assigned_user = cea_user_map[iname]
                            break
                        # Try fuzzy fallback
                        fk = fuzzy_key(iname)
                        if fk in existing_fuzzy:
                            try:
                                assigned_user = User.objects.get(
                                    full_name=existing_fuzzy[fk]
                                )
                                break
                            except (User.DoesNotExist, User.MultipleObjectsReturned):
                                pass

                    if assigned_user is None:
                        entities_no_user += 1
                        continue

                    # Only update if changed
                    if entity.responsible_person_id != assigned_user.pk or entity.lead_type != "responsible_cea":
                        entity.responsible_person = assigned_user
                        entity.lead_type = "responsible_cea"
                        entities_to_update.append(entity)

                # Bulk update
                if entities_to_update:
                    Entity.objects.bulk_update(
                        entities_to_update,
                        ["responsible_person", "lead_type"],
                        batch_size=200,
                    )
                    entities_updated = len(entities_to_update)

                self.stdout.write(f"  Entities updated with responsible_person : {entities_updated}")
                self.stdout.write(f"  Entities not found in DB                 : {entities_not_found}")
                self.stdout.write(f"  Entities with unresolved CEA/TL name     : {entities_no_user}")

        # ──────────────────────────────────────────────────────────
        # STEP 8 -- Summary
        # ──────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("\n========== SUMMARY =========="))
        self.stdout.write(f"  Total unique CEA/TL names in file   : {len(all_unique_names)}")
        self.stdout.write(f"  New users created                   : {stats['created']}")
        self.stdout.write(f"  Users already existed (same username): {stats['existed']}")
        self.stdout.write(f"  Possible duplicates skipped (fuzzy) : {stats['duplicates']}")

        if stats["errors"]:
            self.stdout.write(self.style.ERROR(
                f"\n  ERRORS ({len(stats['errors'])}):"
            ))
            for e in stats["errors"]:
                self.stdout.write(self.style.ERROR(f"    - {e}"))
        else:
            self.stdout.write(self.style.SUCCESS("  No errors."))
