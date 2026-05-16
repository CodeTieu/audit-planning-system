from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta


class Command(BaseCommand):
    help = 'Seed realistic test data for system demonstration'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete existing test engagements first')

    def handle(self, *args, **options):
        from users.models import User
        from entities.models import Entity
        from engagements.models import Engagement, EngagementTeam, DocumentAssignment, DocumentType
        from workpapers.models import Workpaper
        from risks.models import Risk
        from findings.models import Finding, FindingRiskLink

        if options['reset']:
            Engagement.objects.filter(engagement_code__startswith='ENG-TEST').delete()
            self.stdout.write('Cleared existing test engagements')

        # Get users
        admin = User.objects.filter(username='admin').first()
        tl = User.objects.filter(username='test.teamleader').first() or admin
        auditor = User.objects.filter(username='test.auditor').first() or admin
        cea1 = User.objects.filter(username='valence.rutakyamirwa').first() or admin
        cea2 = User.objects.filter(username='karim.suleiman').first() or admin
        cea3 = User.objects.filter(username='nobert.matiko').first() or cea1

        # Get document types
        doc_types = {dt.code: dt for dt in DocumentType.objects.all()}

        # Get entities
        lga_entities = list(Entity.objects.filter(division__name__icontains='LGA').exclude(division__isnull=True)[:10])
        pad_entities = list(Entity.objects.filter(division__name__icontains='PAD').exclude(division__isnull=True)[:10])
        mda_entities = list(Entity.objects.filter(division__name__icontains='MDA').exclude(division__isnull=True)[:5])

        entity1 = lga_entities[0] if lga_entities else Entity.objects.first()
        entity2 = mda_entities[0] if mda_entities else Entity.objects.first()
        entity3 = pad_entities[0] if pad_entities else Entity.objects.first()
        entity4 = pad_entities[1] if len(pad_entities) > 1 else entity3
        entity5 = lga_entities[1] if len(lga_entities) > 1 else entity1

        def make_engagement(code_suffix, entity, cea, tl_user, year, status, deadline_days):
            eng, created = Engagement.objects.get_or_create(
                engagement_code=f'ENG-TEST-{code_suffix}',
                defaults={
                    'entity': entity, 'audit_year': year,
                    'team_leader': tl_user, 'responsible_person': cea,
                    'lead_type': 'responsible_cea', 'status': status,
                    'audit_period_start': date(year - 1, 1, 1),
                    'audit_period_end': date(year - 1, 12, 31),
                    'overall_deadline': date.today() + timedelta(days=deadline_days),
                    'created_by': cea or admin,
                }
            )
            if created:
                EngagementTeam.objects.get_or_create(engagement=eng, user=cea or admin, defaults={'engagement_role': 'cea', 'added_by': admin})
                EngagementTeam.objects.get_or_create(engagement=eng, user=tl_user, defaults={'engagement_role': 'team_leader', 'added_by': admin})
                EngagementTeam.objects.get_or_create(engagement=eng, user=auditor, defaults={'engagement_role': 'financial_auditor', 'added_by': tl_user})
            return eng, created

        # ── ENGAGEMENT 1: In Review (all docs submitted, package with CEA) ──
        eng1, created1 = make_engagement('001', entity1, cea1, tl, 2025, 'in_review', 45)
        if created1:
            self.stdout.write(f'Created {eng1.engagement_code}: {entity1.name}')
            # Create all workpapers with realistic data
            ue1_data = {
                'S1_Q1': 'Local Government Authority', 'S1_Q2': 'TZS', 'S1_Q3': 'IPSAS',
                'S2_Q1': 'Independence Avenue, Dar es Salaam', 'S2_Q3': '+255 22 211 0001', 'S2_Q4': 'info@entity.go.tz',
                'key_personnel': [
                    {'position': 'Accounting Officer', 'name': 'Dr. James Mwangi', 'status': 'Substantive'},
                    {'position': 'Director of Finance', 'name': 'Mary Ochieng', 'status': 'Acting (6+ months)'},
                    {'position': 'Head of Internal Audit', 'name': '', 'status': 'Vacant'},
                    {'position': 'Head of Procurement', 'name': 'Peter Kamau', 'status': 'Substantive'},
                ],
                'S4_Q1': 'Regular/Annual Audit', 'S4_Q2': 'Planning',
                'S4_Q3': '2024-01-01', 'S4_Q4': '2024-12-31',
                'S4_Q5': 'Qualified', 'S4_Q6': 'Revenue completeness issue from prior year'
            }
            ue2_data = {
                'S1_Q1': 'Yes', 'S1_Q2': 'Yes', 'S1_Q3': 'Yes', 'S1_Q5': 'No', 'S1_Q6': 'Yes',
                'S2_Q1': 'Yes', 'S2_Q2': 'Yes', 'S2_Q3': 'No', 'S2_Q4': 'No', 'S2_Q5': 'Yes',
                'S2_Q3_results': 'Director of Finance and Procurement report to same supervisor. Limited segregation.',
                'S4_Q1': 'Partially Effective',
                'S4_Q2': 'Board meetings held regularly but management-level segregation of duties is weak.'
            }
            ue5_data = {
                'SA_Q1': 'No', 'SA_Q2': 'Yes', 'SA_Q3': 'Yes', 'SA_Q4': 'Yes',
                'SA_Q3_results': 'Management faces significant pressure to meet revenue targets.',
                'SA_Q4_results': 'Weak segregation creates opportunity for override.',
                'SA_Q5': 'No', 'SA_Q6': 'No', 'SA_Q7': 'No', 'SA_Q8': 'No',
                'SA_Q9': 'No', 'SA_Q10': 'No', 'SA_Q11': 'No', 'SA_Q12': 'No',
                'SB_Q2': 'Medium',
                'SB_Q1': 'Two fraud risk factors identified. Enhanced professional scepticism to be applied.'
            }
            doc_data_map = {
                'UE1': ue1_data, 'UE2': ue2_data, 'UE5': ue5_data,
                'UE3': {'S4_Q1': 'Yes', 'S4_Q2': 'No', 'S4_Q4': 'Medium'},
                'UE4': {'S1_Q1': 'Provide municipal services to residents', 'S2_Q1': 'Yes', 'S2_Q5': 'Yes', 'S5_Q1': 'Yes', 'S4_Q1': 'No'},
                'UE6_1': {'S2_Q1': 'Yes', 'S2_Q2': 'No', 'S2_Q3': 'Yes', 'S2_Q4': 'No', 'S2_Q5': 'Yes', 'S2_Q6': 'Yes', 'S2_Q7': 'Yes', 'S5_Q1': 'Weak', 'S5_Q2': 'Segregation of duties weakness identified in financial processes.'},
                'UE6_2': {'S1_Q1': 'Yes', 'S1_Q2': 'Yes', 'S1_Q3': 'No', 'S1_Q4': 'No', 'S5_Q1': 'Satisfactory'},
                'UE7': {'S1_Q1': 'Yes', 'S2_Q1': 'No', 'S3_Q1': 'No', 'S4_Q1': 'No', 'S4_Q3': 'No'},
                'UE8': {'S1_Q1': 500000000, 'S1_Q2': 400000000, 'S1_Q3': 25000000, 'S1_Q4': 'Total Revenue', 'S3_Q3': 'Medium'},
                'FRF': {'S1_Q1': 'IPSAS (Accrual)', 'S1_Q2': 'Yes', 'S1_Q4': 'Yes', 'S2_Q2': 'Yes', 'S4_Q1': 'Acceptable'},
                'PE2': {'S4_Q1': 'Yes'},
                'RA1': {'S1_Q1': 500000000, 'S4_Q1': 'Medium', 'S4_Q3': 'Overall medium risk. Enhanced scrutiny on revenue and procurement.'},
                'RA2': {'S4_Q1': 'Yes', 'S4_Q2': 'Medium', 'S4_Q3': 'COTABD risks identified in revenue, wages. Substantive testing planned.'},
            }
            for code, dt in doc_types.items():
                form_data = doc_data_map.get(code, {'completed': True})
                wp, _ = Workpaper.objects.get_or_create(
                    engagement=eng1, document_type=dt,
                    defaults={
                        'form_data': form_data, 'status': 'submitted',
                        'created_by': auditor, 'last_updated_by': auditor,
                        'submitted_at': timezone.now()
                    }
                )
                DocumentAssignment.objects.get_or_create(
                    engagement=eng1, document_type=dt,
                    defaults={
                        'assigned_to': auditor, 'assigned_by': tl,
                        'status': 'tl_approved',
                        'deadline': date.today() + timedelta(days=30),
                        'submitted_at': timezone.now()
                    }
                )

            # Create risks directly
            risk_data = [
                {'risk_no': 'RISK-001', 'source_document': 'UE1', 'source_section': 'S3', 'trigger_question': 'Key personnel status', 'trigger_answer': 'Acting (6+ months)', 'risk_description': 'Director of Finance in acting position — risk of management instability', 'severity': 'Medium', 'is_pervasive': True, 'workpaper': Workpaper.objects.filter(engagement=eng1, document_type__code='UE1').first()},
                {'risk_no': 'RISK-002', 'source_document': 'UE1', 'source_section': 'S3', 'trigger_question': 'Key personnel status', 'trigger_answer': 'Vacant', 'risk_description': 'Head of Internal Audit position vacant — oversight gap', 'severity': 'High', 'is_pervasive': True, 'workpaper': Workpaper.objects.filter(engagement=eng1, document_type__code='UE1').first()},
                {'risk_no': 'RISK-003', 'source_document': 'UE2', 'source_section': 'S2_Q3', 'trigger_question': 'Is there adequate segregation of duties at management level?', 'trigger_answer': 'No', 'risk_description': 'Inadequate management-level segregation of duties', 'severity': 'High', 'is_cotabd_specific': True, 'workpaper': Workpaper.objects.filter(engagement=eng1, document_type__code='UE2').first()},
                {'risk_no': 'RISK-004', 'source_document': 'UE5', 'source_section': 'SA_Q3', 'trigger_question': 'Are there incentives/pressures on management?', 'trigger_answer': 'Yes', 'risk_description': 'Management fraud incentives/pressures identified — revenue pressure', 'severity': 'High', 'is_pervasive': True, 'workpaper': Workpaper.objects.filter(engagement=eng1, document_type__code='UE5').first()},
                {'risk_no': 'RISK-005', 'source_document': 'UE5', 'source_section': 'SA_Q4', 'trigger_question': 'Are there opportunities for fraud due to weak controls?', 'trigger_answer': 'Yes', 'risk_description': 'Opportunity for fraud due to weak segregation of duties', 'severity': 'High', 'workpaper': Workpaper.objects.filter(engagement=eng1, document_type__code='UE5').first()},
                {'risk_no': 'RISK-006', 'source_document': 'UE6_1', 'source_section': 'S2_Q2', 'trigger_question': 'Is there adequate segregation of duties in financial processes?', 'trigger_answer': 'No', 'risk_description': 'Inadequate segregation of duties in financial transaction processing', 'severity': 'High', 'is_cotabd_specific': True, 'cotabd': 'Expenditure', 'workpaper': Workpaper.objects.filter(engagement=eng1, document_type__code='UE6_1').first()},
                {'risk_no': 'RISK-007', 'source_document': 'UE6_2', 'source_section': 'S1_Q3', 'trigger_question': 'Is there a formal user access management process?', 'trigger_answer': 'No', 'risk_description': 'No formal IT user access management process', 'severity': 'High', 'workpaper': Workpaper.objects.filter(engagement=eng1, document_type__code='UE6_2').first()},
            ]
            for rd in risk_data:
                Risk.objects.get_or_create(risk_no=rd['risk_no'], engagement=eng1, defaults=rd)

            # Create findings
            r1 = Risk.objects.filter(engagement=eng1, risk_no='RISK-003').first()
            r2 = Risk.objects.filter(engagement=eng1, risk_no='RISK-002').first()
            r3 = Risk.objects.filter(engagement=eng1, risk_no='RISK-004').first()
            r4 = Risk.objects.filter(engagement=eng1, risk_no='RISK-005').first()
            r5 = Risk.objects.filter(engagement=eng1, risk_no='RISK-006').first()

            f1, _ = Finding.objects.get_or_create(
                engagement=eng1, finding_ref='FIND-001',
                defaults={
                    'title': 'Inadequate Segregation of Duties at Management Level',
                    'criteria': 'Per ISSAI 2315, effective internal control requires adequate segregation of duties at all levels of management.',
                    'finding_body': 'The Director of Finance and Head of Procurement both report to the same Deputy Director, without an independent review level between transaction initiation and approval. This creates a control gap in expenditure authorisation.',
                    'cause': 'Organisational structure has not been reviewed since the 2019 restructuring. No compensating controls have been implemented.',
                    'implication': 'Risk of unauthorised transactions, potential for fraud, and lack of accountability in financial management processes.',
                    'recommendation': 'The Accounting Officer should restructure reporting lines to ensure Finance and Procurement have independent oversight. Implement compensating controls including mandatory dual authorisation for transactions above TZS 5 million.',
                    'status': 'draft', 'created_by': auditor
                }
            )
            if r1:
                FindingRiskLink.objects.get_or_create(finding=f1, risk=r1, defaults={'linked_by': auditor})
            if r5:
                FindingRiskLink.objects.get_or_create(finding=f1, risk=r5, defaults={'linked_by': auditor})

            f2, _ = Finding.objects.get_or_create(
                engagement=eng1, finding_ref='FIND-002',
                defaults={
                    'title': 'Vacancy in Head of Internal Audit Position',
                    'criteria': 'Per the Public Audit Act and ISSAI 2315, entities are required to maintain a functional internal audit function as a key control mechanism.',
                    'finding_body': 'The Head of Internal Audit position has been vacant since March 2024. No acting officer has been formally appointed and internal audit activities have been suspended during this period.',
                    'cause': 'Recruitment process initiated in June 2024 has not been completed due to budget constraints.',
                    'implication': 'Absence of internal audit oversight increases the risk of errors and irregularities going undetected. Prior audit recommendations may not be monitored for implementation.',
                    'recommendation': 'Immediately appoint an acting Head of Internal Audit and expedite the substantive recruitment process. Consider engaging external internal audit services as a temporary measure.',
                    'status': 'draft', 'created_by': auditor
                }
            )
            if r2:
                FindingRiskLink.objects.get_or_create(finding=f2, risk=r2, defaults={'linked_by': auditor})

            f3, _ = Finding.objects.get_or_create(
                engagement=eng1, finding_ref='FIND-003',
                defaults={
                    'title': 'Management Pressure on Revenue Targets Creates Fraud Risk',
                    'criteria': 'Per ISSAI 2240, auditors must assess fraud risk factors including incentives and pressures that may lead to fraudulent financial reporting.',
                    'finding_body': 'Management is under significant pressure from the Ministry to meet ambitious revenue collection targets. This creates incentive to overstate revenue or delay recognition of revenue shortfalls. Combined with weak segregation of duties, this represents a significant fraud risk.',
                    'cause': 'Revenue targets for FY2024 were set at 40% above FY2023 actuals, based on projections that have not materialised.',
                    'implication': 'Risk of material misstatement in revenue figures. Prior year qualified opinion was on revenue completeness — same risk persists.',
                    'recommendation': 'Apply enhanced professional scepticism to revenue transactions. Perform detailed substantive testing on revenue recognition. Consider requesting management representations on revenue policies.',
                    'status': 'draft', 'created_by': auditor
                }
            )
            if r3:
                FindingRiskLink.objects.get_or_create(finding=f3, risk=r3, defaults={'linked_by': auditor})
            if r4:
                FindingRiskLink.objects.get_or_create(finding=f3, risk=r4, defaults={'linked_by': auditor})

        # ── ENGAGEMENT 2: In Progress (UE1-UE4 done) ──
        eng2, created2 = make_engagement('002', entity2, cea2, tl, 2025, 'active', 60)
        if created2:
            self.stdout.write(f'Created {eng2.engagement_code}: {entity2.name}')
            for code in ['UE1', 'UE2', 'UE3', 'UE4', 'FRF', 'PE2']:
                dt = doc_types.get(code)
                if dt:
                    Workpaper.objects.get_or_create(
                        engagement=eng2, document_type=dt,
                        defaults={
                            'form_data': {'S1_Q1': 'Ministry/Government Department', 'S1_Q3': 'IPSAS', 'S4_Q1': 'Regular/Annual Audit', 'completed': True},
                            'status': 'submitted', 'created_by': auditor, 'last_updated_by': auditor,
                            'submitted_at': timezone.now()
                        }
                    )
                    DocumentAssignment.objects.get_or_create(
                        engagement=eng2, document_type=dt,
                        defaults={'assigned_to': auditor, 'assigned_by': tl, 'status': 'tl_approved', 'deadline': date.today() + timedelta(days=45)}
                    )
            for code in ['UE5', 'UE6_1', 'UE6_2', 'UE7', 'UE8', 'RA1', 'RA2']:
                dt = doc_types.get(code)
                if dt:
                    DocumentAssignment.objects.get_or_create(
                        engagement=eng2, document_type=dt,
                        defaults={'assigned_to': auditor, 'assigned_by': tl, 'status': 'not_started', 'deadline': date.today() + timedelta(days=55)}
                    )

        # ── ENGAGEMENT 3: Just Started (UE1 only) ──
        eng3, created3 = make_engagement('003', entity3, cea3, tl, 2025, 'active', 90)
        if created3:
            self.stdout.write(f'Created {eng3.engagement_code}: {entity3.name}')
            dt_ue1 = doc_types.get('UE1')
            if dt_ue1:
                Workpaper.objects.get_or_create(
                    engagement=eng3, document_type=dt_ue1,
                    defaults={
                        'form_data': {'S1_Q1': 'Public Corporation/Parastatal', 'S1_Q3': 'IFRS'},
                        'status': 'draft', 'created_by': auditor, 'last_updated_by': auditor
                    }
                )
                DocumentAssignment.objects.get_or_create(
                    engagement=eng3, document_type=dt_ue1,
                    defaults={'assigned_to': auditor, 'assigned_by': tl, 'status': 'in_progress', 'deadline': date.today() + timedelta(days=14)}
                )
            for code in ['UE2', 'UE3', 'UE4', 'UE5', 'UE6_1', 'UE6_2', 'UE7', 'UE8', 'FRF', 'PE2', 'RA1', 'RA2']:
                dt = doc_types.get(code)
                if dt:
                    DocumentAssignment.objects.get_or_create(
                        engagement=eng3, document_type=dt,
                        defaults={'assigned_to': auditor, 'assigned_by': tl, 'status': 'not_started', 'deadline': date.today() + timedelta(days=60)}
                    )

        # ── ENGAGEMENT 4: Locked (TSSU approved) ──
        eng4, created4 = make_engagement('004', entity4, cea1, tl, 2024, 'locked', -30)
        if created4:
            self.stdout.write(f'Created {eng4.engagement_code}: {entity4.name}')
            eng4.locked_at = timezone.now() - timedelta(days=15)
            eng4.locked_by = admin
            eng4.save()
            for code, dt in doc_types.items():
                Workpaper.objects.get_or_create(
                    engagement=eng4, document_type=dt,
                    defaults={
                        'form_data': {'completed': True, 'S1_Q1': 'Statutory Corporation', 'S4_Q1': 'Regular/Annual Audit'},
                        'status': 'finalized', 'created_by': auditor, 'last_updated_by': auditor,
                        'submitted_at': timezone.now() - timedelta(days=45)
                    }
                )
                DocumentAssignment.objects.get_or_create(
                    engagement=eng4, document_type=dt,
                    defaults={'assigned_to': auditor, 'assigned_by': tl, 'status': 'finalized', 'deadline': date.today() - timedelta(days=30)}
                )

        # ── ENGAGEMENT 5: Returned by CEA ──
        eng5, created5 = make_engagement('005', entity5, cea1, tl, 2025, 'active', 30)
        if created5:
            self.stdout.write(f'Created {eng5.engagement_code}: {entity5.name}')
            for code, dt in doc_types.items():
                status = 'returned' if code in ['UE2', 'UE6_1'] else 'tl_approved'
                Workpaper.objects.get_or_create(
                    engagement=eng5, document_type=dt,
                    defaults={
                        'form_data': {'S1_Q1': 'Local Government Authority', 'S1_Q3': 'IPSAS', 'completed': True},
                        'status': status, 'created_by': auditor, 'last_updated_by': auditor,
                        'submitted_at': timezone.now() - timedelta(days=10)
                    }
                )
                DocumentAssignment.objects.get_or_create(
                    engagement=eng5, document_type=dt,
                    defaults={'assigned_to': auditor, 'assigned_by': tl, 'status': status, 'deadline': date.today() + timedelta(days=20)}
                )

        self.stdout.write(self.style.SUCCESS(f'\nTest data seeded successfully:'))
        from engagements.models import Engagement
        self.stdout.write(f'  Total engagements: {Engagement.objects.count()}')
        self.stdout.write(f'  Test engagements: {Engagement.objects.filter(engagement_code__startswith="ENG-TEST").count()}')
        from risks.models import Risk
        self.stdout.write(f'  Total risks: {Risk.objects.count()}')
        from findings.models import Finding
        self.stdout.write(f'  Total findings: {Finding.objects.count()}')
