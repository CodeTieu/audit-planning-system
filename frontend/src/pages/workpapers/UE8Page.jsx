import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Materiality basis options ────────────────────────────────────────────────
const MATERIALITY_BASIS_OPTIONS = [
  'Total Revenue',
  'Total Expenditure',
  'Total Assets',
  'Gross Revenue',
  'Net Assets/Fund Balance',
]

// ─── Lead Schedule table columns ──────────────────────────────────────────────
const LEAD_SCHEDULE_COLUMNS = [
  { key: 'cotabd', label: 'COTABD / Account Area', type: 'text', minWidth: '200px' },
  {
    key: 'fs_section', label: 'FS Section', type: 'select', minWidth: '220px',
    options: [
      'Statement of Financial Position - Assets',
      'Statement of Financial Position - Liabilities',
      'Statement of Financial Position - Equity',
      'Statement of Comprehensive Income - Revenue',
      'Statement of Comprehensive Income - Expenditure',
      'Statement of Cash Flows',
      'Notes and Disclosures',
    ],
  },
  { key: 'prior_year_balance', label: 'Prior Year Balance (TZS)', type: 'number', minWidth: '160px' },
  { key: 'current_year_balance', label: 'Current Year Balance (TZS)', type: 'number', minWidth: '170px' },
  { key: 'change_percent', label: '% Change (auto)', type: 'text', minWidth: '110px' },
  { key: 'complexity', label: 'Complexity', type: 'select', minWidth: '110px', options: ['Low', 'Medium', 'High'] },
  { key: 'significant', label: 'Significant?', type: 'select', minWidth: '100px', options: ['Yes', 'No'] },
  { key: 'inherent_risk', label: 'Inherent Risk', type: 'select', minWidth: '120px', options: ['Low', 'Medium', 'High'] },
  { key: 'control_risk', label: 'Control Risk', type: 'select', minWidth: '120px', options: ['Low', 'Medium', 'High'] },
  { key: 'prior_misstatement', label: 'Prior Year Misstatement?', type: 'select', minWidth: '150px', options: ['Yes', 'No'] },
  { key: 'assertions_affected', label: 'Assertions Affected', type: 'text', minWidth: '160px' },
  { key: 'notes', label: 'Notes / Key Risks', type: 'text', minWidth: '180px' },
]

// ─── Pre-populated COTABD rows ─────────────────────────────────────────────────
const DEFAULT_COTABD_ROWS = [
  'Cash & Cash Equivalents',
  'Receivables (Current)',
  'Receivables (Non-Current)',
  'Inventory',
  'Property Plant & Equipment',
  'Intangible Assets',
  'Investments',
  'Other Assets',
  'Payables (Current)',
  'Payables (Non-Current)',
  'Employee Benefits',
  'Provisions & Contingencies',
  'General Fund',
  'Restricted Funds',
  'Revenue (Own Source)',
  'Revenue (Government Grant)',
  'Revenue (Donor Grant)',
  'Expenditure (Personnel)',
  'Expenditure (Procurement)',
  'Expenditure (Other)',
  'Surplus/Deficit',
].map((name) => ({
  cotabd: name,
  fs_section: '',
  prior_year_balance: '',
  current_year_balance: '',
  change_percent: '',
  complexity: '',
  significant: '',
  inherent_risk: '',
  control_risk: '',
  prior_misstatement: '',
  assertions_affected: '',
  notes: '',
}))

// ─── Risk trigger logic ───────────────────────────────────────────────────────
function computeUE8Risks(formData) {
  const triggered = []

  if (formData['S3_Q3'] === 'High') {
    triggered.push({
      id: 'ue8-s3q3',
      description: 'High overall financial statement risk — significant additional procedures required',
      severity: 'high',
      pervasive: true,
      questionRef: 'S3_Q3',
    })
  }

  return triggered
}

