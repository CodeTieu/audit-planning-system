"""Quick test data seed script."""
import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, 'C:/Users/kanza/audit-planning-system')
django.setup()

from engagements.models import Engagement, EngagementTeam, DocumentAssignment, DocumentType
from workpapers.models import Workpaper
from risks.models import Risk
from findings.models import Finding, FindingRiskLink
from entities.models import Entity
from users.models import User
from django.utils import timezone
from datetime import date, timedelta

admin   = User.objects.get(username='admin')
tl      = User.objects.filter(username='test.teamleader').first() or admin
auditor = User.objects.filter(username='test.auditor').first() or admin
cea1    = User.objects.filter(username='valence.rutakyamirwa').first() or admin
cea2    = User.objects.filter(username='karim.suleiman').first() or admin

doc_types = {dt.code: dt for dt in DocumentType.objects.all()}

# Find 5 distinct entities not already used in 2025
used_ids = set(Engagement.objects.filter(audit_year=2025).values_list('entity_id', flat=True))
pool = list(Entity.objects.exclude(id__in=used_ids).exclude(name='').order_by('id')[:20])
e1, e2, e3, e4 = pool[0], pool[1], pool[2], pool[3]
# For eng5 use 2025 but different entity
used_ids2 = set(Engagement.objects.filter(audit_year=2025).values_list('entity_id', flat=True)) | {e1.id,e2.id,e3.id,e4.id}
pool2 = list(Entity.objects.exclude(id__in=used_ids2).order_by('id')[:5])
e5 = pool2[0]
e6 = pool2[1] if len(pool2) > 1 else pool2[0]  # for locked (2024 — no conflict)

print(f"Entities: {e1.name[:30]}, {e2.name[:30]}, {e3.name[:30]}, {e4.name[:30]}, {e5.name[:30]}")

def make_eng(code, entity, cea, tl_u, year, status, days):
    eng, created = Engagement.objects.get_or_create(
        engagement_code=f'ENG-TEST-{code}',
        defaults=dict(
            entity=entity, audit_year=year, team_leader=tl_u,
            responsible_person=cea, lead_type='responsible_cea', status=status,
            audit_period_start=date(year-1,1,1), audit_period_end=date(year-1,12,31),
            overall_deadline=date.today()+timedelta(days=days), created_by=cea or admin,
        )
    )
    if created:
        for u, role in [(cea,'cea'), (tl_u,'team_leader'), (auditor,'financial_auditor')]:
            if u: EngagementTeam.objects.get_or_create(engagement=eng, user=u, defaults={'engagement_role':role,'added_by':admin})
    return eng, created

