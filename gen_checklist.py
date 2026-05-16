"""Generate APS Walkthrough & Test Checklist Excel file."""
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

wb = openpyxl.Workbook()

# ── Colour palette ─────────────────────────────────────────────
NAVY        = '1E3A5F'
NAVY_LIGHT  = 'E8EDF4'
NAVY_MID    = '2A5298'
WHITE       = 'FFFFFF'
GREEN       = 'D4EDDA'
GREEN_DARK  = '155724'
AMBER       = 'FFF3CD'
AMBER_DARK  = '856404'
GRAY_LIGHT  = 'F4F6F9'
GRAY_MED    = 'DEE2E6'
YELLOW_TICK = 'FFFDE7'

thin  = Side(style='thin',   color='DEE2E6')
thick = Side(style='medium', color='1E3A5F')
ba = Border(left=thin, right=thin, top=thin, bottom=thin)

def fl(h): return PatternFill('solid', fgColor=h)
def hf(sz=11, color=WHITE, bold=True):
    return Font(name='Calibri', bold=bold, size=sz, color=color)
def bf(sz=9,  color='212529', bold=False, italic=False):
    return Font(name='Calibri', bold=bold, size=sz, color=color, italic=italic)
def ctr(wrap=False): return Alignment(horizontal='center', vertical='center', wrap_text=wrap)
def lft(wrap=True):  return Alignment(horizontal='left',   vertical='center', wrap_text=wrap)

# ──────────────────────────────────────────────────────────────
# COVER SHEET
# ──────────────────────────────────────────────────────────────
wc = wb.active
wc.title = 'Cover'
wc.sheet_view.showGridLines = False
for col in ['A','B','C','D']:
    wc.column_dimensions[col].width = 30

for r in [1,2,3,4,5,6,7]:
    wc.row_dimensions[r].height = 24

wc.merge_cells('A1:D2')
wc['A1'] = 'NATIONAL AUDIT OFFICE OF TANZANIA'
wc['A1'].font = hf(sz=15); wc['A1'].fill = fl(NAVY); wc['A1'].alignment = ctr()

wc.merge_cells('A3:D4')
wc['A3'] = 'AUDIT PLANNING SYSTEM'
wc['A3'].font = hf(sz=22); wc['A3'].fill = fl(NAVY); wc['A3'].alignment = ctr()

wc.merge_cells('A5:D6')
wc['A5'] = 'System Walkthrough & Feature Test Checklist'
wc['A5'].font = Font('Calibri', bold=False, size=13, color=NAVY)
wc['A5'].fill = fl(NAVY_LIGHT); wc['A5'].alignment = ctr()

wc.merge_cells('A7:D7')
wc['A7'].fill = fl(NAVY_MID)

info = [
    ('Document Type', 'User Acceptance Test (UAT) Checklist'),
    ('System URL', 'http://localhost:5173'),
    ('Backend API', 'http://127.0.0.1:8001/api/'),
    ('Admin login', 'admin  /  Admin@2024!'),
    ('Test auditor login', 'test.auditor  /  Naot@2024!'),
    ('Test TL login', 'test.teamleader  /  Naot@2024!'),
    ('Test CEA login', 'valence.rutakyamirwa  /  Naot@2024!'),
    ('System version', 'APS v1.0 — Build 2026'),
]
for i, (lbl, val) in enumerate(info):
    r = 9 + i
    wc.row_dimensions[r].height = 20
    wc.merge_cells(f'A{r}:B{r}'); wc.merge_cells(f'C{r}:D{r}')
    wc[f'A{r}'] = lbl
    wc[f'A{r}'].font = bf(bold=True, color=NAVY); wc[f'A{r}'].fill = fl(NAVY_LIGHT)
    wc[f'A{r}'].alignment = lft(wrap=False); wc[f'A{r}'].border = ba
    wc[f'C{r}'] = val
    wc[f'C{r}'].font = bf(); wc[f'C{r}'].fill = fl(WHITE)
    wc[f'C{r}'].alignment = lft(wrap=False); wc[f'C{r}'].border = ba

wc.row_dimensions[19].height = 20
wc.merge_cells('A19:D19')
wc['A19'] = 'PRE-LOADED TEST ENGAGEMENTS'
wc['A19'].font = hf(sz=10); wc['A19'].fill = fl(NAVY); wc['A19'].alignment = ctr()

tengs = [
    ('ENG-TEST-001','in_review','13/13','Full package, 4 risks, 3 findings — primary test engagement'),
    ('ENG-TEST-002','active','6/13','Partial submission — TL review flow testing'),
    ('ENG-TEST-003','active','0/13','Just started (UE1 draft only) — clean workpaper entry'),
    ('ENG-TEST-004','locked','13/13','Locked 2024 engagement — export testing'),
    ('ENG-TEST-005','active','11/13','Some docs returned — return flow testing'),
]
wc.row_dimensions[20].height = 18
for ci,h in enumerate(['Engagement','Status','Progress','Test Purpose']):
    c = get_column_letter(ci+1)
    wc[f'{c}20'] = h
    wc[f'{c}20'].font = hf(sz=9); wc[f'{c}20'].fill = fl(NAVY_MID)
    wc[f'{c}20'].alignment = ctr(); wc[f'{c}20'].border = ba
for ri,row in enumerate(tengs):
    r = 21+ri; wc.row_dimensions[r].height = 18
    bg = GRAY_LIGHT if ri%2==0 else WHITE
    for ci,val in enumerate(row):
        c = get_column_letter(ci+1)
        wc[f'{c}{r}'] = val
        wc[f'{c}{r}'].font = bf(); wc[f'{c}{r}'].fill = fl(bg)
        wc[f'{c}{r}'].alignment = lft(wrap=False); wc[f'{c}{r}'].border = ba

wc.row_dimensions[28].height = 20
wc.merge_cells('A28:D28')
wc['A28'] = 'HOW TO USE THIS CHECKLIST'
wc['A28'].font = hf(sz=10); wc['A28'].fill = fl(NAVY); wc['A28'].alignment = ctr()

instrs = [
    'Each tab = one module. Work through them in order, top to bottom.',
    'For each test step: perform the action, check the expected result, then fill the Result column.',
    'Result options (dropdown in each sheet):  PASS  |  FAIL  |  PARTIAL  |  N/A',
    'Use the Notes / Issue column to record any problems, observations, or change requests.',
    'Fill in the Summary sheet totals after completing all modules.',
]
for i,line in enumerate(instrs):
    r = 29+i; wc.row_dimensions[r].height = 16
    wc.merge_cells(f'A{r}:D{r}')
    wc[f'A{r}'] = line
    wc[f'A{r}'].font = bf(sz=9, italic=('  ' in line))
    wc[f'A{r}'].fill = fl(NAVY_LIGHT); wc[f'A{r}'].alignment = lft(wrap=False)
    wc[f'A{r}'].border = ba


