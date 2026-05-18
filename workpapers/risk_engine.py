"""
Risk Engine — evaluates workpaper form_data and auto-generates Risk records.

Each trigger rule is a dict with:
  - id:               unique trigger identifier
  - source_section:   form section/question key e.g. 'S3_Q1'
  - trigger_question: human-readable question text
  - condition:        callable(form_data) -> bool
  - get_answer:       callable(form_data) -> str
  - risk_description: str
  - inherent_risk_factor: str
  - severity:         'Low' | 'Medium' | 'High'
  - is_pervasive:     bool (with 'High' upgrades to 'High-Pervasive')
  - is_cotabd_specific: bool
  - assertions:       list[str]
  - dedup_key:        callable(form_data, rule) -> str

NOTE on value casing: workpaper forms store `yes_no_na` field values as
lowercase strings ('yes', 'no', 'na'). All conditions below honour that.
Select fields keep their original casing (e.g. 'Follow-up Audit', 'High').
"""

from django.utils import timezone

from .schema_loader import get_schema


# ─────────────────────────────────────────────────────────────
# SCHEMA-DRIVEN RULE COMPILER
# ─────────────────────────────────────────────────────────────
# When a workpaper has a JSON schema in workpapers/schemas/<CODE>.json,
# rules are compiled from it on the fly. This lets us author new
# workpapers purely as JSON without touching this file.
#
# Supported match_kind values:
#   - "any_row_field_equals" : for table questions; matches if ANY row's
#                              field == match_value (e.g. personnel status='Vacant')
#   - "value_equals"         : for scalar fields; matches if value == match_value
#
# A question may also declare `risk_polarity`: 'no' or 'yes' to mean
# "answering this way fires a generic risk", with optional severity/etc.
# fields on the question itself.

def _make_condition(match_kind, match_field, match_value, question_id):
    """Return a callable(form_data) -> bool for the given match descriptor."""
    if match_kind == 'any_row_field_equals':
        def cond(form_data, qid=question_id, mf=match_field, mv=match_value):
            rows = form_data.get(qid, []) or []
            return any(
                isinstance(r, dict) and r.get(mf) == mv
                for r in rows
            )
        return cond

    if match_kind == 'value_equals':
        def cond(form_data, qid=question_id, mv=match_value):
            return form_data.get(qid) == mv
        return cond

    # Fallback: never fire
    return lambda form_data: False


def _trigger_descriptor_to_rule(question, trigger):
    """Convert a schema `trigger` dict on a `question` into a `TRIGGER_RULES`-shaped dict."""
    mk = trigger.get('match_kind')
    mv = trigger.get('match_value')
    mf = trigger.get('match_field')
    qid = question['id']
    captured_answer = mv if mk == 'any_row_field_equals' else mv

    return {
        'id': trigger['id'],
        'source_section': qid,
        'trigger_question': question.get('text', qid),
        'condition': _make_condition(mk, mf, mv, qid),
        'get_answer': lambda fd, _a=captured_answer: str(_a),
        'risk_description':    trigger['risk_description'],
        'inherent_risk_factor': trigger.get('inherent_risk_factor', ''),
        'severity':             trigger.get('severity', 'Medium'),
        'is_pervasive':         bool(trigger.get('is_pervasive', False)),
        'is_cotabd_specific':   bool(trigger.get('is_cotabd_specific', False)),
        'assertions':           trigger.get('assertions', []),
        'dedup_key': lambda fd, rule: rule['id'],
    }


def _polarity_rule(question):
    """Convert a polarity-flagged question (risk_polarity='no'/'yes') into a rule."""
    polarity = str(question.get('risk_polarity', '')).lower()
    if polarity not in ('yes', 'no'):
        return None
    qid = question['id']

    def cond(form_data, _qid=qid, _p=polarity):
        v = form_data.get(_qid)
        return v is not None and str(v).lower() == _p

    return {
        'id': f"{qid}_POLARITY",
        'source_section': qid,
        'trigger_question': question.get('text', qid),
        'condition': cond,
        'get_answer': lambda fd, _a=polarity: _a.capitalize(),
        'risk_description':     question.get('risk_description',
                                             f"{question.get('text', qid)} — answer triggers a risk."),
        'inherent_risk_factor': question.get('inherent_risk_factor', ''),
        'severity':             question.get('severity', 'Medium'),
        'is_pervasive':         bool(question.get('is_pervasive', False)),
        'is_cotabd_specific':   bool(question.get('is_cotabd_specific', False)),
        'assertions':           question.get('assertions', []),
        'dedup_key': lambda fd, rule: rule['id'],
    }


