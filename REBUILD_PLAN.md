# Audit Planning System — Workpaper Rebuild Plan

This plan covers the work needed to align the system's 13 workpaper forms with the updated source documents in `C:\Users\kanza\WP Automation\extracted\`. The source documents represent a substantial redesign vs. what the system currently implements.

**Scope:** Full rebuild of all 13 workpapers, the risk engine, supporting backend models/serializers, and exports.

**Estimated total effort:** 6 phases, approximately 18–25 working hours spread across multiple sessions.

---

## Architectural Changes Needed (apply once, before forms)

Before rebuilding any individual form, these foundations must be updated:

### B1. Backend — Lookup tables
Source docs use rich lookup tables (entity types, key positions, audit engagement types, status options, period bands, etc.). Currently these are hardcoded in frontend pages.

**Action:**
- Add `Lookup` model (`code`, `key`, `value`, `display_order`, `is_active`)
- Seed initial values per file
- Expose via `GET /api/lookups/?code=ENTITY_TYPE`
- Replace hardcoded arrays in workpaper pages

### B2. Backend — Form schema model
Currently each form is a hand-coded React component. Source docs have a consistent structure: sections, questions, sub-tables, polarity-aware Y/N, narrative, calculated fields. A schema-driven approach makes maintenance much easier.

**Action:** decide whether to:
- (a) Continue hand-coding each form (faster initial, painful to maintain), OR
- (b) Build a `FormSchema` model + dynamic form renderer (slower initial, dramatically easier to maintain). **Recommended.**

### B3. Risk engine — polarity-aware rules
Currently rules hardcode "yes" or "no" as risk. The new spec has explicit `risk_polarity` per question in the Lookup tab of each source workpaper (`"No is risk"`, `"Yes is risk (INVERTED)"`, `"Descriptive"`).

**Action:** Refactor `TRIGGER_RULES` to be data-driven from `FormSchema` + `risk_polarity` rather than hardcoded Python lambdas.

### B4. Cross-workpaper data flow
- UE6.1 needs to read UE6.2's "IT IC Rating" to compute Overall IC Conclusion.
- UE7 Section 5 (Going Concern) overall conclusion feeds into RA1.
- RA1 receives Pervasive risks from all UE workpapers.
- RA2 receives COTABD-specific risks from all UE workpapers + UE8 SCOTABDs.
- UE8 Lead Schedule materiality settings flow into RA2 quantitative materiality.

**Action:** Add `cross_workpaper_links` table; expose computed values via API.

---

## PHASE 1 — Foundations  (estimate: 4–5 hours)

### Files to create
| File | Purpose |
|---|---|
| `lookups/models.py` | `Lookup`, `LookupCategory` models |
| `lookups/serializers.py`, `lookups/views.py`, `lookups/urls.py` | REST CRUD |
| `lookups/management/commands/seed_lookups.py` | Seed all dropdown values from source files |
| `workpapers/schema.py` | New `FormSchema`, `Section`, `Question`, `SubTable` models |
| `workpapers/schema_loader.py` | Loads JSON schema definitions on startup |
| `workpapers/schemas/UE1.json` | Schema definition for UE1 |
| `workpapers/schemas/UE2.json` … `RA2.json` | One per workpaper (13 files) |
| `frontend/src/components/workpaper/SchemaFormRenderer.jsx` | Dynamic renderer driven by JSON schema |
| `frontend/src/components/workpaper/SubTable.jsx` | Generic editable table for repeating sub-rows (key personnel, related parties, etc.) |
| `frontend/src/components/workpaper/CalculatedField.jsx` | Display-only cell driven by a formula (% of total, sub-conclusion, etc.) |

### Migration
- Add `is_descriptive`, `risk_polarity`, `is_inverted` to Question model
- Add `cross_link_source` to Question for cross-workpaper computed values

### Acceptance criteria
- Can render UE1 form purely from `UE1.json` schema (no hand-coded JSX)
- Existing UE1 form continues to work in parallel until cut over