# ──────────────────────────────────────────────────────────────
# HELPER — build a module sheet
# ──────────────────────────────────────────────────────────────
def make_sheet(wb, tab, mno, title, desc, rows):
    ws = wb.create_sheet(tab)
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 7
    ws.column_dimensions['B'].width = 50
    ws.column_dimensions['C'].width = 40
    ws.column_dimensions['D'].width = 13
    ws.column_dimensions['E'].width = 38

    ws.row_dimensions[1].height = 30
    ws.merge_cells('A1:E1')
    ws['A1'] = f'MODULE {mno} — {title.upper()}'
    ws['A1'].font = hf(sz=13); ws['A1'].fill = fl(NAVY); ws['A1'].alignment = ctr()

    ws.row_dimensions[2].height = 16
    ws.merge_cells('A2:E2')
    ws['A2'] = desc
    ws['A2'].font = bf(sz=8, italic=True, color=NAVY)
    ws['A2'].fill = fl(NAVY_LIGHT); ws['A2'].alignment = lft(wrap=False)

    ws.row_dimensions[3].height = 22
    for ci,h in enumerate(['#','Action / Test Step','Expected Result','Result','Notes / Issue']):
        c = get_column_letter(ci+1)
        ws[f'{c}3'] = h
        ws[f'{c}3'].font = hf(sz=10); ws[f'{c}3'].fill = fl(NAVY)
        ws[f'{c}3'].alignment = ctr(); ws[f'{c}3'].border = ba

    dv = DataValidation(type='list', formula1='"PASS,FAIL,PARTIAL,N/A"', allow_blank=True)
    dv.sqref = 'D4:D500'
    ws.add_data_validation(dv)

    cur = 4
    sec_idx = 0

    for item in rows:
        t = item.get('type','test')

        if t == 'section':
            ws.row_dimensions[cur].height = 18
            ws.merge_cells(f'A{cur}:E{cur}')
            ws[f'A{cur}'] = f'   ▸   {item["title"]}'
            ws[f'A{cur}'].font = hf(sz=9); ws[f'A{cur}'].fill = fl(NAVY_MID)
            ws[f'A{cur}'].alignment = lft(wrap=False); ws[f'A{cur}'].border = ba
            sec_idx += 1; cur += 1

        elif t == 'note':
            ws.row_dimensions[cur].height = 16
            ws.merge_cells(f'A{cur}:E{cur}')
            ws[f'A{cur}'] = f'  ℹ  {item["text"]}'
            ws[f'A{cur}'].font = bf(sz=8, italic=True, color=AMBER_DARK)
            ws[f'A{cur}'].fill = fl(AMBER); ws[f'A{cur}'].alignment = lft(wrap=True)
            ws[f'A{cur}'].border = ba; cur += 1

        else:
            bg = GRAY_LIGHT if sec_idx%2==0 else WHITE
            ws.row_dimensions[cur].height = 30

            ws[f'A{cur}'] = item.get('id','')
            ws[f'A{cur}'].font = bf(bold=True, sz=9, color=NAVY)
            ws[f'A{cur}'].fill = fl(NAVY_LIGHT); ws[f'A{cur}'].alignment = ctr()
            ws[f'A{cur}'].border = ba

            ws[f'B{cur}'] = item.get('action','')
            ws[f'B{cur}'].font = bf(sz=9); ws[f'B{cur}'].fill = fl(bg)
            ws[f'B{cur}'].alignment = lft(wrap=True); ws[f'B{cur}'].border = ba

            ws[f'C{cur}'] = item.get('expected','')
            ws[f'C{cur}'].font = bf(sz=9, italic=True, color=GREEN_DARK)
            ws[f'C{cur}'].fill = fl(bg); ws[f'C{cur}'].alignment = lft(wrap=True)
            ws[f'C{cur}'].border = ba

            ws[f'D{cur}'] = ''
            ws[f'D{cur}'].fill = fl(YELLOW_TICK); ws[f'D{cur}'].alignment = ctr()
            ws[f'D{cur}'].border = ba

            ws[f'E{cur}'] = ''
            ws[f'E{cur}'].fill = fl(WHITE); ws[f'E{cur}'].alignment = lft(wrap=True)
            ws[f'E{cur}'].border = ba

            cur += 1

    ws.freeze_panes = 'A4'
    return ws


# ──────────────────────────────────────────────────────────────
# MODULE 1 — LOGIN & AUTH
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M1 Login & Auth','1','Login & Authentication',
    'JWT auth, session timeout, role-based login, password policies.',