def compile_rules_from_schema(code):
    """
    Return a list of rule dicts derived from the JSON schema for `code`.
    Returns an empty list if no schema is found.
    """
    schema = get_schema(code)
    if not schema:
        return []

    rules = []
    for section in schema.get('sections', []):
        for q in section.get('questions', []):
            # Triggers attached to the question (table-row matchers etc.)
            for t in (q.get('triggers') or []):
                rules.append(_trigger_descriptor_to_rule(q, t))
            # Polarity-based
            pol = _polarity_rule(q)
            if pol:
                rules.append(pol)
    return rules


# ─────────────────────────────────────────────────────────────
# COMPLEX CONDITION HELPERS  (legacy — used by hardcoded TRIGGER_RULES below)
# ─────────────────────────────────────────────────────────────

def _personnel_acting_condition(form_data):
    """Return True if any S3_Q1 personnel row has status 'Acting (6+ months)'."""
    personnel = form_data.get('S3_Q1', []) or []
    return any(
        p.get('status') == 'Acting (6+ months)'
        for p in personnel
        if isinstance(p, dict)
    )


def _personnel_vacant_condition(form_data):
    """Return True if any S3_Q1 personnel row has status 'Vacant'."""
    personnel = form_data.get('S3_Q1', []) or []
    return any(
        p.get('status') == 'Vacant'
        for p in personnel
        if isinstance(p, dict)
    )


# Tiny helpers for clarity below
def _is_yes(form_data, key):  return form_data.get(key) == 'yes'
def _is_no(form_data, key):   return form_data.get(key) == 'no'


# ─────────────────────────────────────────────────────────────
# TRIGGER RULES REGISTRY
# ─────────────────────────────────────────────────────────────