// ─── Required field check ─────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q2', 'S1_Q3', 'S1_Q4', 'S3_Q1', 'S3_Q2', 'S3_Q3']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UE8Page() {
  const { engagementId } = useParams()
  const navigate = useNavigate()
  const [findingModalRisk, setFindingModalRisk] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const { data: engagement } = useQuery({
    queryKey: ['engagement', engagementId],
    queryFn: async () => { const res = await api.get(`engagements/${engagementId}/`); return res.data },
    enabled: !!engagementId,
  })

  const { data: engagementRisks = [] } = useQuery({
    queryKey: ['risks', engagementId],
    queryFn: async () => {
      const res = await api.get(`risks/?engagement=${engagementId}`)
      return Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
    },
    enabled: !!engagementId,
  })

  const { workpaper, formData, updateField, save, submit, isLoading, isSaving, lastSaved, error } =
    useWorkpaper(engagementId, 'UE8')

  const triggeredRisks = useMemo(() => computeUE8Risks(formData), [formData])
  const canSubmitForm = checkCanSubmit(formData)

  // For the lead schedule table, use default rows when no data yet
  const leadScheduleValue = useMemo(() => {
    const stored = formData['S2_Q1']
    if (Array.isArray(stored) && stored.length > 0) return stored
    return DEFAULT_COTABD_ROWS
  }, [formData])

  const field = (key) => ({ value: formData[key] ?? '', onChange: (val) => updateField(key, val) })
  const evidenceField = (key) => ({ evidence: formData[`${key}_evidence`] || {}, onEvidenceChange: (ev) => updateField(`${key}_evidence`, ev) })
  const risksFor = (ref) => triggeredRisks.filter((r) => r.questionRef === ref)

  const handleSave = async () => { await save() }
  const handleSubmit = async () => {
    setSubmitError(null)
    const result = await submit()
    if (result?.success === false) { setSubmitError(result.message) }
    else { setSubmitSuccess(true); setTimeout(() => navigate(`/engagements/${engagementId}`), 1800) }
  }

  const assignment = workpaper ? { ...workpaper, status: workpaper.status || 'not_started' } : { status: 'not_started' }
  const readOnly = ['submitted', 'tl_approved', 'locked'].includes(workpaper?.status)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <WorkpaperLayout
        engagement={engagement ? { ...engagement, assignments: [] } : { id: engagementId, assignments: [] }}
        documentType="UE8"
        assignment={assignment}
        onSave={handleSave}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        lastSaved={lastSaved}
        canSubmit={canSubmitForm && !readOnly}
      >
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {error} — Your changes are saved locally.
          </div>
        )}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700 font-medium">
            Workpaper submitted for TL review. Redirecting...
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE8 — Lead Schedule: COTABD Quantitative Risk Assessment</h2>
          <p className="text-sm text-gray-500 mt-1">
            Materiality determination and COTABD-level risk assessment, per ISSAI 2315.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* SECTION 1 — Materiality */}
        <FormSection title="Materiality" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField questionRef="S1_Q1" questionNo="1.1" questionText="Overall Materiality (TZS)" type="number" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q1')} {...evidenceField('S1_Q1')} />
          <QuestionField questionRef="S1_Q2" questionNo="1.2" questionText="Performance Materiality (TZS)" type="number" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q2')} {...evidenceField('S1_Q2')} />
          <QuestionField questionRef="S1_Q3" questionNo="1.3" questionText="Clearly Trivial Threshold (TZS)" type="number" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q3')} {...evidenceField('S1_Q3')} />
          <QuestionField questionRef="S1_Q4" questionNo="1.4" questionText="Materiality basis used" type="select" options={MATERIALITY_BASIS_OPTIONS} isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q4')} {...evidenceField('S1_Q4')} />
          <QuestionField questionRef="S1_Q5" questionNo="1.5" questionText="Basis for materiality determination and any special considerations" type="text" readOnly={readOnly} engagementId={engagementId} {...field('S1_Q5')} {...evidenceField('S1_Q5')} />
        </FormSection>

        {/* SECTION 2 — COTABD Assessment Table */}
        <FormSection title="COTABD Assessment Table (Lead Schedule)" sectionCode="SEC2" sectionNumber={2}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Complete the risk assessment for each COTABD / account area. Pre-populated rows can be extended as needed.
          </p>
          <QuestionField
            questionRef="S2_Q1"
            questionNo="2.1"
            questionText="COTABD lead schedule"
            type="table"
            columns={LEAD_SCHEDULE_COLUMNS}
            value={leadScheduleValue}
            onChange={(val) => updateField('S2_Q1', val)}
            readOnly={readOnly}
            engagementId={engagementId}
          />
        </FormSection>

        {/* SECTION 3 — Significant COTABDs Summary */}
        <FormSection title="Significant COTABDs Summary" sectionCode="SEC3" sectionNumber={3}>
          <QuestionField questionRef="S3_Q1" questionNo="3.1" questionText="List and justify significant COTABDs selected for detailed audit" type="text" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S3_Q1')} {...evidenceField('S3_Q1')} />
          <QuestionField questionRef="S3_Q2" questionNo="3.2" questionText="Overall inherent risk assessment at financial statement level" type="text" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S3_Q2')} {...evidenceField('S3_Q2')} />
          <QuestionField
            questionRef="S3_Q3"
            questionNo="3.3"
            questionText="Overall financial statement level risk"
            type="select"
            options={['Low', 'Medium', 'High']}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S3_Q3')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S3_Q3')}
            {...evidenceField('S3_Q3')}
          />
        </FormSection>
      </WorkpaperLayout>

      <FindingModal
        isOpen={!!findingModalRisk}
        onClose={() => setFindingModalRisk(null)}
        risk={findingModalRisk}
        engagementId={engagementId}
        allRisks={[...engagementRisks, ...triggeredRisks]}
      />
    </>
  )
}