[
    {'id':'1.1','action':'Open http://localhost:5173 in browser','expected':'Login page appears with NAOT branding, username and password fields'},
    {'id':'1.2','action':'Enter username: admin — enter WRONG password — click Login','expected':'Error message: Invalid credentials. Account NOT yet locked.'},
    {'id':'1.3','action':'Enter wrong password 3 more times consecutively','expected':'Account lock warning or login blocked temporarily'},
    {'id':'1.4','action':'Enter correct credentials: admin / Admin@2024!','expected':'Redirects to Dashboard; no errors'},
    {'id':'1.5','action':'Click your username or avatar (top-right corner)','expected':'Opens Profile page showing name, role badge, email'},
    {'id':'1.6','action':'Click Change Password on Profile page','expected':'Change password form with Current / New / Confirm fields'},
    {'id':'1.7','action':'Enter a new password identical to current (reuse)','expected':'Error: cannot reuse last 3 passwords'},
    {'id':'1.8','action':'Enter a valid new password and confirm','expected':'Success; redirect to Dashboard; new password works on next login'},
    {'id':'1.9','action':'Log out via sidebar or profile menu','expected':'Redirects to login page; cannot access protected pages directly'},
    {'id':'1.10','action':'Log in as test.auditor / Naot@2024!','expected':'Auditor-level Dashboard (no New Engagement button visible)'},
    {'id':'1.11','action':'Log in as test.teamleader / Naot@2024!','expected':'TL-level Dashboard; TL-specific features visible'},
    {'id':'1.12','action':'Log in as valence.rutakyamirwa / Naot@2024!','expected':'CEA Dashboard; Management Dashboard link visible in sidebar'},
    {'id':'1.13','action':'Leave browser idle for 5 minutes without any interaction','expected':'Session expires; next click redirects to login page automatically'},
    {'type':'note','text':'If test account passwords do not work: Admin → Users → find user → Reset Password to Naot@2024!'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 2 — DASHBOARD
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M2 Dashboard','2','Dashboard',
    'Live stat cards, scoped engagement display per role, navigation links.',
[
    {'id':'2.1','action':'Log in as admin. Observe Dashboard layout.','expected':'4 stat cards: Active Engagements, In Review, Total Risks, Total Findings'},
    {'id':'2.2','action':'Check Active Engagements stat card value','expected':'Matches real DB count — not a hardcoded placeholder number'},
    {'id':'2.3','action':'Check Total Risks and Total Findings cards','expected':'Counts match seeded data: at least 4 risks and 3 findings'},
    {'id':'2.4','action':'Look at Recent Engagements table on dashboard','expected':'5 test engagements listed: code, entity, year, status, deadline'},
    {'id':'2.5','action':'Click any engagement row in the Recent Engagements table','expected':'Navigates to that engagement\'s detail page'},
    {'id':'2.6','action':'Click "View all →" link above the engagements table','expected':'Goes to full Engagements list (/engagements)'},
    {'id':'2.7','action':'Click "Management Dashboard" quick action card (admin)','expected':'Opens management analytics page (CEA+ feature)'},
    {'id':'2.8','action':'Log out. Log in as test.auditor. Check dashboard.','expected':'Shows only engagements assigned to that auditor (scoped view)'},
    {'id':'2.9','action':'Log in as test.teamleader. Check dashboard.','expected':'Shows only engagements where they are the team leader'},
    {'id':'2.10','action':'Log in as valence.rutakyamirwa (CEA). Check dashboard.','expected':'Shows only engagements where they are responsible_person (CEA)'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 3 — ENGAGEMENTS LIST
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M3 Engagements List','3','Engagements List',
    'Search, filter by status/year, progress bars, deadline colours, engagement creation.',
[
    {'id':'3.1','action':'Navigate to /engagements via sidebar','expected':'Table loads with all 5 test engagements (ENG-TEST-001 through 005)'},
    {'id':'3.2','action':'Type "TEST-001" in the search box','expected':'Only ENG-TEST-001 is shown; all others filtered out'},
    {'id':'3.3','action':'Clear search. Set Status filter → locked','expected':'Only ENG-TEST-004 is shown'},
    {'id':'3.4','action':'Clear status filter. Set Year filter → 2024','expected':'Only ENG-TEST-004 is shown (it is the 2024 engagement)'},
    {'id':'3.5','action':'Clear all filters. Check ENG-TEST-002 progress bar','expected':'Progress bar shows 6/13 (~46% fill)'},
    {'id':'3.6','action':'Check ENG-TEST-003 progress bar','expected':'Progress bar shows 0/13 (empty bar)'},
    {'id':'3.7','action':'Check ENG-TEST-001 progress bar','expected':'Progress bar shows 13/13 (full bar, 100%)'},
    {'id':'3.8','action':'Observe deadline column colours','expected':'Overdue = red text with "X d overdue"; near-due = amber; safe = dark text'},
    {'id':'3.9','action':'Click anywhere on an engagement row (not the View button)','expected':'Navigates to engagement detail page'},
    {'id':'3.10','action':'Click the View button at the end of a row','expected':'Also navigates to engagement detail page'},
    {'id':'3.11','action':'Log in as admin. Click New Engagement button (top right).','expected':'New engagement creation form opens'},
    {'id':'3.12','action':'Fill in: Entity (search any), Year=2025, TL, Deadline. Click Create.','expected':'Engagement created with auto-generated code (format: ENG-2025-XXXX)'},
    {'type':'note','text':'New Engagement button is only visible for CEA, AAG, DAG, and Admin roles — not visible to Auditors or TLs.'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 4 — ENGAGEMENT DETAIL
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M4 Engagement Detail','4','Engagement Detail Page',
    'All 7 tabs: Overview, Team, Documents, Risks, Findings, Review, Export.',
[
    {'type':'section','title':'4A — Overview Tab  (open ENG-TEST-001)'},
    {'id':'4A.1','action':'Open ENG-TEST-001. Click Overview tab.','expected':'Two cards: Entity Details (left) and Engagement Progress (right)'},
    {'id':'4A.2','action':'Check documents submitted progress bar','expected':'Shows 100% (13/13 submitted) with full blue bar'},
    {'id':'4A.3','action':'Check Overall Status badge','expected':'Shows "In Review" status badge'},
    {'id':'4A.4','action':'Check Overall Deadline section','expected':'Shows date + days-left badge in green/amber/red'},
    {'id':'4A.5','action':'Check Entity Details card fields','expected':'Entity name, audit period, reporting framework, currency, TL name all populated'},
    {'type':'section','title':'4B — Team Tab'},
    {'id':'4B.1','action':'Click Team tab on ENG-TEST-001','expected':'3 members: valence.rutakyamirwa (CEA), test.teamleader (TL), test.auditor (Auditor)'},
    {'id':'4B.2','action':'As admin, click Add Member button','expected':'Modal with User dropdown and Engagement Role dropdown opens'},
    {'id':'4B.3','action':'Select any user + role, click Add Member in modal','expected':'New member appears in team table immediately, no page reload'},
    {'id':'4B.4','action':'Click trash icon next to the member just added','expected':'Member removed from table without page reload'},
    {'type':'section','title':'4C — Documents Tab'},
    {'id':'4C.1','action':'Click Documents tab on ENG-TEST-001','expected':'3 summary stat boxes (Submitted / TL Approved / Total) + 13-row table'},
    {'id':'4C.2','action':'Check each document row for code badge','expected':'Each row shows a monospace code badge: UE1, UE2, UE3 … RA2'},
    {'id':'4C.3','action':'Check Assigned To column for all rows','expected':'Each document shows the assigned auditor\'s full name'},
    {'id':'4C.4','action':'Click Open button on the UE1 row','expected':'Opens UE1 workpaper form in full-screen editor'},
    {'id':'4C.5','action':'Click back arrow (top-left) on workpaper page','expected':'Returns to ENG-TEST-001 detail page, Documents tab'},
    {'id':'4C.6','action':'Open ENG-TEST-004 (locked). Click Documents tab.','expected':'All 13 rows show lock icon; Open buttons replaced with "Locked" label'},
    {'type':'section','title':'4D — Risks Tab'},
    {'id':'4D.1','action':'Click Risks tab on ENG-TEST-001','expected':'4 coloured severity boxes (High-Pervasive, High, Medium, Low) with counts'},
    {'id':'4D.2','action':'Verify severity counts match seeded data','expected':'High-Pervasive: 2, High: 1+, Medium: 0+ (approximate — check against seeded risks)'},
    {'id':'4D.3','action':'Check Top Active Risks list below the boxes','expected':'Up to 5 risks shown with severity pill, description, source doc reference'},
    {'id':'4D.4','action':'Click View Full Risk Register button','expected':'Opens full-screen risk register at /engagements/1/risks'},
    {'type':'section','title':'4E — Findings Tab'},
    {'id':'4E.1','action':'Click Findings tab on ENG-TEST-001','expected':'3 findings: FIND-001, FIND-002, FIND-003 shown with status chips'},
    {'id':'4E.2','action':'Verify finding statuses','expected':'All 3 show "Draft" status (pre-seeded)'},
    {'id':'4E.3','action':'Click View All Findings button','expected':'Opens full findings collection page at /engagements/1/findings'},
    {'type':'section','title':'4F — Review Tab'},
    {'id':'4F.1','action':'Click Review tab on ENG-TEST-001 (status: in_review)','expected':'"Open Review Panel" button is visible and clickable'},
    {'id':'4F.2','action':'Click Review tab on ENG-TEST-003 (status: active, not yet submitted)','expected':'Message: Review panel not available yet. Current status shown.'},
    {'id':'4F.3','action':'Click Open Review Panel on ENG-TEST-001','expected':'Full-screen review panel opens at /engagements/1/review'},
    {'type':'section','title':'4G — Export Tab'},
    {'id':'4G.1','action':'Click Export tab on ENG-TEST-003 (active, not locked)','expected':'Message: Export not available until engagement is locked'},
    {'id':'4G.2','action':'Click Export tab on ENG-TEST-004 (locked)','expected':'"Open Export Page" button visible and enabled'},
    {'id':'4G.3','action':'Click Open Export Page','expected':'Export page opens with Excel / PDF / Word Findings options'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 5 — WORKPAPER FORMS
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M5 Workpaper Forms','5','Workpaper Forms (All 13)',
    'Auto-save, data persistence, risk triggers, sequential unlock, submit workflow.',
[
    {'type':'note','text':'Use ENG-TEST-003 for workpaper entry tests — it has clean/empty forms. Use ENG-TEST-001 to verify already-submitted data.'},
    {'type':'section','title':'5A — General Form Behaviour (test on any document)'},
    {'id':'5A.1','action':'Open any workpaper from ENG-TEST-003 → Documents tab → Open','expected':'Full-screen editor: document navigator (left), form sections (right), Save/Submit bar (bottom)'},
    {'id':'5A.2','action':'Check document navigator panel on the left','expected':'All 13 docs listed; submitted ones have green indicator; locked ones are greyed'},
    {'id':'5A.3','action':'Fill in any text field. Wait 60 seconds without clicking Save.','expected':'"Saved just now" indicator appears at top-right automatically (auto-save)'},
    {'id':'5A.4','action':'Click Save Draft button manually','expected':'"Saving…" spinner → "Saved just now" indicator within 1–2 seconds'},
    {'id':'5A.5','action':'Click back arrow (top-left)','expected':'Returns to engagement detail; no data loss warning'},
    {'id':'5A.6','action':'Reopen the same document','expected':'All previously entered data is still there (persisted to DB as JSONB)'},
    {'id':'5A.7','action':'Leave all fields empty. Observe Submit button.','expected':'Submit for TL Review button is disabled when form is empty/incomplete'},
    {'type':'section','title':'5B — UE1 Risk Trigger Test'},
    {'id':'5B.1','action':'Open UE1 for ENG-TEST-003. Find Key Personnel section.','expected':'Table with rows: Accounting Officer, Director of Finance, Head of Internal Audit, Head of Procurement'},
    {'id':'5B.2','action':'Change any person\'s Status dropdown to "Vacant"','expected':'A yellow/red risk banner appears: "Key position vacant — risk of oversight gaps"'},
    {'id':'5B.3','action':'Change a second person\'s Status to "Acting (6+ months)"','expected':'A second risk banner appears: "Key personnel in acting position"'},
    {'id':'5B.4','action':'Click Save Draft','expected':'Both risks saved to risk register. Navigate to Risks tab to confirm 2 new risks.'},
    {'id':'5B.5','action':'Change the "Vacant" person back to "Substantive". Click Save Draft.','expected':'Vacant risk banner disappears. Risk auto-dismissed in register.'},
    {'id':'5B.6','action':'In Section 4 (Prior Engagement Info), set Audit Type to "Follow-up"','expected':'Risk banner: "Prior year findings unresolved — follow-up engagement"'},
    {'type':'section','title':'5C — Document Sequential Unlock'},
    {'id':'5C.1','action':'In ENG-TEST-003 document navigator, look at UE2','expected':'UE2 shows as locked (padlock or greyed out) — UE1 not yet submitted'},
    {'id':'5C.2','action':'Fill UE1 sufficiently and click Submit for TL Review','expected':'UE1 status → Submitted. UE2 unlocks immediately in navigator.'},
    {'id':'5C.3','action':'Check UE3 in navigator (before UE2 is submitted)','expected':'UE3 is still locked — cannot be opened'},
    {'id':'5C.4','action':'Fill and submit UE2. Then check UE3.','expected':'UE3 unlocks after UE2 submission'},
    {'type':'section','title':'5D — Risk Trigger Coverage (one test per document)'},
    {'id':'5D.1','action':'UE2: Set "Is board/council functional?" to No. Save.','expected':'Risk: Board/council not functional — High Pervasive'},
    {'id':'5D.2','action':'UE3: Set "Known or suspected NOCLAR?" to Yes. Save.','expected':'Risk: Known NOCLAR — High'},
    {'id':'5D.3','action':'UE3: Set "Overall NOCLAR risk level" to High. Save.','expected':'Risk: High overall NOCLAR risk — High'},
    {'id':'5D.4','action':'UE4: Set "IT systems adequate?" to No. Save.','expected':'Risk: Inadequate IT systems — High'},
    {'id':'5D.5','action':'UE4: Set "Related party relationships significant?" to Yes. Save.','expected':'Risk: Related party relationships — Medium'},
    {'id':'5D.6','action':'UE5: Set "Fraud identified or suspected?" (SA_Q1) to Yes. Save.','expected':'Risk: Fraud identified — High Pervasive'},
    {'id':'5D.7','action':'UE5: Set "Management fraud incentives/pressures?" (SA_Q3) to Yes. Save.','expected':'Risk: Management fraud incentives — High Pervasive'},
    {'id':'5D.8','action':'UE5: Set "Cash shortages?" (SA_Q7) to Yes. Save.','expected':'Risk: Cash shortages — High (COTABD: Cash)'},
    {'id':'5D.9','action':'UE6_1: Set "Segregation of duties adequate?" (S2_Q2) to No. Save.','expected':'Risk: Inadequate segregation — High Pervasive'},
    {'id':'5D.10','action':'UE6_1: Set "Payroll controls adequate?" (S2_Q6) to No. Save.','expected':'Risk: Inadequate payroll controls — High (COTABD: Wages)'},
    {'id':'5D.11','action':'UE6_2: Set "Unauthorized access prevented?" (S1_Q2) to No. Save.','expected':'Risk: Unauthorized access possible — High Pervasive'},
    {'id':'5D.12','action':'UE6_2: Set "Data backups performed?" (S3_Q2) to No. Save.','expected':'Risk: No data backups — High'},
    {'id':'5D.13','action':'UE7: Set "Going concern issues?" (S4_Q1) to Yes. Save.','expected':'Risk: Going concern — High Pervasive'},
    {'id':'5D.14','action':'UE7: Set "Pending litigation?" (S1_Q1) to Yes. Save.','expected':'Risk: Pending litigation — Medium (COTABD: Provisions)'},
    {'id':'5D.15','action':'UE8: Set "Overall FS risk level" (S3_Q3) to High. Save.','expected':'Risk: High overall FS risk — High Pervasive'},
    {'id':'5D.16','action':'FRF: Set "Framework appropriate?" (S1_Q4) to No. Save.','expected':'Risk: Framework not appropriate — High Pervasive'},
    {'id':'5D.17','action':'PE2: Set "Team has required competencies?" (S4_Q1) to No. Save.','expected':'Risk: Team lacks competency — High Pervasive'},
    {'type':'note','text':'After each trigger test: navigate to Risks tab to confirm the risk appeared with the correct severity and source document.'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 5B — WORKPAPER FORM GRID
# ──────────────────────────────────────────────────────────────
wg = wb.create_sheet('M5B Form Grid')
wg.sheet_view.showGridLines = False
wg.column_dimensions['A'].width = 22
wg.column_dimensions['B'].width = 40
wg.column_dimensions['C'].width = 13
wg.column_dimensions['D'].width = 13
wg.column_dimensions['E'].width = 13
wg.column_dimensions['F'].width = 36

wg.row_dimensions[1].height = 28
wg.merge_cells('A1:F1')
wg['A1'] = 'MODULE 5B — ALL 13 WORKPAPER FORMS: INDIVIDUAL CHECKLIST'
wg['A1'].font = hf(sz=13); wg['A1'].fill = fl(NAVY); wg['A1'].alignment = ctr()

wg.row_dimensions[2].height = 16
wg.merge_cells('A2:F2')
wg['A2'] = 'For each form: open it, fill at least one field per section, save, navigate away, reopen to verify data persists, trigger at least one risk, then submit.'
wg['A2'].font = bf(sz=8, italic=True, color=NAVY)
wg['A2'].fill = fl(NAVY_LIGHT); wg['A2'].alignment = lft(wrap=False)

wg.row_dimensions[3].height = 20
for ci,h in enumerate(['Document','Risk Triggers to Test (field = value)','Opens OK','Data Saves','Risks Fire','Notes']):
    c = get_column_letter(ci+1)
    wg[f'{c}3'] = h
    wg[f'{c}3'].font = hf(sz=9); wg[f'{c}3'].fill = fl(NAVY)
    wg[f'{c}3'].alignment = ctr(); wg[f'{c}3'].border = ba

dv3 = DataValidation(type='list', formula1='"PASS,FAIL,PARTIAL,N/A"', allow_blank=True)
dv3.sqref = 'C4:E50'
wg.add_data_validation(dv3)

forms = [
    ('FRF\nFinancial Reporting Framework',
     'S1_Q4 = No  → Framework not appropriate (High-Pervasive)\nS2_Q2 = No  → Not consistently applied (Medium)\nS2_Q3 = Yes → Significant departures (High)\nS4_Q1 = Not Acceptable → Framework unacceptable (High-Pervasive)'),
    ('PE2\nEngagement Team Competencies',
     'S4_Q1 = No  → Team lacks competency (High-Pervasive)'),
    ('UE1\nGeneral Information',
     'Key personnel Status = Vacant → Vacancy risk (High-Pervasive)\nKey personnel Status = Acting (6+ months) → Acting risk (Medium-Pervasive)\nAudit engagement type = Follow-up → Follow-up risk (Medium)'),
    ('UE2\nGovernance Review',
     'governance_q1 = No → Board not functional (High-Pervasive)\ngovernance_q2 = No → Meetings not held (High-Pervasive)'),
    ('UE3\nLegal & NOCLAR',
     'S4_Q2 = Yes → NOCLAR known or suspected (High)\nS4_Q4 = High → High overall NOCLAR risk (High)'),
    ('UE4\nOperations & Strategy',
     'S2_Q3 = Yes → Outsourced functions (Medium)\nS2_Q4 = Yes → Restructuring risk (Medium-Pervasive)\nS2_Q5 = No  → Inadequate IT systems (High)\nS4_Q3 = Yes → Pending legal cases (Medium)\nS4_Q5 = Yes → Related parties (Medium)\nS5_Q1 = No  → No strategic plan (Medium-Pervasive)'),
    ('UE5\nFraud Risk Assessment',
     'SA_Q1=Yes (Fraud identified), SA_Q3=Yes (Fraud incentives),\nSA_Q4=Yes (Fraud opportunity), SA_Q5=Yes (Mgmt override),\nSA_Q6=Yes (Complex txns), SA_Q7=Yes (Cash shortages),\nSA_Q8=Yes (Unusual journals), SA_Q9=Yes (Unusual RPT),\nSA_Q10=Yes (Revenue recognition), SA_Q11=Yes (Staff resistant),\nSA_Q12=Yes (Procurement without process)\n[11 triggers total]'),
    ('UE6_1\nInternal Controls — Financial',
     'S2_Q1=No (No auth procedures), S2_Q2=No (Poor segregation),\nS2_Q3=No (Assets not safeguarded), S2_Q4=No (No reconciliations),\nS2_Q5=No (Poor procurement), S2_Q6=No (Poor payroll),\nS2_Q7=No (Poor revenue ctrl), S3_Q1=No (Financial info weak),\nS3_Q4=No (Weak FR controls), S4_Q3=No (IA not implemented),\nS4_Q4=No (Prior findings unresolved)\n[11 triggers total]'),
    ('UE6_2\nIT General Controls',
     'S1_Q2=No (Unauthorised access), S1_Q3=No (No access mgmt),\nS1_Q4=No (Weak passwords), S1_Q5=No (No activity log),\nS1_Q6=No (No IT segregation), S2_Q2=No (Untested changes),\nS3_Q1=No (No BCP), S3_Q2=No (No backups),\nS3_Q3=No (No data validation), S3_Q4=No (No audit trail)\n[10 triggers total]'),
    ('UE7\nSpecific Risk Areas',
     'S1_Q1=Yes (Litigation), S2_Q1=Yes (RPT identified),\nS2_Q4=No (RPT not disclosed), S3_Q1=Yes (Subsequent events),\nS4_Q1=Yes (Going concern), S4_Q3=Yes (Unrecorded commitments)\n[6 triggers total]'),
    ('UE8\nOverall Financial Statement Risk',
     'S3_Q3 = High → High overall FS risk (High-Pervasive)\n[1 trigger total]'),
    ('RA1\nPervasive Risk Assessment',
     'No automatic triggers.\nManually consolidates pervasive risks from all UE documents.\nVerify: table pre-populates from risk register.'),
    ('RA2\nCOTABD Risk Assessment',
     'No automatic triggers.\nManually populated per balance-sheet area.\nVerify: all COTABDs listed; risk ratings can be set per area.'),
]

for ri,(code,triggers) in enumerate(forms):
    r = 4+ri; wg.row_dimensions[r].height = 65
    bg = GRAY_LIGHT if ri%2==0 else WHITE
    wg[f'A{r}'] = code
    wg[f'A{r}'].font = bf(bold=True, sz=9, color=NAVY)
    wg[f'A{r}'].fill = fl(NAVY_LIGHT); wg[f'A{r}'].alignment = lft(wrap=True); wg[f'A{r}'].border = ba
    wg[f'B{r}'] = triggers
    wg[f'B{r}'].font = bf(sz=8, color=GREEN_DARK)
    wg[f'B{r}'].fill = fl(bg); wg[f'B{r}'].alignment = lft(wrap=True); wg[f'B{r}'].border = ba
    for col in ['C','D','E']:
        wg[f'{col}{r}'] = ''
        wg[f'{col}{r}'].fill = fl(YELLOW_TICK); wg[f'{col}{r}'].alignment = ctr(); wg[f'{col}{r}'].border = ba
    wg[f'F{r}'] = ''
    wg[f'F{r}'].fill = fl(WHITE); wg[f'F{r}'].alignment = lft(wrap=True); wg[f'F{r}'].border = ba

wg.freeze_panes = 'A4'


# ──────────────────────────────────────────────────────────────
# MODULE 6 — RISK REGISTER
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M6 Risk Register','6','Risk Register',
    'Auto-generated risks, dismiss workflow, finding generation, auto-dismiss on condition removal.',
[
    {'type':'note','text':'ENG-TEST-001 has 4 pre-seeded risks. Use it for tests 6.1–6.9. Then use your triggered risks from Module 5.'},
    {'id':'6.1','action':'ENG-TEST-001 → Risks tab → Click View Full Risk Register','expected':'Full-screen register at /engagements/1/risks with all active risks'},
    {'id':'6.2','action':'Check the severity summary boxes at the top','expected':'Colour-coded count boxes: High-Pervasive (dark red), High (red), Medium (amber), Low (green)'},
    {'id':'6.3','action':'Expand or view a risk row to see full detail','expected':'Shows: source doc, source section, trigger question, trigger answer, inherent risk factor, assertions'},
    {'id':'6.4','action':'Find RISK-E1-002 (Head of Internal Audit — Vacant)','expected':'Severity: High-Pervasive. Source document: UE1. Is Pervasive: Yes.'},
    {'id':'6.5','action':'Click Dismiss on any active risk','expected':'Dismiss modal opens with a required reason text field'},
    {'id':'6.6','action':'Enter a dismissal reason and click Confirm Dismiss','expected':'Risk status → Dismissed. Moves to dismissed section or shows strikethrough/grey styling.'},
    {'id':'6.7','action':'Click Generate Finding on RISK-E1-003 (Segregation of Duties)','expected':'Finding generation modal opens with 6 ISSAI fields pre-filled from risk data'},
    {'id':'6.8','action':'Edit the Recommendation field in the modal. Click Generate.','expected':'Finding created. Reference number assigned (FIND-XXX). Modal closes.'},
    {'id':'6.9','action':'Navigate to Findings tab for ENG-TEST-001','expected':'New finding appears in list, linked to RISK-E1-003'},
    {'id':'6.10','action':'Go to UE5 for any engagement. Set SA_Q1 (fraud identified) = Yes. Save.','expected':'New High-Pervasive risk auto-generated and appears in risk register'},
    {'id':'6.11','action':'Change SA_Q1 back to No. Save Draft again.','expected':'Risk is auto-dismissed (condition no longer met). Status changes to Dismissed.'},
    {'id':'6.12','action':'Check that dismissed risk shows dismissal reason: "Condition no longer met"','expected':'Auto-dismissal reason is set automatically by the system'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 7 — FINDINGS
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M7 Findings','7','Findings Collection',
    'ISSAI-structured findings: view, edit, submit, and risk-finding linkage.',
[
    {'type':'note','text':'ENG-TEST-001 has 3 pre-seeded findings: FIND-001 (Segregation of Duties), FIND-002 (IA Vacant), FIND-003 (Revenue Pressure).'},
    {'id':'7.1','action':'Open /engagements/1/findings (Findings Collection page)','expected':'3 findings in list with: Ref, Title, Status, Created By columns'},
    {'id':'7.2','action':'Expand or open FIND-001 to view full detail','expected':'6 ISSAI fields visible: Criteria, Finding Body, Cause, Implication, Recommendation, linked risks'},
    {'id':'7.3','action':'Check linked risk badge/section on FIND-001','expected':'Shows RISK-E1-003 as the linked risk (Segregation of Duties)'},
    {'id':'7.4','action':'Check FIND-002 linked risk','expected':'Shows RISK-E1-002 (Head of IA Vacant)'},
    {'id':'7.5','action':'Edit the Recommendation field on FIND-002','expected':'Field becomes editable; can type new text'},
    {'id':'7.6','action':'Save the edited finding','expected':'Changes persist; "saved" indicator shown'},
    {'id':'7.7','action':'Click Submit on FIND-001 (status is Draft)','expected':'Status changes from Draft → Submitted'},
    {'id':'7.8','action':'Verify all finding references use FIND-XXX format','expected':'Sequential numbering: FIND-001, FIND-002, FIND-003 with leading zeros'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 8 — REVIEW WORKFLOW
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M8 Review Workflow','8','Review Workflow (6-Level Chain)',
    'Full TL→CEA→AAG→DAG→TSSU chain, return flows, notifications, lock/unlock.',
[
    {'type':'note','text':'Switch between user accounts for each phase. Use ENG-TEST-002 (partial, active). Prepare by having TL approve all 6 submitted docs first.'},
    {'type':'section','title':'8A — TL Reviews Individual Documents'},
    {'id':'8A.1','action':'Log in as test.teamleader. Open ENG-TEST-002 → Review tab → Open Review Panel.','expected':'TL Review screen: list of submitted documents with Approve and Return buttons per document'},
    {'id':'8A.2','action':'Click Approve on UE1','expected':'UE1 status changes to "TL Approved" (green tick/badge)'},
    {'id':'8A.3','action':'Click Return on UE2. Enter a comment. Click Confirm.','expected':'UE2 status → Returned (red). Notification sent to assigned auditor.'},
    {'id':'8A.4','action':'Approve all remaining submitted documents (UE3, UE4, FRF, PE2)','expected':'All 6 submitted docs show TL Approved status'},
    {'id':'8A.5','action':'Observe Submit Package to CEA button state','expected':'Button is DISABLED while any submitted doc is not TL Approved. Enables only when all approved.'},
    {'id':'8A.6','action':'Click Submit Package to CEA','expected':'Package v1 created. Engagement status → in_review. CEA user(s) notified.'},
    {'type':'section','title':'8B — CEA Reviews Package'},
    {'id':'8B.1','action':'Log in as valence.rutakyamirwa (CEA). Check notification bell.','expected':'Bell shows new notification: "Package ready for review: ENG-TEST-002"'},
    {'id':'8B.2','action':'Click notification or navigate to package','expected':'Package detail view: all documents, assignment statuses, TL review history'},
    {'id':'8B.3','action':'Scroll through document list in package','expected':'Each document: name, code, assignment status, assigned-to name, any TL flags/comments'},
    {'id':'8B.4','action':'Click Approve Package','expected':'Package advances to AAG level (level 4). AAG users notified.'},
    {'type':'section','title':'8C — Return Flow — CEA Returns to TL'},
    {'id':'8C.1','action':'On a separate test: CEA clicks Return Package','expected':'Return modal: return-to level selector, comment field, document flag checkboxes'},
    {'id':'8C.2','action':'Select "Return to: Team Leader". Flag UE1 with comment. Click Submit.','expected':'Package status → Returned. UE1 assignment → Returned. TL notified with comment and flagged docs list.'},
    {'id':'8C.3','action':'Log in as test.teamleader. Check notifications.','expected':'Notification: Package returned to TL. Message lists flagged documents.'},
    {'type':'section','title':'8D — Return Flow — CEA Returns to Auditor'},
    {'id':'8D.1','action':'CEA returns with "Return to: Auditor". Flag UE2 with comment.','expected':'UE2 assigned auditor notified directly. TL also CC\'d.'},
    {'id':'8D.2','action':'Log in as test.auditor. Check notifications.','expected':'Notification: Document UE2 returned. Comment from reviewer included.'},
    {'type':'section','title':'8E — TSSU Final Approval and Lock'},
    {'id':'8E.1','action':'Log in as admin. Find a package that has reached TSSU level.','expected':'Can see full package detail with complete review history from all prior levels'},
    {'id':'8E.2','action':'Click Approve as TSSU','expected':'Package → Locked. Engagement → Locked. All documents → Finalized. Whole team notified.'},
    {'id':'8E.3','action':'Try to open any workpaper in the now-locked engagement','expected':'All Open buttons replaced with Locked. Cannot edit any workpaper.'},
    {'id':'8E.4','action':'Use Lock button directly on a package (manual lock as admin)','expected':'Same result: engagement locked, documents finalized'},
    {'type':'section','title':'8F — Unlock Engagement'},
    {'id':'8F.1','action':'As admin, find locked ENG-TEST-004. Navigate to unlock option.','expected':'Unlock requires a mandatory reason field'},
    {'id':'8F.2','action':'Enter reason and confirm unlock','expected':'Engagement → Active. TL notified. Workpapers editable again.'},
    {'type':'section','title':'8G — Package Version History'},
    {'id':'8G.1','action':'After TL re-approves returned docs and resubmits, check package list','expected':'Package v2 appears alongside v1. v1 shows Returned status, v2 shows Pending.'},
    {'id':'8G.2','action':'View package history timestamps','expected':'Correct created_at, submitted_at, and completed_at for each version'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 9 — NOTIFICATIONS
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M9 Notifications','9','Notifications',
    'In-app notification delivery for all key workflow events.',
[
    {'type':'note','text':'Notifications are generated by backend events. Refresh the page if bell does not update immediately.'},
    {'id':'9.1','action':'TL returns a document to auditor (test 8A.3). Log in as test.auditor.','expected':'Notification bell shows a red badge with count ≥ 1'},
    {'id':'9.2','action':'Click the notification bell icon','expected':'Notification panel slides open showing a list of notifications'},
    {'id':'9.3','action':'Read a notification — check its content','expected':'Shows: title, message, engagement code, timestamp'},
    {'id':'9.4','action':'Click on a notification item','expected':'Navigates to the relevant engagement or document'},
    {'id':'9.5','action':'Mark a notification as read','expected':'Badge count decreases; that notification appears greyed or marked read'},
    {'id':'9.6','action':'Trigger a package submission (test 8A.6). Log in as CEA.','expected':'Bell shows new notification: "Package ready for review: ENG-TEST-002"'},
    {'id':'9.7','action':'Trigger TSSU final approval (test 8E.2). Log in as any team member.','expected':'Critical notification: "Engagement locked" — shown with urgent/red styling'},
    {'id':'9.8','action':'Trigger an unlock (test 8F.2). Log in as test.teamleader.','expected':'Critical notification: "Engagement unlocked" — reason included in message body'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 10 — EXPORT
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M10 Export','10','Export (TeamMate+)',
    'Excel, PDF, and Word Findings exports from a locked engagement.',
[
    {'type':'note','text':'Use ENG-TEST-004 (locked, 2024) for all export tests. All 13 workpapers are finalized.'},
    {'id':'10.1','action':'Open ENG-TEST-004 → Export tab → Click Open Export Page','expected':'Export page shows 3 options: Excel (TeamMate+ format), PDF, Word Findings'},
    {'id':'10.2','action':'Click "Export to Excel"','expected':'File download begins. Filename includes engagement code.'},
    {'id':'10.3','action':'Open the downloaded Excel file','expected':'File opens with no errors. Multiple sheets visible.'},
    {'id':'10.4','action':'Check each sheet in the Excel file','expected':'Sheets named for each workpaper (UE1, UE2…RA2). Data in NAOT column format.'},
    {'id':'10.5','action':'Verify a specific field in UE1 sheet','expected':'Entity type, key personnel, prior engagement data match what was entered in the form'},
    {'id':'10.6','action':'Click "Export PDF"','expected':'PDF download begins'},
    {'id':'10.7','action':'Open the PDF','expected':'NAOT branding, engagement header, all workpaper sections rendered correctly'},
    {'id':'10.8','action':'Click "Export Findings (Word)"','expected':'.docx download begins'},
    {'id':'10.9','action':'Open the Word document','expected':'Each finding: Ref, Title, Criteria, Body, Cause, Implication, Recommendation — one per section'},
    {'id':'10.10','action':'Attempt to access Export page for ENG-TEST-003 (not locked)','expected':'Button disabled or message: "Export available after engagement is locked"'},
])


# ──────────────────────────────────────────────────────────────
# MODULE 11 — ADMIN PANEL
# ──────────────────────────────────────────────────────────────
make_sheet(wb,'M11 Admin Panel','11','Admin Panel',
    'User management (94 staff accounts), role changes, lock/unlock accounts, lookups.',
[
    {'type':'section','title':'11A — User Management'},
    {'id':'11A.1','action':'Go to Admin → Users in the sidebar','expected':'Table of 94+ staff accounts: name, username, role, division, last login'},
    {'id':'11A.2','action':'Search for "Mwangi" in the search field','expected':'Filters list to users with Mwangi in their name'},
    {'id':'11A.3','action':'Click on any user to open their detail page','expected':'User profile: full name, username, email, primary role, division, account status, last login'},
    {'id':'11A.4','action':'Change the user\'s primary role to a different level. Save.','expected':'Role updates immediately. New role badge shown.'},
    {'id':'11A.5','action':'Set the user\'s account to inactive / locked','expected':'User shows as Locked or Inactive in the list'},
    {'id':'11A.6','action':'Log out. Attempt to log in as that user.','expected':'Login fails with account locked/inactive message'},
    {'id':'11A.7','action':'Log back in as admin. Reactivate/unlock that user.','expected':'User can log in again normally'},
    {'id':'11A.8','action':'Reset a user\'s password to default','expected':'Password reset to Naot@2024! — user prompted to change on first login'},
    {'type':'section','title':'11B — Lookups Management'},
    {'id':'11B.1','action':'Go to Admin → Lookups','expected':'Page shows all 13 document types with code, name, sequence, unlock_after_code'},
    {'id':'11B.2','action':'Verify FRF is sequence 1 and PE2 is sequence 2','expected':'FRF = seq 1, PE2 = seq 2, UE1 = seq 3, UE2 = seq 4… RA2 = seq 13'},
    {'id':'11B.3','action':'Check unlock_after_code for UE2','expected':'unlock_after_code = UE1 (UE2 requires UE1 submitted first)'},
    {'id':'11B.4','action':'Check unlock_after_code for RA1','expected':'unlock_after_code = UE8 (RA1 requires UE8 submitted first)'},
    {'id':'11B.5','action':'Check unlock_after_code for FRF and PE2','expected':'FRF and PE2 have no unlock_after_code (they are always available from the start)'},
])


# ──────────────────────────────────────────────────────────────
# SUMMARY SHEET
# ──────────────────────────────────────────────────────────────
ws = wb.create_sheet('Summary')
ws.sheet_view.showGridLines = False
ws.column_dimensions['A'].width = 38
ws.column_dimensions['B'].width = 13
ws.column_dimensions['C'].width = 13
ws.column_dimensions['D'].width = 13
ws.column_dimensions['E'].width = 13
ws.column_dimensions['F'].width = 28

ws.row_dimensions[1].height = 30
ws.merge_cells('A1:F1')
ws['A1'] = 'APS SYSTEM WALKTHROUGH — TEST RESULTS SUMMARY'
ws['A1'].font = hf(sz=14); ws['A1'].fill = fl(NAVY); ws['A1'].alignment = ctr()

ws.row_dimensions[2].height = 16
ws.merge_cells('A2:F2')
ws['A2'] = 'Fill in PASS/FAIL/PARTIAL counts for each module after completing testing. Update the sign-off fields at the bottom.'
ws['A2'].font = bf(sz=8, italic=True, color=NAVY)
ws['A2'].fill = fl(NAVY_LIGHT); ws['A2'].alignment = lft(wrap=False)

ws.row_dimensions[3].height = 22
for ci,h in enumerate(['Module','Total Tests','PASS','FAIL','PARTIAL / N/A','Tester Sign-off']):
    c = get_column_letter(ci+1)
    ws[f'{c}3'] = h
    ws[f'{c}3'].font = hf(sz=10); ws[f'{c}3'].fill = fl(NAVY)
    ws[f'{c}3'].alignment = ctr(); ws[f'{c}3'].border = ba

mods = [
    ('M1 — Login & Authentication', 13),
    ('M2 — Dashboard', 10),
    ('M3 — Engagements List', 12),
    ('M4 — Engagement Detail Page', 22),
    ('M5 — Workpaper Forms (all 13)', 17),
    ('M5B — Workpaper Form Grid (all 13 forms)', 13),
    ('M6 — Risk Register', 12),
    ('M7 — Findings', 8),
    ('M8 — Review Workflow (6-level)', 18),
    ('M9 — Notifications', 8),
    ('M10 — Export (TeamMate+)', 10),
    ('M11 — Admin Panel', 13),
]
for ri,(name,total) in enumerate(mods):
    r = 4+ri; ws.row_dimensions[r].height = 22
    bg = GRAY_LIGHT if ri%2==0 else WHITE
    ws[f'A{r}'] = name
    ws[f'A{r}'].font = bf(bold=True, sz=10); ws[f'A{r}'].fill = fl(bg)
    ws[f'A{r}'].alignment = lft(wrap=False); ws[f'A{r}'].border = ba
    ws[f'B{r}'] = total
    ws[f'B{r}'].font = bf(sz=10); ws[f'B{r}'].fill = fl(bg)
    ws[f'B{r}'].alignment = ctr(); ws[f'B{r}'].border = ba
    for col in ['C','D','E']:
        ws[f'{col}{r}'] = 0
        ws[f'{col}{r}'].font = bf(sz=10); ws[f'{col}{r}'].fill = fl(YELLOW_TICK)
        ws[f'{col}{r}'].alignment = ctr(); ws[f'{col}{r}'].border = ba
    ws[f'F{r}'] = ''
    ws[f'F{r}'].fill = fl(WHITE); ws[f'F{r}'].alignment = lft(wrap=False); ws[f'F{r}'].border = ba

# Totals
tr = 4+len(mods)
ws.row_dimensions[tr].height = 24
total_t = sum(t for _,t in mods)
ws[f'A{tr}'] = 'TOTALS'
ws[f'A{tr}'].font = hf(sz=11); ws[f'A{tr}'].fill = fl(NAVY)
ws[f'A{tr}'].alignment = ctr(); ws[f'A{tr}'].border = ba
ws[f'B{tr}'] = total_t
ws[f'B{tr}'].font = hf(sz=11); ws[f'B{tr}'].fill = fl(NAVY)
ws[f'B{tr}'].alignment = ctr(); ws[f'B{tr}'].border = ba
for col in ['C','D','E','F']:
    ws[f'{col}{tr}'] = ''
    ws[f'{col}{tr}'].font = hf(sz=11); ws[f'{col}{tr}'].fill = fl(NAVY)
    ws[f'{col}{tr}'].alignment = ctr(); ws[f'{col}{tr}'].border = ba

# Sign-off block
sign_data = [
    ('Overall Pass Rate (%)', ''),
    ('Tested by', ''),
    ('Test date', ''),
    ('APS version tested', 'APS v1.0 — Build 2026'),
    ('Sign-off approved by', ''),
]
for i,(lbl,val) in enumerate(sign_data):
    r = tr+2+i; ws.row_dimensions[r].height = 22
    ws.merge_cells(f'A{r}:B{r}'); ws.merge_cells(f'C{r}:F{r}')
    ws[f'A{r}'] = lbl
    ws[f'A{r}'].font = bf(bold=True, sz=10, color=NAVY); ws[f'A{r}'].fill = fl(NAVY_LIGHT)
    ws[f'A{r}'].alignment = lft(wrap=False); ws[f'A{r}'].border = ba
    ws[f'C{r}'] = val
    ws[f'C{r}'].font = bf(sz=10); ws[f'C{r}'].fill = fl(WHITE)
    ws[f'C{r}'].alignment = lft(wrap=False); ws[f'C{r}'].border = ba

ws.freeze_panes = 'A4'

# ── Sheet order ───────────────────────────────────────────────
wb.move_sheet('Cover', offset=-(len(wb.sheetnames)-1))
wb.move_sheet('Summary', offset=len(wb.sheetnames)-1)

# ── Save ──────────────────────────────────────────────────────
out = r'C:\Users\kanza\audit-planning-system\APS_Walkthrough_Test_Checklist.xlsx'
wb.save(out)
print('Saved:', out)
print('Sheets:', [s.title for s in wb.worksheets])