# ── ENG-TEST-001: Full package, in review ──────────────────
eng1, c1 = make_eng('001', e1, cea1, tl, 2025, 'in_review', 45)
print(f'ENG-TEST-001: {"created" if c1 else "exists"} | {e1.name[:40]}')
if c1:
    ue1_fd = {
        'S1_Q1':'Local Government Authority','S1_Q2':'TZS','S1_Q3':'IPSAS',
        'S2_Q1':'Government Road, Dar es Salaam','S2_Q3':'+255 22 211 0001',
        'key_personnel':[
            {'position':'Accounting Officer','name':'Dr. James Mwangi','status':'Substantive'},
            {'position':'Director of Finance','name':'Mary Ochieng','status':'Acting (6+ months)'},
            {'position':'Head of Internal Audit','name':'','status':'Vacant'},
            {'position':'Head of Procurement','name':'Peter Kamau','status':'Substantive'},
        ],
        'S4_Q1':'Regular/Annual Audit','S4_Q2':'Planning',
        'S4_Q3':'2024-01-01','S4_Q4':'2024-12-31','S4_Q5':'Qualified',
        'S4_Q6':'Revenue completeness issue from prior year'
    }
    for code, dt in doc_types.items():
        fd = ue1_fd if code == 'UE1' else {'S1_Q1':'Yes','completed':True}
        wp, _ = Workpaper.objects.get_or_create(
            engagement=eng1, document_type=dt,
            defaults={'form_data':fd,'status':'submitted','created_by':auditor,
                      'last_updated_by':auditor,'submitted_at':timezone.now()}
        )
        DocumentAssignment.objects.get_or_create(
            engagement=eng1, document_type=dt,
            defaults={'assigned_to':auditor,'assigned_by':tl,'status':'tl_approved',
                      'deadline':date.today()+timedelta(days=30),'submitted_at':timezone.now()}
        )
    wp1 = Workpaper.objects.filter(engagement=eng1, document_type__code='UE1').first()
    r1,_ = Risk.objects.get_or_create(risk_no='RISK-E1-001', engagement=eng1, defaults={
        'source_document':'UE1','source_section':'S3','trigger_question':'Key personnel status',
        'trigger_answer':'Acting (6+ months)','risk_description':'Director of Finance in acting position — management instability risk',
        'severity':'Medium','is_pervasive':True,'workpaper':wp1})
    r2,_ = Risk.objects.get_or_create(risk_no='RISK-E1-002', engagement=eng1, defaults={
        'source_document':'UE1','source_section':'S3','trigger_question':'Key personnel status',
        'trigger_answer':'Vacant','risk_description':'Head of Internal Audit position vacant — critical oversight gap',
        'severity':'High','is_pervasive':True,'workpaper':wp1})
    r3,_ = Risk.objects.get_or_create(risk_no='RISK-E1-003', engagement=eng1, defaults={
        'source_document':'UE2','source_section':'S2_Q3','trigger_question':'Adequate segregation of duties at management level?',
        'trigger_answer':'No','risk_description':'Inadequate management-level segregation of duties — financial fraud risk',
        'severity':'High','is_cotabd_specific':True})
    r4,_ = Risk.objects.get_or_create(risk_no='RISK-E1-004', engagement=eng1, defaults={
        'source_document':'UE5','source_section':'SA_Q3','trigger_question':'Management fraud pressures?',
        'trigger_answer':'Yes','risk_description':'Management under significant revenue target pressure — fraudulent reporting risk',
        'severity':'High','is_pervasive':True})
    f1,_ = Finding.objects.get_or_create(engagement=eng1, finding_ref='FIND-001', defaults={
        'title':'Inadequate Segregation of Duties at Management Level',
        'criteria':'Per ISSAI 2315, effective internal control requires adequate segregation of duties at all management levels.',
        'finding_body':'The Director of Finance and Head of Procurement both report to the same Deputy Director without an independent review layer. This creates a control gap in expenditure authorisation.',
        'cause':'Organisational structure has not been reviewed since the 2019 restructuring. No compensating controls have been implemented.',
        'implication':'Risk of unauthorised transactions. Potential for fraud. Lack of accountability in financial management processes.',
        'recommendation':'Restructure reporting lines to ensure Finance and Procurement have independent oversight. Implement mandatory dual authorisation for transactions above TZS 5 million.',
        'status':'draft','created_by':auditor})
    FindingRiskLink.objects.get_or_create(finding=f1, risk=r3, defaults={'linked_by':auditor})
    f2,_ = Finding.objects.get_or_create(engagement=eng1, finding_ref='FIND-002', defaults={
        'title':'Head of Internal Audit Position Vacant',
        'criteria':'Per the Public Audit Act and ISSAI 2315, entities must maintain a functional internal audit unit as a key monitoring control.',
        'finding_body':'The Head of Internal Audit position has been vacant since March 2024. No acting appointment has been made. Internal audit activities are suspended.',
        'cause':'Recruitment process initiated in June 2024 stalled due to budget constraints.',
        'implication':'No internal audit oversight. Prior audit recommendations not monitored for implementation.',
        'recommendation':'Appoint acting Head of Internal Audit immediately. Expedite substantive recruitment. Consider outsourcing internal audit temporarily.',
        'status':'draft','created_by':auditor})
    FindingRiskLink.objects.get_or_create(finding=f2, risk=r2, defaults={'linked_by':auditor})
    f3,_ = Finding.objects.get_or_create(engagement=eng1, finding_ref='FIND-003', defaults={
        'title':'Management Revenue Target Pressure Creates Fraud Risk',
        'criteria':'Per ISSAI 2240, auditors must assess incentives and pressures that could lead to fraudulent financial reporting.',
        'finding_body':'Management is under significant pressure to meet revenue targets set at 40% above prior year actuals. Combined with weak controls, this represents a significant fraud risk.',
        'cause':'Revenue targets were set based on projections that have not materialised.',
        'implication':'Risk of revenue overstatement. Prior year qualified opinion was on same issue.',
        'recommendation':'Apply enhanced professional scepticism to revenue transactions. Perform detailed substantive testing on revenue recognition.',
        'status':'draft','created_by':auditor})
    FindingRiskLink.objects.get_or_create(finding=f3, risk=r4, defaults={'linked_by':auditor})

# ── ENG-TEST-002: Partial (UE1-UE4 + FRF + PE2 submitted) ──
eng2, c2 = make_eng('002', e2, cea2, tl, 2025, 'active', 60)
print(f'ENG-TEST-002: {"created" if c2 else "exists"} | {e2.name[:40]}')
if c2:
    for code in ['UE1','UE2','UE3','UE4','FRF','PE2']:
        dt = doc_types.get(code)
        if dt:
            Workpaper.objects.get_or_create(engagement=eng2, document_type=dt,
                defaults={'form_data':{'S1_Q1':'Ministry/Government Department','S1_Q3':'IPSAS','completed':True},
                          'status':'submitted','created_by':auditor,'last_updated_by':auditor,'submitted_at':timezone.now()})
            DocumentAssignment.objects.get_or_create(engagement=eng2, document_type=dt,
                defaults={'assigned_to':auditor,'assigned_by':tl,'status':'tl_approved',
                          'deadline':date.today()+timedelta(days=45),'submitted_at':timezone.now()})
    for code in ['UE5','UE6_1','UE6_2','UE7','UE8','RA1','RA2']:
        dt = doc_types.get(code)
        if dt:
            DocumentAssignment.objects.get_or_create(engagement=eng2, document_type=dt,
                defaults={'assigned_to':auditor,'assigned_by':tl,'status':'not_started',
                          'deadline':date.today()+timedelta(days=55)})