---

## PHASE 2 — Risk Engine rewrite  (estimate: 2–3 hours)

### Changes
| File | Change |
|---|---|
| `workpapers/risk_engine.py` | Replace `TRIGGER_RULES` dict with `evaluate_schema(workpaper)` that reads `FormSchema` + `risk_polarity` per question |
| `workpapers/risk_engine.py` | Add support for inverted polarity questions (`is_inverted=True` → Yes triggers risk) |
| `workpapers/risk_engine.py` | Add support for table-row triggers (e.g. any personnel row with status='Vacant') |
| `workpapers/risk_engine.py` | Add support for calculated triggers (e.g. UE4 financing concentration > 70%) |
| `workpapers/risk_engine.py` | Pull severity / assertions / COTABD-spec / pervasive flags from schema |

### Acceptance criteria
- All existing 60 trigger rules continue to fire
- New triggers fire from schema definitions
- Unit test per workpaper proves coverage

---

## PHASE 3 — Workpapers (small) — UE1, UE5, FRF/P1, PE2  (estimate: 4 hours)

These are the least-changed or most-bounded.

### UE1 — General Information  (1 hour)
- Update Status dropdown: remove "(6+ months)" — just `Substantive / Acting / Vacant`
- Add new column "Period Served" with bands: `< 1 year / 1–5 / 5–10 / > 10`
- Add new **Section 4 — Other Audit Engagements at the Auditee** sub-table:
  - Columns: `Type of engagement` (Forensic / Compliance / Special / Other), `Responsible party`, `Commencement date`, `Status`, `Audit area affected`, `Findings relevant to FS audit`
- Trigger update: Acting personnel (no 6+ months condition); Audit engagement = Forensic → risk
- Update entity type lookup to use the 11-option list from source

### UE5 — Fraud Considerations  (1 hour)
- Reduce 12 → 11 questions (drop `SA_Q12`, keep `SA_Q1`–`SA_Q11`)
- Add per-question "Minimum Procedures" guidance text from source
- Add weighted risk score: count of Yes answers → Low (<2), Medium (2–3), High (>3) overall fraud risk
- Auto-classify each risk as FS-level (Q1, Q3, Q5, Q6, Q7, Q10, Q12) or COTABD-level (others)
- Tag presumed risks: Q3 (mgmt override) and Q9 (revenue recognition) always trigger per ISSAI 2240

### FRF — rename to "P1. Evaluation of FRF"  (1 hour)
- Section 1: Identification table (FRF name, purpose, mandate Y/N, mandate source)
- Section 2: ISSAI 2210 Hierarchy — 3 checks (A: prescribed by law, B: authorised standard-setter, C: other)
- Section 3: Five Attributes Assessment (Relevance / Completeness / Reliability(i) / Reliability(ii) / Neutrality / Understandability), each Y/N + reasoning
- Section 4: Overall conclusion + Engagement Acceptance Decision
- Lookup-driven FRF dropdown: `IPSAS Accrual Basis / IFRS Accounting Standards / IFRS for SMEs / Cash-Basis IPSAS / Other`

### PE2 — Competency Matrix  (1 hour)
- 8 competency aspects rows × 6 team member columns
- Per-member role dropdown: `Financial Auditor / IS Auditor / Internal Expert / Team Leader / CEA / AAG`
- Per-cell competency rating: `Basic Understanding / Intermediate / Advanced`
- Auto gap-count per team member (column reads from role→required matrix in Lookup)
- Intervention Log sub-tab (auto-populates rows for gaps)
- Risk: any unresolved gap after intervention → High Pervasive

---

## PHASE 4 — Workpapers (medium) — UE3, UE4, UE6.1, UE6.2  (estimate: 5–6 hours)