TRIGGER_RULES = {
    # ── UE1: migrated to JSON schema (workpapers/schemas/UE1.json) ───────────
    # See `compile_rules_from_schema('UE1')` for the rules. Kept here as a
    # comment so it is obvious to future maintainers that UE1 has moved.

    # ── UE2: Governance Structure ────────────────────────────────────────────
    'UE2': [
        {
            'id': 'UE2_BOARD_NOT_FUNCTIONAL',
            'source_section': 'S1_Q1',
            'trigger_question': 'Does the entity have a functional governing board/council?',
            'condition': lambda fd: _is_no(fd, 'S1_Q1'),
            'get_answer': lambda fd: 'No',
            'risk_description': (
                'Board/council not functional — significant governance weakness that '
                'may undermine oversight of financial reporting.'
            ),
            'inherent_risk_factor': (
                'A non-functional board or council indicates the absence of effective '
                'governance, creating a pervasive risk across all financial statement assertions.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE2_MEETINGS_NOT_HELD',
            'source_section': 'S1_Q2',
            'trigger_question': 'Has the board held the required number of meetings?',
            'condition': lambda fd: _is_no(fd, 'S1_Q2'),
            'get_answer': lambda fd: 'No',
            'risk_description': (
                'Required governance meetings not held — indicates breakdown in '
                'oversight processes and accountability.'
            ),
            'inherent_risk_factor': (
                'Failure to hold required board or governance meetings indicates '
                'inadequate oversight, creating a pervasive risk to financial reporting integrity.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE2_BOARD_VACANCIES',
            'source_section': 'S1_Q5',
            'trigger_question': 'Are there vacancies in the governing board/council?',
            'condition': lambda fd: _is_yes(fd, 'S1_Q5'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Vacancies in governing board — governance continuity risk.',
            'inherent_risk_factor': (
                'Vacancies in the governing board create gaps in oversight and may '
                'impair the body\'s ability to discharge its responsibilities.'
            ),
            'severity': 'Medium',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE2_POOR_MGMT_SEGREGATION',
            'source_section': 'S2_Q3',
            'trigger_question': 'Is there adequate segregation of duties at the management level?',
            'condition': lambda fd: _is_no(fd, 'S2_Q3'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Inadequate management-level segregation of duties.',
            'inherent_risk_factor': (
                'Inadequate segregation of duties at management level increases the risk '
                'of fraud and material misstatement going undetected.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': True,
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE2_MGMT_CHANGES',
            'source_section': 'S2_Q4',
            'trigger_question': 'Has management changed significantly during the audit period?',
            'condition': lambda fd: _is_yes(fd, 'S2_Q4'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant management changes — continuity and control risk.',
            'inherent_risk_factor': (
                'Significant management changes during the audit period may disrupt '
                'internal controls and affect institutional knowledge of financial processes.'
            ),
            'severity': 'Medium',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── UE3: Legal & NOCLAR ──────────────────────────────────────────────────
    'UE3': [
        {
            'id': 'UE3_NOCLAR_KNOWN',
            'source_section': 'S4_Q2',
            'trigger_question': 'Is there known or suspected non-compliance with laws and regulations?',
            'condition': lambda fd: _is_yes(fd, 'S4_Q2'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Known or suspected non-compliance with laws and regulations',
            'inherent_risk_factor': (
                'Identified or suspected NOCLAR indicates the entity may be exposed to '
                'legal penalties, reputational damage, and related financial misstatements.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE3_HIGH_NOCLAR_RISK',
            'source_section': 'S4_Q4',
            'trigger_question': 'What is the overall NOCLAR risk level?',
            'condition': lambda fd: fd.get('S4_Q4') == 'High',
            'get_answer': lambda fd: fd.get('S4_Q4', ''),
            'risk_description': 'High overall NOCLAR risk — enhanced procedures required',
            'inherent_risk_factor': (
                'A high overall NOCLAR risk assessment requires the auditor to apply '
                'enhanced audit procedures and consider the impact on the audit opinion.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── UE4: Operations & Strategy ───────────────────────────────────────────
    'UE4': [
        {
            'id': 'UE4_OUTSOURCED_FUNCTIONS',
            'source_section': 'S2_Q3',
            'trigger_question': 'Are there significant outsourced functions?',
            'condition': lambda fd: _is_yes(fd, 'S2_Q3'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant outsourced functions — control gaps possible',
            'inherent_risk_factor': (
                'Outsourcing significant functions reduces direct management oversight '
                'and may create gaps in internal controls and data access.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE4_RESTRUCTURING',
            'source_section': 'S2_Q4',
            'trigger_question': 'Is there significant restructuring underway?',
            'condition': lambda fd: _is_yes(fd, 'S2_Q4'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant restructuring — operational disruption risk',
            'inherent_risk_factor': (
                'Significant restructuring activities may disrupt operations, weaken '
                'internal controls, and increase the risk of misstatement across all areas.'
            ),
            'severity': 'Medium',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Completeness', 'Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE4_INADEQUATE_IT',
            'source_section': 'S2_Q5',
            'trigger_question': 'Are IT systems adequate for financial reporting?',
            'condition': lambda fd: _is_no(fd, 'S2_Q5'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Inadequate IT systems for financial reporting',
            'inherent_risk_factor': (
                'IT systems that are inadequate for financial reporting purposes increase '
                'the risk of inaccurate or incomplete financial data and reporting.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE4_LEGAL_CASES',
            'source_section': 'S4_Q3',
            'trigger_question': 'Are there significant pending legal cases?',
            'condition': lambda fd: _is_yes(fd, 'S4_Q3'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant pending legal cases — contingent liability risk',
            'inherent_risk_factor': (
                'Pending legal cases may give rise to unrecorded or inadequately disclosed '
                'contingent liabilities in the financial statements.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Provisions & Contingencies',
            'assertions': ['Completeness', 'Valuation', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE4_RELATED_PARTIES',
            'source_section': 'S4_Q5',
            'trigger_question': 'Are there significant related party relationships?',
            'condition': lambda fd: _is_yes(fd, 'S4_Q5'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant related party relationships — conflict of interest risk',
            'inherent_risk_factor': (
                'Significant related party relationships increase the risk of transactions '
                'not conducted at arm\'s length, potentially distorting financial results.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE4_NO_STRATEGIC_PLAN',
            'source_section': 'S5_Q1',
            'trigger_question': 'Does the entity have a current strategic plan?',
            'condition': lambda fd: _is_no(fd, 'S5_Q1'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'No current strategic plan — lack of organisational direction',
            'inherent_risk_factor': (
                'The absence of a current strategic plan suggests a lack of organisational '
                'direction, which may impair management decision-making and resource allocation.'
            ),
            'severity': 'Medium',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── UE5: Fraud Risk Assessment ───────────────────────────────────────────
    'UE5': [
        {
            'id': 'UE5_FRAUD_IDENTIFIED',
            'source_section': 'SA_Q1',
            'trigger_question': 'Has fraud been identified or suspected?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q1'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Fraud identified or suspected — immediate escalation required',
            'inherent_risk_factor': (
                'Identified or suspected fraud requires immediate escalation and significantly '
                'increases audit risk across all financial statement assertions.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_FRAUD_INCENTIVES',
            'source_section': 'SA_Q3',
            'trigger_question': 'Are there management fraud incentives or pressures?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q3'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Management fraud incentives/pressures identified',
            'inherent_risk_factor': (
                'Identified fraud incentives or pressures on management increase the '
                'likelihood of intentional misstatement in the financial statements.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_FRAUD_OPPORTUNITY',
            'source_section': 'SA_Q4',
            'trigger_question': 'Is there opportunity for fraud due to control weaknesses?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q4'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Opportunity for fraud due to control weaknesses',
            'inherent_risk_factor': (
                'Control weaknesses provide opportunities for fraud and may allow '
                'misstatements to go undetected.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_MANAGEMENT_OVERRIDE',
            'source_section': 'SA_Q5',
            'trigger_question': 'Has management override of controls been detected?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q5'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Management override of controls detected',
            'inherent_risk_factor': (
                'Management override of controls is a significant fraud risk indicator '
                'and undermines the reliability of the internal control environment.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_COMPLEX_TRANSACTIONS',
            'source_section': 'SA_Q6',
            'trigger_question': 'Are there unusual or complex transactions difficult to audit?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q6'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Unusual or complex transactions difficult to audit',
            'inherent_risk_factor': (
                'Unusual or complex transactions increase audit risk as they may be '
                'structured to conceal misstatements or lack adequate documentation.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_CASH_SHORTAGES',
            'source_section': 'SA_Q7',
            'trigger_question': 'Are there significant cash shortages or unexplained losses?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q7'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant cash shortages or unexplained losses',
            'inherent_risk_factor': (
                'Cash shortages or unexplained losses may indicate misappropriation '
                'of assets or other fraudulent activity affecting cash balances.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Cash & Cash Equivalents',
            'assertions': ['Completeness', 'Occurrence'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_UNUSUAL_JOURNALS',
            'source_section': 'SA_Q8',
            'trigger_question': 'Are there unusual journal entries or period-end adjustments?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q8'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Unusual journal entries or period-end adjustments',
            'inherent_risk_factor': (
                'Unusual or large period-end journal entries may indicate earnings '
                'management or fraudulent manipulation of financial results.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_UNUSUAL_RPT',
            'source_section': 'SA_Q9',
            'trigger_question': 'Have unusual related party transactions been identified?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q9'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Unusual related party transactions identified',
            'inherent_risk_factor': (
                'Unusual related party transactions may not be conducted at arm\'s length '
                'and could indicate fraudulent financial reporting.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_REVENUE_RECOGNITION',
            'source_section': 'SA_Q10',
            'trigger_question': 'Are there revenue recognition issues or manipulation?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q10'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Revenue recognition issues or manipulation',
            'inherent_risk_factor': (
                'Revenue recognition issues or manipulation may indicate fraudulent '
                'financial reporting with a direct impact on reported results.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Revenue',
            'assertions': ['Occurrence', 'Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_STAFF_RESISTANT',
            'source_section': 'SA_Q11',
            'trigger_question': 'Are key employees resistant to audit inquiry?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q11'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Key employees resistant to audit inquiry',
            'inherent_risk_factor': (
                'Resistance to audit inquiry by key employees significantly impairs the '
                'auditor\'s ability to obtain sufficient appropriate evidence.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE5_PROCUREMENT_AWARD',
            'source_section': 'SA_Q12',
            'trigger_question': 'Has high-value procurement been awarded without proper process?',
            'condition': lambda fd: _is_yes(fd, 'SA_Q12'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'High-value procurement awarded without proper process',
            'inherent_risk_factor': (
                'Procurement awarded without proper competitive process increases the '
                'risk of inflated costs, favouritism, and potential misappropriation.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Procurement & Expenditure',
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── UE6_1: Internal Controls (Financial) ─────────────────────────────────
    'UE6_1': [
        {
            'id': 'UE6_1_NO_AUTH_PROCEDURES',
            'source_section': 'S2_Q1',
            'trigger_question': 'Are there authorization procedures for financial transactions?',
            'condition': lambda fd: _is_no(fd, 'S2_Q1'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'No authorization procedures for financial transactions',
            'inherent_risk_factor': (
                'The absence of authorization procedures for financial transactions '
                'significantly increases the risk of unauthorized or erroneous transactions.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': True,
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_POOR_SEGREGATION',
            'source_section': 'S2_Q2',
            'trigger_question': 'Is there adequate segregation of duties in financial processes?',
            'condition': lambda fd: _is_no(fd, 'S2_Q2'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Inadequate segregation of duties in financial processes',
            'inherent_risk_factor': (
                'Inadequate segregation of duties increases both the risk of error '
                'and the risk of fraud going undetected across financial processes.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_ASSETS_NOT_SAFEGUARDED',
            'source_section': 'S2_Q3',
            'trigger_question': 'Are physical assets adequately safeguarded?',
            'condition': lambda fd: _is_no(fd, 'S2_Q3'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Physical assets not adequately safeguarded',
            'inherent_risk_factor': (
                'Inadequate safeguarding of physical assets increases the risk of '
                'theft, loss, or misuse, leading to misstatement of asset values.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': True,
            'assertions': ['Completeness', 'Valuation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_NO_RECONCILIATIONS',
            'source_section': 'S2_Q4',
            'trigger_question': 'Are reconciliations performed and reviewed?',
            'condition': lambda fd: _is_no(fd, 'S2_Q4'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Reconciliations not performed or reviewed',
            'inherent_risk_factor': (
                'Failure to perform or review reconciliations increases the risk that '
                'errors and discrepancies in financial records go undetected.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': True,
            'assertions': ['Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_POOR_PROCUREMENT_CTRL',
            'source_section': 'S2_Q5',
            'trigger_question': 'Are procurement controls adequate?',
            'condition': lambda fd: _is_no(fd, 'S2_Q5'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Inadequate procurement controls',
            'inherent_risk_factor': (
                'Weak procurement controls increase the risk of unauthorized purchases, '
                'inflated costs, and misappropriation of public resources.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Procurement & Expenditure',
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_POOR_PAYROLL_CTRL',
            'source_section': 'S2_Q6',
            'trigger_question': 'Are payroll controls adequate?',
            'condition': lambda fd: _is_no(fd, 'S2_Q6'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Inadequate payroll controls',
            'inherent_risk_factor': (
                'Inadequate payroll controls increase the risk of ghost employees, '
                'unauthorized salary payments, and payroll fraud.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Wages & Salaries',
            'assertions': ['Occurrence', 'Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_POOR_REVENUE_CTRL',
            'source_section': 'S2_Q7',
            'trigger_question': 'Are revenue collection and banking controls adequate?',
            'condition': lambda fd: _is_no(fd, 'S2_Q7'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Inadequate revenue collection and banking controls',
            'inherent_risk_factor': (
                'Weak revenue collection and banking controls increase the risk of '
                'misappropriation of cash receipts and understatement of revenue.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Revenue',
            'assertions': ['Completeness', 'Occurrence'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_FINANCIAL_INFO_WEAK',
            'source_section': 'S3_Q1',
            'trigger_question': 'Is financial information captured accurately and timely?',
            'condition': lambda fd: _is_no(fd, 'S3_Q1'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Financial information not captured accurately or timely',
            'inherent_risk_factor': (
                'Inaccurate or untimely capture of financial information increases the '
                'risk of material misstatements in the financial statements.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_WEAK_FR_CONTROLS',
            'source_section': 'S3_Q4',
            'trigger_question': 'Are there adequate controls over financial reporting processes?',
            'condition': lambda fd: _is_no(fd, 'S3_Q4'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Weak controls over financial reporting processes',
            'inherent_risk_factor': (
                'Weak financial reporting controls create a pervasive risk of misstatement '
                'affecting the completeness and accuracy of the financial statements.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Accuracy', 'Completeness', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_IA_NOT_IMPLEMENTED',
            'source_section': 'S4_Q3',
            'trigger_question': 'Have internal audit recommendations been implemented?',
            'condition': lambda fd: _is_no(fd, 'S4_Q3'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Internal audit recommendations not implemented',
            'inherent_risk_factor': (
                'Failure to implement internal audit recommendations indicates '
                'management\'s inaction on identified weaknesses, increasing audit risk.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_1_PRIOR_FINDINGS_UNRESOLVED',
            'source_section': 'S4_Q4',
            'trigger_question': 'Have prior audit findings been resolved?',
            'condition': lambda fd: _is_no(fd, 'S4_Q4'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Prior audit findings not resolved',
            'inherent_risk_factor': (
                'Unresolved prior audit findings indicate persistent control weaknesses '
                'that continue to expose the entity to financial reporting risk.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── UE6_2: IT General Controls ───────────────────────────────────────────
    'UE6_2': [
        {
            'id': 'UE6_2_UNAUTHORIZED_ACCESS',
            'source_section': 'S1_Q2',
            'trigger_question': 'Is unauthorized access to financial systems adequately prevented?',
            'condition': lambda fd: _is_no(fd, 'S1_Q2'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Unauthorized access to financial systems possible',
            'inherent_risk_factor': (
                'Insufficient access controls allow unauthorized users to access '
                'financial systems, creating a pervasive risk of data manipulation.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_NO_ACCESS_MGMT',
            'source_section': 'S1_Q3',
            'trigger_question': 'Is there a formal user access management process?',
            'condition': lambda fd: _is_no(fd, 'S1_Q3'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'No formal user access management process',
            'inherent_risk_factor': (
                'Without a formal user access management process, access rights may '
                'be granted excessively or not revoked when no longer required.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_WEAK_PASSWORDS',
            'source_section': 'S1_Q4',
            'trigger_question': 'Are password policies adequate?',
            'condition': lambda fd: _is_no(fd, 'S1_Q4'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Weak password policies — system access at risk',
            'inherent_risk_factor': (
                'Weak password policies increase the risk of unauthorized access '
                'to financial systems through compromised credentials.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_NO_ACTIVITY_LOG',
            'source_section': 'S1_Q5',
            'trigger_question': 'Are system activities logged?',
            'condition': lambda fd: _is_no(fd, 'S1_Q5'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'System activities not logged — fraud may go undetected',
            'inherent_risk_factor': (
                'Without activity logging, unauthorized or fraudulent system activities '
                'may go undetected, undermining the integrity of financial data.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_NO_IT_SEGREGATION',
            'source_section': 'S1_Q6',
            'trigger_question': 'Is there IT segregation of duties in financial systems?',
            'condition': lambda fd: _is_no(fd, 'S1_Q6'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'No IT segregation of duties in financial systems',
            'inherent_risk_factor': (
                'The absence of IT segregation of duties increases the risk that a single '
                'individual can initiate, process, and conceal fraudulent transactions.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_SYSTEM_CHANGES_UNTESTED',
            'source_section': 'S2_Q2',
            'trigger_question': 'Are system changes tested before implementation?',
            'condition': lambda fd: _is_no(fd, 'S2_Q2'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'System changes not tested — data integrity at risk',
            'inherent_risk_factor': (
                'Untested system changes may introduce errors into financial processing '
                'logic, compromising the integrity of financial data.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_NO_BCP',
            'source_section': 'S3_Q1',
            'trigger_question': 'Is there a business continuity/disaster recovery plan?',
            'condition': lambda fd: _is_no(fd, 'S3_Q1'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'No business continuity/disaster recovery plan',
            'inherent_risk_factor': (
                'The absence of a business continuity or disaster recovery plan creates '
                'a significant risk of data loss and operational disruption.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_NO_BACKUPS',
            'source_section': 'S3_Q2',
            'trigger_question': 'Are data backups performed regularly?',
            'condition': lambda fd: _is_no(fd, 'S3_Q2'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Data backups not performed — significant data loss risk',
            'inherent_risk_factor': (
                'The absence of regular data backups creates a risk of irreversible '
                'loss of financial data in the event of a system failure.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_NO_DATA_VALIDATION',
            'source_section': 'S3_Q3',
            'trigger_question': 'Are there data validation controls in financial systems?',
            'condition': lambda fd: _is_no(fd, 'S3_Q3'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'No data validation controls — completeness risk',
            'inherent_risk_factor': (
                'Without data validation controls, incomplete or inaccurate data may '
                'be accepted by financial systems, leading to misstatements.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'All COTABDs',
            'assertions': ['Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE6_2_NO_AUDIT_TRAIL',
            'source_section': 'S3_Q4',
            'trigger_question': 'Are there audit trails in the financial system?',
            'condition': lambda fd: _is_no(fd, 'S3_Q4'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'No audit trails in financial system',
            'inherent_risk_factor': (
                'The absence of audit trails in financial systems makes it impossible '
                'to reconstruct transactions or detect unauthorized changes to data.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── UE7: Specific Risk Areas ─────────────────────────────────────────────
    'UE7': [
        {
            'id': 'UE7_LITIGATION',
            'source_section': 'S1_Q1',
            'trigger_question': 'Is there pending litigation?',
            'condition': lambda fd: _is_yes(fd, 'S1_Q1'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Pending litigation — contingent liability risk',
            'inherent_risk_factor': (
                'Pending litigation may result in significant contingent liabilities '
                'that require recognition or disclosure in the financial statements.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Provisions & Contingencies',
            'assertions': ['Completeness', 'Valuation', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE7_RELATED_PARTY_TXNS',
            'source_section': 'S2_Q1',
            'trigger_question': 'Have related party transactions been identified?',
            'condition': lambda fd: _is_yes(fd, 'S2_Q1'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Related party transactions identified — conflict of interest risk',
            'inherent_risk_factor': (
                'Related party transactions may not be conducted at arm\'s length, '
                'creating a risk of misstatement in financial statement disclosures.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE7_RPT_NOT_DISCLOSED',
            'source_section': 'S2_Q4',
            'trigger_question': 'Are related party transactions properly disclosed?',
            'condition': lambda fd: _is_no(fd, 'S2_Q4'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Related party transactions not properly disclosed',
            'inherent_risk_factor': (
                'Failure to properly disclose related party transactions represents a '
                'material misstatement risk with respect to disclosure requirements.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Presentation', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE7_SUBSEQUENT_EVENTS',
            'source_section': 'S3_Q1',
            'trigger_question': 'Are there significant subsequent events?',
            'condition': lambda fd: _is_yes(fd, 'S3_Q1'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant subsequent events identified',
            'inherent_risk_factor': (
                'Significant subsequent events may require adjustment to or disclosure '
                'in the financial statements to prevent misstatement.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Completeness', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE7_GOING_CONCERN',
            'source_section': 'S4_Q1',
            'trigger_question': 'Are there going concern issues?',
            'condition': lambda fd: _is_yes(fd, 'S4_Q1'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Going concern issues identified',
            'inherent_risk_factor': (
                'Going concern issues have a pervasive impact on the financial statements, '
                'potentially affecting asset valuations, liabilities, and disclosures.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Valuation', 'Completeness', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'UE7_UNRECORDED_COMMITMENTS',
            'source_section': 'S4_Q3',
            'trigger_question': 'Are there unrecorded commitments or contingent liabilities?',
            'condition': lambda fd: _is_yes(fd, 'S4_Q3'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Unrecorded commitments or contingent liabilities',
            'inherent_risk_factor': (
                'Unrecorded commitments or contingent liabilities represent a completeness '
                'risk, as significant obligations may be omitted from the financial statements.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'cotabd': 'Provisions & Contingencies',
            'assertions': ['Completeness', 'Valuation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── UE8: Overall Financial Statement Risk ────────────────────────────────
    'UE8': [
        {
            'id': 'UE8_HIGH_FS_RISK',
            'source_section': 'S3_Q3',
            'trigger_question': 'What is the overall financial statement risk level?',
            'condition': lambda fd: fd.get('S3_Q3') == 'High',
            'get_answer': lambda fd: fd.get('S3_Q3', ''),
            'risk_description': (
                'High overall financial statement risk — significant additional audit '
                'procedures required'
            ),
            'inherent_risk_factor': (
                'A high overall financial statement risk rating indicates that the '
                'auditor must significantly extend audit procedures to obtain sufficient '
                'appropriate evidence across all material areas.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy', 'Valuation', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── FRF: Financial Reporting Framework ───────────────────────────────────
    'FRF': [
        {
            'id': 'FRF_INAPPROPRIATE_FRAMEWORK',
            'source_section': 'S1_Q4',
            'trigger_question': 'Is the financial reporting framework appropriate for the entity type?',
            'condition': lambda fd: _is_no(fd, 'S1_Q4'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'Financial reporting framework not appropriate for entity type',
            'inherent_risk_factor': (
                'Using an inappropriate financial reporting framework creates a pervasive '
                'risk that the financial statements do not present a true and fair view.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Presentation', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'FRF_NOT_CONSISTENTLY_APPLIED',
            'source_section': 'S2_Q2',
            'trigger_question': 'Is the financial reporting framework consistently applied?',
            'condition': lambda fd: _is_no(fd, 'S2_Q2'),
            'get_answer': lambda fd: 'No',
            'risk_description': 'FRF not consistently applied — comparability issue',
            'inherent_risk_factor': (
                'Inconsistent application of the financial reporting framework impairs '
                'the comparability of financial statements across periods.'
            ),
            'severity': 'Medium',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'FRF_SIGNIFICANT_DEPARTURES',
            'source_section': 'S2_Q3',
            'trigger_question': 'Are there significant departures from the applicable FRF?',
            'condition': lambda fd: _is_yes(fd, 'S2_Q3'),
            'get_answer': lambda fd: 'Yes',
            'risk_description': 'Significant departures from applicable FRF identified',
            'inherent_risk_factor': (
                'Significant departures from the applicable financial reporting framework '
                'may result in material misstatements and qualification of the audit opinion.'
            ),
            'severity': 'High',
            'is_pervasive': False,
            'is_cotabd_specific': False,
            'assertions': ['Accuracy', 'Presentation'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
        {
            'id': 'FRF_NOT_ACCEPTABLE',
            'source_section': 'S4_Q1',
            'trigger_question': 'Is the financial reporting framework acceptable?',
            'condition': lambda fd: fd.get('S4_Q1') == 'Not Acceptable',
            'get_answer': lambda fd: fd.get('S4_Q1', ''),
            'risk_description': 'Financial reporting framework is not acceptable',
            'inherent_risk_factor': (
                'An unacceptable financial reporting framework creates a pervasive and '
                'fundamental risk affecting the validity of the entire audit engagement.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Presentation', 'Accuracy', 'Completeness'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],

    # ── PE2: Engagement Team Competencies ────────────────────────────────────
    'PE2': [
        {
            'id': 'PE2_TEAM_LACKS_COMPETENCY',
            'source_section': 'S4_Q1',
            'trigger_question': 'Does the engagement team have the required competencies?',
            'condition': lambda fd: _is_no(fd, 'S4_Q1'),
            'get_answer': lambda fd: 'No',
            'risk_description': (
                'Engagement team lacks required competencies — audit quality risk'
            ),
            'inherent_risk_factor': (
                'An engagement team lacking the required technical competencies creates '
                'a pervasive risk that the audit will not be performed to the required '
                'standard, undermining overall audit quality.'
            ),
            'severity': 'High',
            'is_pervasive': True,
            'is_cotabd_specific': False,
            'assertions': ['Occurrence', 'Completeness', 'Accuracy'],
            'dedup_key': lambda fd, rule: rule['id'],
        },
    ],
}


# ─────────────────────────────────────────────────────────────
# RISK ENGINE
# ─────────────────────────────────────────────────────────────

class RiskEngine:
    """Evaluates workpaper form_data against trigger rules and persists Risks.

    Rule resolution order per workpaper code:
        1. If a JSON schema exists at workpapers/schemas/<CODE>.json, use
           rules compiled from it.
        2. Otherwise fall back to the hardcoded TRIGGER_RULES dict below
           (legacy path — being migrated out).
    """

    # Codes whose JSON schema lives under a different filename.
    # e.g. the database has DocumentType.code='FRF' but the schema file is P1.json.
    SCHEMA_CODE_ALIASES = {'FRF': 'P1'}

    def get_triggers_for_document(self, document_type_code):
        schema_code = self.SCHEMA_CODE_ALIASES.get(document_type_code, document_type_code)
        schema_rules = compile_rules_from_schema(schema_code)
        if schema_rules:
            return schema_rules
        return TRIGGER_RULES.get(document_type_code, [])

    def evaluate(self, workpaper, form_data, previous_data=None):
        """
        Compare form_data against trigger rules; create new risks or auto-dismiss
        existing risks whose condition is no longer met.

        Returns: list of newly-created Risk objects.
        """
        from risks.models import Risk

        doc_code = workpaper.document_type.code
        rules = self.get_triggers_for_document(doc_code)
        if not rules:
            return []

        created_risks = []

        for rule in rules:
            condition = rule['condition']
            currently_triggered = bool(condition(form_data))

            existing = Risk.objects.filter(
                engagement=workpaper.engagement,
                workpaper=workpaper,
                source_document=doc_code,
                source_section=rule['source_section'],
                status__in=[Risk.STATUS_ACTIVE, Risk.STATUS_ADDRESSED],
            ).filter(risk_description__startswith=rule['risk_description'][:60]).first()

            if currently_triggered and not existing:
                risk = self.create_risk(workpaper, rule, rule['get_answer'](form_data))
                created_risks.append(risk)
            elif not currently_triggered and existing and existing.status == Risk.STATUS_ACTIVE:
                existing.status = Risk.STATUS_DISMISSED
                existing.dismissed_at = timezone.now()
                existing.dismissal_reason = (
                    'Condition no longer met based on updated workpaper data.'
                )
                existing.save(update_fields=['status', 'dismissed_at', 'dismissal_reason'])

        return created_risks

    def create_risk(self, workpaper, rule, answer):
        from risks.models import Risk

        severity = rule['severity']
        is_pervasive = rule.get('is_pervasive', False)

        # Auto-upgrade severity label
        if is_pervasive and severity == 'High':
            severity = Risk.SEVERITY_HIGH_PERVASIVE

        risk = Risk(
            engagement=workpaper.engagement,
            workpaper=workpaper,
            source_document=workpaper.document_type.code,
            source_section=rule['source_section'],
            trigger_question=rule['trigger_question'],
            trigger_answer=answer,
            inherent_risk_factor=rule.get('inherent_risk_factor', ''),
            risk_description=rule['risk_description'],
            assertions=rule.get('assertions', []),
            is_cotabd_specific=rule.get('is_cotabd_specific', False),
            is_pervasive=is_pervasive,
            severity=severity,
            status=Risk.STATUS_ACTIVE,
            from_library=False,
        )
        risk.save()
        return risk

    def dismiss_triggered_risk(self, risk, user, reason):
        risk.status = risk.STATUS_DISMISSED
        risk.dismissed_at = timezone.now()
        risk.dismissed_by = user
        risk.dismissal_reason = reason
        risk.save(update_fields=['status', 'dismissed_at', 'dismissed_by', 'dismissal_reason'])
        return risk