# ── ENG-TEST-003: Just started (UE1 draft only) ─────────────
eng3, c3 = make_eng('003', e3, cea1, tl, 2025, 'active', 90)
print(f'ENG-TEST-003: {"created" if c3 else "exists"} | {e3.name[:40]}')
if c3:
    dt1 = doc_types.get('UE1')
    if dt1:
        Workpaper.objects.get_or_create(engagement=eng3, document_type=dt1,
            defaults={'form_data':{'S1_Q1':'Public Corporation/Parastatal'},'status':'draft',
                      'created_by':auditor,'last_updated_by':auditor})
        DocumentAssignment.objects.get_or_create(engagement=eng3, document_type=dt1,
            defaults={'assigned_to':auditor,'assigned_by':tl,'status':'in_progress',
                      'deadline':date.today()+timedelta(days=14)})
    for code in [c for c in doc_types if c != 'UE1']:
        dt = doc_types[code]
        DocumentAssignment.objects.get_or_create(engagement=eng3, document_type=dt,
            defaults={'assigned_to':auditor,'assigned_by':tl,'status':'not_started',
                      'deadline':date.today()+timedelta(days=60)})

# ── ENG-TEST-004: Locked (2024) ──────────────────────────────
eng4, c4 = make_eng('004', e4, cea2, tl, 2024, 'locked', -30)
print(f'ENG-TEST-004: {"created" if c4 else "exists"} | {e4.name[:40]}')
if c4:
    eng4.locked_at = timezone.now() - timedelta(days=15)
    eng4.locked_by = admin
    eng4.save()
    for code, dt in doc_types.items():
        Workpaper.objects.get_or_create(engagement=eng4, document_type=dt,
            defaults={'form_data':{'S1_Q1':'Statutory Corporation','completed':True},'status':'finalized',
                      'created_by':auditor,'last_updated_by':auditor,'submitted_at':timezone.now()-timedelta(days=45)})
        DocumentAssignment.objects.get_or_create(engagement=eng4, document_type=dt,
            defaults={'assigned_to':auditor,'assigned_by':tl,'status':'finalized',
                      'deadline':date.today()-timedelta(days=30),'submitted_at':timezone.now()-timedelta(days=45)})

# ── ENG-TEST-005: Returned by CEA ───────────────────────────
eng5, c5 = make_eng('005', e5, cea1, tl, 2025, 'active', 30)
print(f'ENG-TEST-005: {"created" if c5 else "exists"} | {e5.name[:40]}')
if c5:
    for code, dt in doc_types.items():
        st = 'returned' if code in ['UE2','UE6_1'] else 'tl_approved'
        Workpaper.objects.get_or_create(engagement=eng5, document_type=dt,
            defaults={'form_data':{'S1_Q1':'Local Government Authority','completed':True},
                      'status':st,'created_by':auditor,'last_updated_by':auditor,
                      'submitted_at':timezone.now()-timedelta(days=10)})
        DocumentAssignment.objects.get_or_create(engagement=eng5, document_type=dt,
            defaults={'assigned_to':auditor,'assigned_by':tl,'status':st,
                      'deadline':date.today()+timedelta(days=20),'submitted_at':timezone.now()-timedelta(days=10)})

# Summary
from engagements.models import Engagement as E
print()
print('=== TEST DATA SUMMARY ===')
print(f'Total engagements:     {E.objects.count()}')
print(f'Test engagements:      {E.objects.filter(engagement_code__startswith="ENG-TEST").count()}')
print(f'Total workpapers:      {Workpaper.objects.count()}')
print(f'Total risks:           {Risk.objects.count()}')
print(f'Total findings:        {Finding.objects.count()}')
print(f'Finding-risk links:    {FindingRiskLink.objects.count()}')
print()
for eng in E.objects.filter(engagement_code__startswith='ENG-TEST').order_by('engagement_code'):
    wps = Workpaper.objects.filter(engagement=eng).count()
    risks = Risk.objects.filter(engagement=eng).count()
    findings = Finding.objects.filter(engagement=eng).count()
    print(f'  {eng.engagement_code} | {eng.status:12s} | WPs={wps:2d} Risks={risks} Findings={findings} | {eng.entity.name[:35]}')