### UE3 — Legislative Framework  (1.5 hours)
- Replace Y/N structure with two sub-tables:
  - **Section 1**: Pre-populated Cat 1 Laws (12 rows) — each with Law / Section / COTABD / Assertions / Non-compliance scenario / WP Ref / auto-trigger on Y/N
  - **Section 2**: Changes in Laws/Standards (free-add rows) — new standard, effective date, COTABD affected
- Lookup: full Tanzania LGA legal framework from source's Lookup sheet (Cat 1: 12 laws + Cat 2: 8 laws)

### UE4 — Operational Environment  (1.5 hours)
- 5 sections:
  - 1. Mandate & Core Operations (2 narrative Q's with PSREC documentation)
  - 2. Operational Structure (4 Y/N — `Yes is risk` polarity)
  - 3. Sources of Financing — 6-row financial table with auto % of total + concentration trigger (>70% in single source → pervasive risk)
  - 4. External Environment PESTLE (5 Y/N — mixed polarity per source Lookup)
  - 5. Strategy & Programme Objectives (5 Q — mixed polarity: 5.1/5.2/5.5 No=risk, 5.3/5.4 Yes=risk)

### UE6.1 — Internal Controls (excl IT)  (1.5 hours)
- 4 components, each with sub-conclusion auto-rated from member Y/N answers:
  - Control Environment (7 Q)
  - Risk Management Process (6 Q)
  - Control Activities (2 Q)
  - Monitoring (4 Q)
- Overall IC Conclusion table at bottom (auto-rating per component, auditor override allowed)
- Cross-link from UE6.2 IT IC rating (read-only)

### UE6.2 — IT Internal Controls  (1.5 hours)
- Section A: IT Applications Inventory (5+ rows, mark FS-relevant)
- Section B: Application Complexity Assessment — for each FS-relevant app, 4 Y/N complexity factors; 2+ Yes → complexity risk
- Section C: 5 IT Environment Y/N (C.1–C.5) — polarity per source
- Section D: Auto-calculated IT IC rating (Low / Medium / High) from B + C; auditor override
- Risk register: complexity risks + environment risks consolidated

---

## PHASE 5 — Workpapers (large) — UE7, UE8, RA1, RA2  (estimate: 5–7 hours)

### UE7 — Other Considerations  (1.5 hours)
- 6 sections, each ISSAI-anchored:
  - 1 (ISSAI 2501) Litigations table — case details, financial impact, legal counsel
  - 2 (ISSAI 2402) Service Organisations table
  - 3 (ISSAI 2550) Related Parties table
  - 4 (ISSAI 2500/2620) Experts table (auditor's vs management's experts)
  - 5 (ISSAI 2570) Going Concern — 6 indicators (5.1–5.6) + overall judgement
  - 6 Prior Year Audit Findings table (up to ~11 rows)
- Each section's overall Y/N feeds the risk register

### UE8 — Lead Schedule  (2 hours)
- **Rename internally** from "Overall FS Risk" → "Lead Schedule"
- Materiality settings: Performance Materiality TZS input, Tolerable Variance %
- Lead Schedule table: 35 COTABD lines pre-populated (SoFP Assets/Liab/Equity, SoFP&P Revenue/Expenses)
- Per COTABD:
  - CY balance, PY balance, % change, budget, budget variance
  - Quant Material flag (auto: |CY| ≥ PM)
  - Qualitative flags (Fraud / PY Misstatement / Volume / Subjectivity / Complexity / Policy Change)
  - SCOTABD classification (auto: any flag = Yes)
- Disclosures sub-tab — 7 disclosure types with Judgement / PY Issue Y/N + auto classification
- Feeds RA2 (per SCOTABD → RA2 row created) and Risk Register

### RA1 — Pervasive Risk Assessment  (1 hour)
- Auto-imports pervasive risks from all UE workpapers
- For each risk: select Response from 8 predefined overalls (OR-01…OR-08)
- Each response has a fixed "How to perform" description (read-only from Lookup)
- Final conclusion table:
  - Current Year Inherent Risk at FS Level (Low/Med/High)
  - Prior year opinion + corrective action
  - Control Risk at FS Level (from UE6.1)
  - Fraud risk (from UE5)
  - Overall RMM at FS Level (auto)

### RA2 — Risk Assessment & Response per COTABD  (2.5 hours — largest)
- One sub-form per Significant COTABD identified in UE8
- Per COTABD:
  - Sub-class balances table (CY preliminary, CY final)
  - Accounting policies (CY vs PY, consistency Y/N)
  - Inherent Risk → Control Risk → RMM → Audit Plan flow
  - Per Key Process: inherent risk factor, likelihood (1–3), magnitude (1–3), rating, assertion
  - System description per process (initiating, recording, posting, reporting)
  - Walkthrough test
  - Final risk of material misstatement per assertion
  - Substantive procedures design

---

## PHASE 6 — Cross-cutting & polish  (estimate: 2–3 hours)

### Export updates
- Excel export must mirror new structure (Cover / Documentation Guidance / main sheet / Risk Identified / Lookup) per workpaper
- Add Disclosures sub-sheet for UE8
- Multi-COTABD sub-pages for RA2

### Review workflow
- Submit-package validation should check that:
  - All Y/N answers have PSREC documentation (Source / Test / Conclusion / WP Ref)
  - Sub-conclusions per UE6.1 component are completed
  - UE8 SCOTABDs all have corresponding RA2 entries

### Seed data refresh
- Update `seed_now.py` to populate the new structures so ENG-TEST-001 demonstrates the full flow

### Test data
- One end-to-end happy-path test that creates an engagement, fills all 13 workpapers, triggers ~15 risks, generates 5 findings, submits review, exports package

---

## Dependencies between phases

```
Phase 1 (Foundations)
    ├─→ Phase 2 (Risk Engine)
    │       ├─→ Phase 3 (Small forms: UE1, UE5, FRF, PE2)
    │       │       └─→ Phase 4 (Medium forms: UE3, UE4, UE6.1, UE6.2)
    │       │               └─→ Phase 5 (Large forms: UE7, UE8, RA1, RA2)
    │       │                       └─→ Phase 6 (Cross-cutting & polish)
```

Phases 3 → 4 → 5 must run in order because RA1/RA2 depend on UE6.1/UE6.2 cross-links and UE8 SCOTABDs.

---

## Decisions you need to make before Phase 1

1. **Schema-driven vs hand-coded?** (B2 above) — Recommended: schema-driven. Trade-off: ~4 extra hours up front, saves ~12 hours across phases 3–5 and dramatically eases future maintenance.

2. **Migrate existing test data?** Current seed data uses old field keys (`S1_Q1`, `S2_Q3`, etc.). After rebuild, do we:
   - (a) Discard and reseed from scratch — simpler, but loses ENG-TEST-001's pre-populated risks/findings
   - (b) Write a one-time data migration to rename keys — more work, preserves test data

3. **Keep current locked engagements untouched?** ENG-TEST-004 is locked with v1 form data. After rebuild:
   - (a) Old forms render with old schema (need to keep old templates around)
   - (b) Lock = read-only PDF snapshot at lock time, no live form rendering needed

4. **PSREC documentation per question** — every Y/N answer now requires (a) Source, (b) Test, (c) Conclusion, (d) WP Reference. This roughly **doubles the input burden per form** for auditors. Confirm this is the design intent.

5. **Pre-population priority** — UE3 Cat 1 Laws list, UE8 35 COTABD lines, RA1 8 Overall Responses, Tanzania LGA legal framework — these are large pre-seeded lookups. Should we seed them now or after auditors validate?

---

## Suggested next session

If approved, **start with Phase 1 (Foundations)**. We can complete the lookups infrastructure and schema model in one session, then in the following session do Phase 2 + UE1 from Phase 3 as a proof of the pattern.

**This file (`REBUILD_PLAN.md`) lives in the repo root and is committed.** Update it as we work through phases — tick off completed items, adjust estimates, add notes.
