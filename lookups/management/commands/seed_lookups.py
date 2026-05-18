"""
Seed all reference data (dropdown values, lookups) for the audit planning system.

Idempotent — safe to re-run. Values are upserted using (category, value).

Run:
    python manage.py seed_lookups
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from lookups.models import Lookup, LookupCategory


# ─────────────────────────────────────────────────────────────
# Reference data — sourced from the 14 workpaper Lookup sheets in
# C:\Users\kanza\WP Automation\extracted\
# ─────────────────────────────────────────────────────────────

CATEGORIES = {
    # ── UE1 ────────────────────────────────────────────────
    'ENTITY_TYPE': {
        'name': 'Entity Type',
        'values': [
            'Local Government Authority — City Council',
            'Local Government Authority — Municipal Council',
            'Local Government Authority — District Council',
            'Local Government Authority — Town Council',
            'Ministry / Government Department',
            'Independent Department / Agency',
            'Public Corporation / Parastatal',
            'Statutory Corporation',
            'Subvented Organisation',
            'Regional Administration',
            'Other (specify in notes)',
        ],
    },
    'REPORTING_CURRENCY': {
        'name': 'Reporting Currency',
        'values': [
            'Tanzanian Shilling (TZS)',
            'United States Dollar (USD)',
            'Euro (EUR)',
            'British Pound (GBP)',
            'Other (specify)',
        ],
    },
    'REPORTING_FRAMEWORK': {
        'name': 'Financial Reporting Framework',
        'values': [
            'IPSAS Accrual Basis',
            'IPSAS Cash Basis',
            'IFRS Accounting Standards',
            'IFRS for SMEs',
            'Other (specify)',
        ],
    },
    'KEY_POSITION': {
        'name': 'Key Position',
        'values': [
            'Accounting Officer (e.g., Council Director / Mayor / PS)',
            'Director of Finance / Council Treasurer',
            'Director of Planning',
            'Director of Human Resources',
            'Head of Internal Audit (Chief Internal Auditor)',
            'Head of Procurement Management Unit (HPMU)',
            'Director / Departmental Head',
            'Audit Committee Chair (TCWG)',
            'Council Chair / Mayor (TCWG)',
            'Other Key Manager (specify)',
        ],
    },
    'PERSONNEL_STATUS': {
        'name': 'Personnel Status',
        'values': ['Substantive', 'Acting', 'Vacant'],
    },
    'PERIOD_SERVED_BAND': {
        'name': 'Period Served Band',
        'values': ['Less than 1 year', '1 to 5 years', '5 to 10 years', 'More than 10 years'],
    },
    'OTHER_AUDIT_TYPE': {
        'name': 'Other Audit Engagement Type',
        'values': ['Forensic Audit', 'Compliance Audit', 'Special Audit', 'Other (specify)'],
    },
    'AUDIT_STATUS': {
        'name': 'Audit Status',
        'values': ['Planning', 'Fieldwork', 'Reporting', 'Finalised', 'Suspended'],
    },

    # ── PE2 — Competency Matrix ─────────────────────────────
    'TEAM_ROLE': {
        'name': 'Engagement Team Role',
        'values': [
            'Financial Auditor',
            'IS Auditor',
            'Team Leader',
            'CEA',
            'AAG',
            'Internal Expert',
        ],
    },
    'COMPETENCY_LEVEL': {
        'name': 'Competency Level',
        'values': [
            {'value': 'Basic Understanding', 'extra': {'numeric': 1}},
            {'value': 'Intermediate',         'extra': {'numeric': 2}},
            {'value': 'Advanced',             'extra': {'numeric': 3}},
        ],
    },
    'COMPETENCY_ASPECT': {
        'name': 'Competency Aspect',
        'values': [
            'Technical Accounting Knowledge (IPSAS / IFRS)',
            'Industry-Specific Knowledge (LGAs, MDAs, Financial Institutions, etc.)',
            'Audit Methodology (Risk Assessment & Documentation Software)',
            'IS Audit Skills',
            'Data Analytics',
            'Professional Skepticism & Judgement',
            'Report Writing & Communication Skills',
            'Additional Expertise (Internal Expert)',
        ],
    },

    # ── COTABD — common across UE6_2, UE7, UE8, RA2 ─────────
    'COTABD': {
        'name': 'Class of Transaction, Account Balance or Disclosure',
        'values': [
            'Cash and Cash Equivalents',
            'Receivables (Trade & Other)',
            'Prepayments',
            'Inventories',
            'Investments (Short-Term)',
            'Investments (Long-Term, e.g., LGLB)',
            'Investment Property',
            'Property, Plant & Equipment',
            'Intangible Assets',
            'Other Assets',
            'Payables and Accruals',
            'Provisions',
            'Deferred Income',
            'Deposits',
            'Borrowings (Government / Other)',
            'Employee Benefits Obligations',
            'Accumulated Surpluses / Deficits',
            'Reserves (incl. Minimum Compulsory Reserve)',
            'Capital Contributions',
            'Tax Revenue (Property, Service Levy, etc.)',
            'Non-Tax Revenue (Fees, Fines, Charges)',
            'Subventions from Other Government Entities',
            'External Assistance / Donor Grants',
            'Social Contributions Revenue',
            'Other Revenue',
            'Fair Value Gains on Assets / Liabilities',
            'Wages, Salaries & Employee Benefits',
            'Goods and Services Used (Procurement)',
            'Other Operating Expenses',
            'Depreciation of PPE & Investment Property',
            'Amortisation of Intangible Assets',
            'Finance Costs',
            'Social Benefits',
            'Grants and Transfers (Other)',
            'Expected Credit Losses',
            'Multiple COTABDs (specify in notes)',
            'Entity-level (Pervasive)',
        ],
    },
    'ASSERTION': {
        'name': 'Financial Statement Assertion',
        'values': [
            'Occurrence',
            'Completeness',
            'Accuracy',
            'Cut-off',
            'Classification',
            'Existence',
            'Rights and Obligations',
            'Valuation and Allocation',
            'Presentation',
            'Understandability',
        ],
    },

    # ── UE5 — Fraud Considerations ─────────────────────────
    'FRAUD_RISK_LEVEL': {
        'name': 'Overall Fraud Risk Level',
        'values': ['Low', 'Medium', 'High'],
    },

    # ── UE7 ────────────────────────────────────────────────
    'PRIOR_YEAR_SOURCE': {
        'name': 'Prior Year Audit Source',
        'values': [
            'CAG / SAI Audit Report — prior year',
            'Public Accounts Committee (PAC) recommendations',
            'Treasury Registrar (TR) directives — prior year',
            'Internal Audit findings — prior year',
            'Parent Ministry / Sector oversight letter',
            'Other (specify in notes)',
        ],
    },
    'FINDING_STATUS': {
        'name': 'Prior Year Finding Status',
        'values': [
            'Resolved',
            'Partially resolved',
            'Pending — recurring',
            'Pending — new mitigation',
            'Disputed by management',
        ],
    },

    # ── RA1 — Overall Responses ────────────────────────────
    'OVERALL_RESPONSE': {
        'name': 'Overall Audit Response (RA 1)',
        'values': [
            {'value': 'OR-01', 'extra': {'title': 'Strengthen Professional Skepticism and Fraud Awareness Throughout the Engagement'}},
            {'value': 'OR-02', 'extra': {'title': 'Deploy Experienced Staff, Specialists, and Enhanced Supervision'}},
            {'value': 'OR-03', 'extra': {'title': 'Modify the Nature, Timing, and Extent (NTE) of Audit Procedures'}},
            {'value': 'OR-04', 'extra': {'title': 'Incorporate Unpredictability and Expanded Field Coverage'}},
            {'value': 'OR-05', 'extra': {'title': 'Obtain More Persuasive and Reliable Audit Evidence'}},
            {'value': 'OR-06', 'extra': {'title': 'Perform Enhanced Fraud-Focused and Management Override Procedures'}},
            {'value': 'OR-07', 'extra': {'title': 'Perform Enhanced Compliance, Governance, and Going Concern Procedures'}},
            {'value': 'OR-08', 'extra': {'title': 'Enhance Group, IT, Service Organisation, and Emerging-Risk Procedures'}},
        ],
    },

    # ── Generic ───────────────────────────────────────────
    'YES_NO_NA': {
        'name': 'Yes / No / N/A',
        'values': ['Yes', 'No', 'N/A'],
    },
    'RATING_3': {
        'name': 'Rating (Low/Medium/High)',
        'values': ['Low', 'Medium', 'High'],
    },
}


class Command(BaseCommand):
    help = 'Seed all reference data / lookup values from source workpapers (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        created_c, updated_c = 0, 0
        created_v, updated_v = 0, 0

        for code, spec in CATEGORIES.items():
            cat, was_new = LookupCategory.objects.update_or_create(
                code=code,
                defaults={'name': spec['name'], 'is_active': True},
            )
            if was_new:
                created_c += 1
            else:
                updated_c += 1

            for order, entry in enumerate(spec['values']):
                if isinstance(entry, dict):
                    value = entry['value']
                    extra = entry.get('extra', {})
                    label = entry.get('label', '')
                else:
                    value = entry
                    extra = {}
                    label = ''

                obj, vnew = Lookup.objects.update_or_create(
                    category=cat,
                    value=value,
                    defaults={
                        'display_label': label,
                        'extra': extra,
                        'display_order': order,
                        'is_active': True,
                    },
                )
                if vnew:
                    created_v += 1
                else:
                    updated_v += 1

        self.stdout.write(self.style.SUCCESS(
            f'Categories: {created_c} created, {updated_c} updated. '
            f'Values: {created_v} created, {updated_v} updated.'
        ))
