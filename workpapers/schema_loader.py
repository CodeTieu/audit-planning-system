"""
Schema loader — reads JSON workpaper schemas from `workpapers/schemas/`,
validates structure, and caches in memory.

Each schema describes a single workpaper (UE1, UE2, ..., RA2) using a stable
declarative format so the frontend can render the form, and the risk engine
can evaluate triggers, without bespoke per-workpaper code.

────────────────────────────────────────────────────────────────────────────
SCHEMA FORMAT (workpapers/schemas/<CODE>.json):

{
  "code": "UE1",
  "version": 1,
  "title": "UE 1 — General Information",
  "subtitle": "Step 1: General Info (ISSAI 2315)",
  "issai_reference": "ISSAI 2315 / ISA 315",
  "sections": [
    {
      "id": "S1",
      "number": 1,
      "title": "Type of Entity",
      "questions": [...]
    }
  ]
}

QUESTION OBJECT:
{
  "id": "S1_Q1",
  "ref": "1.1",
  "type": "select" | "text" | "textarea" | "date" | "yes_no_na"
        | "table" | "narrative" | "calculated",
  "text": "What is the type of entity being audited?",
  "required": true,
  "options": ["a", "b", "c"]            // for select/yes_no_na
  "lookup_code": "ENTITY_TYPE",          // for select sourced from lookups
  "columns": [...],                       // for table type
  "is_descriptive": false,                // descriptive = no risk polarity
  "risk_polarity": "no" | "yes" | null,   // which answer triggers a risk
  "inverted": false,                      // semantic inversion (rare)
  "trigger": {                            // optional: emit a risk when matched
    "id": "UE1_VACANT_POSITION",
    "match": {"any_row_status": "Vacant"},   // condition descriptor
    "risk_description": "Key position vacant",
    "severity": "High",
    "is_pervasive": true,
    "is_cotabd_specific": false,
    "assertions": ["Completeness", "Accuracy"]
  },
  "guidance": "Optional guidance text",
  "evidence_fields": true                 // show PSREC sub-panel
}
────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.conf import settings


SCHEMA_DIR = Path(__file__).resolve().parent / 'schemas'

# In-memory cache: { 'UE1': {...schema...}, ... }
_SCHEMA_CACHE: dict[str, dict[str, Any]] = {}


def _load_file(code: str) -> dict[str, Any] | None:
    path = SCHEMA_DIR / f'{code}.json'
    if not path.exists():
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_schema(code: str, *, refresh: bool = False) -> dict[str, Any] | None:
    """
    Return the schema dict for the given workpaper code.

    In DEBUG mode (and when `refresh=True`), always re-read from disk so edits
    take effect without a server restart. In production, cache in memory.
    """
    if refresh or settings.DEBUG or code not in _SCHEMA_CACHE:
        data = _load_file(code)
        if data is None:
            return None
        _SCHEMA_CACHE[code] = data
    return _SCHEMA_CACHE.get(code)


def list_available_codes() -> list[str]:
    """Return the list of workpaper codes that have a schema file on disk."""
    if not SCHEMA_DIR.exists():
        return []
    return sorted(p.stem for p in SCHEMA_DIR.glob('*.json'))


def clear_cache() -> None:
    """Drop the in-memory cache (used in tests)."""
    _SCHEMA_CACHE.clear()
