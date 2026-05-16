import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Lookup options ──────────────────────────────────────────────────────────
const ENTITY_TYPES = [
  'Local Government Authority',
  'Ministry/Government Department',
  'Independent Department/Agency',
  'Public Corporation/Parastatal',
  'Statutory Corporation',
  'Subvented Organisation',
  'Regional Administration',
]

const CURRENCIES = ['TZS', 'USD', 'EUR']
const FRAMEWORKS = ['IPSAS', 'IFRS', 'IFRS for SMEs', 'Other']

const ENGAGEMENT_TYPES = [
  'Regular/Annual Audit',
  'Follow-up Audit',
  'Special Audit',
  'Interim Audit',
]

const AUDIT_STATUSES = [
  'Planning', 'Fieldwork', 'Reporting', 'Finalised', 'Suspended',
]

const PRIOR_OPINIONS = [
  'Unqualified', 'Qualified', 'Adverse', 'Disclaimer', 'Not issued',
]

// Key Personnel table columns
const KEY_PERSONNEL_COLUMNS = [
  {
    key: 'position',
    label: 'Position',
    type: 'select',
    options: [
      'Accounting Officer',
      'Director of Finance',
      'Director of Planning',
      'Head of Internal Audit',
      'Head of Procurement',
      'Head of Legal',
      'Secretary to Council/Board',
    ],
    minWidth: '180px',
  },
  { key: 'name',        label: 'Full Name',    type: 'text',   minWidth: '140px' },
  { key: 'tenure_from', label: 'Tenure From',  type: 'date',   minWidth: '120px' },
  { key: 'tenure_to',   label: 'Tenure To',    type: 'text',   minWidth: '120px', placeholder: 'Date or "Present"' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: ['Substantive', 'Acting (6+ months)', 'Vacant'],
    minWidth: '150px',
  },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: '140px' },
]

// ─── Risk trigger logic ──────────────────────────────────────────────────────
function computeUE1Risks(formData) {
  const triggered = []
  const personnel = formData['S3_Q1'] || []

  const hasActing = personnel.some((row) => row.status === 'Acting (6+ months)')
  const hasVacant = personnel.some((row) => row.status === 'Vacant')

  if (hasActing) {
    triggered.push({
      id: 'ue1-acting',
      description: 'One or more key management positions are filled on an acting basis for 6+ months, indicating governance weakness.',
      severity: 'medium',
      pervasive: true,
      questionRef: 'S3_Q1',
    })
  }
  if (hasVacant) {
    triggered.push({
      id: 'ue1-vacant',
      description: 'One or more key management positions are vacant, creating a significant governance and operational risk.',
      severity: 'high',
      pervasive: true,
      questionRef: 'S3_Q1',
    })
  }

  const engType = formData['S4_Q1']
  if (engType === 'Follow-up Audit') {
    triggered.push({
      id: 'ue1-followup',
      description: 'This is a follow-up audit, indicating that prior audit findings were not fully resolved.',
      severity: 'medium',
      pervasive: false,
      questionRef: 'S4_Q1',
    })
  }

  return triggered
}

// ─── Required field check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q2', 'S1_Q3', 'S2_Q1', 'S4_Q1', 'S4_Q2', 'S4_Q3', 'S4_Q4']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main UE1 Page ───────────────────────────────────────────────────────────
export default function UE1Page() {
  const { engagementId } = useParams()
  const navigate = useNavigate()
  const [findingModalRisk, setFindingModalRisk] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Load engagement metadata
  const { data: engagement } = useQuery({
    queryKey: ['engagement', engagementId],
    queryFn: async () => {
      const res = await api.get(`engagements/${engagementId}/`)
      return res.data
    },
    enabled: !!engagementId,
  })

  // Load risks for finding modal
  const { data: engagementRisks = [] } = useQuery({
    queryKey: ['risks', engagementId],
    queryFn: async () => {
      const res = await api.get(`risks/?engagement=${engagementId}`)
      return Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
    },
    enabled: !!engagementId,
  })

  // Workpaper state
  const {
    workpaper,
    formData,
    updateField,
    save,
    submit,
    isLoading,
    isSaving,
    lastSaved,
    error,
  } = useWorkpaper(engagementId, 'UE1')

  // Compute triggered risks
  const triggeredRisks = useMemo(() => computeUE1Risks(formData), [formData])
  const canSubmitForm = checkCanSubmit(formData)

  // Pre-populate from engagement if fields are blank
  const prePopulatedData = useMemo(() => {
    if (!engagement) return formData
    const defaults = {}
    if (!formData['S1_Q1'] && engagement.entity_type) defaults['S1_Q1'] = engagement.entity_type
    if (!formData['S1_Q2'] && engagement.reporting_currency) defaults['S1_Q2'] = engagement.reporting_currency
    if (!formData['S1_Q3'] && engagement.reporting_framework) defaults['S1_Q3'] = engagement.reporting_framework
    if (!formData['S2_Q1'] && engagement.physical_address) defaults['S2_Q1'] = engagement.physical_address
    if (!formData['S4_Q3'] && engagement.period_start) defaults['S4_Q3'] = engagement.period_start
    if (!formData['S4_Q4'] && engagement.period_end) defaults['S4_Q4'] = engagement.period_end
    return { ...defaults, ...formData }
  }, [engagement, formData])

  // Field helper — reads pre-populated data, writes to updateField
  const field = (key) => ({
    value: prePopulatedData[key] ?? '',
    onChange: (val) => updateField(key, val),
  })

  const evidenceField = (key) => ({
    evidence: formData[`${key}_evidence`] || {},
    onEvidenceChange: (ev) => updateField(`${key}_evidence`, ev),
  })

  const risksFor = (ref) => triggeredRisks.filter((r) => r.questionRef === ref)

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    await save()
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    const result = await submit()
    if (result?.success === false) {
      setSubmitError(result.message)
    } else {
      setSubmitSuccess(true)
      setTimeout(() => navigate(`/engagements/${engagementId}`), 1800)
    }
  }

  // ── Assignment object for layout ──────────────────────────────────────────
  const assignment = workpaper
    ? { ...workpaper, status: workpaper.status || 'not_started' }
    : { status: 'not_started' }

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
        documentType="UE1"
        assignment={assignment}
        onSave={handleSave}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        lastSaved={lastSaved}
        canSubmit={canSubmitForm && !readOnly}
      >
        {/* Errors */}
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

        {/* Page title */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE1 — General Information</h2>
          <p className="text-sm text-gray-500 mt-1">
            Capture foundational entity information required to plan the audit engagement.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* ── SECTION 1: Type of Entity ─────────────────────────────────── */}
        <FormSection title="Type of Entity" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField
            questionRef="S1_Q1"
            questionNo="1.1"
            questionText="What is the type of entity being audited?"
            type="select"
            options={ENTITY_TYPES}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q1')}
            {...evidenceField('S1_Q1')}
          />
          <QuestionField
            questionRef="S1_Q2"
            questionNo="1.2"
            questionText="What is the reporting currency used by the entity?"
            type="select"
            options={CURRENCIES}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q2')}
            {...evidenceField('S1_Q2')}
          />
          <QuestionField
            questionRef="S1_Q3"
            questionNo="1.3"
            questionText="What financial reporting framework does the entity apply?"
            type="select"
            options={FRAMEWORKS}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q3')}
            {...evidenceField('S1_Q3')}
          />
        </FormSection>

        {/* ── SECTION 2: Address & Contact Details ──────────────────────── */}
        <FormSection title="Address & Contact Details" sectionCode="SEC2" sectionNumber={2}>
          <QuestionField
            questionRef="S2_Q1"
            questionNo="2.1"
            questionText="Physical address of the entity"
            type="text"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q1')}
            {...evidenceField('S2_Q1')}
          />
          <QuestionField
            questionRef="S2_Q2"
            questionNo="2.2"
            questionText="Postal address (P.O. Box)"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q2')}
            {...evidenceField('S2_Q2')}
          />
          <QuestionField
            questionRef="S2_Q3"
            questionNo="2.3"
            questionText="Telephone number(s)"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q3')}
            {...evidenceField('S2_Q3')}
          />
          <QuestionField
            questionRef="S2_Q4"
            questionNo="2.4"
            questionText="Official email address"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q4')}
            {...evidenceField('S2_Q4')}
          />
          <QuestionField
            questionRef="S2_Q5"
            questionNo="2.5"
            questionText="Website URL (if any)"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q5')}
            {...evidenceField('S2_Q5')}
          />
        </FormSection>

        {/* ── SECTION 3: Key Personnel ───────────────────────────────────── */}
        <FormSection title="Key Personnel" sectionCode="SEC3" sectionNumber={3}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            List all key management positions and their current occupants. This information is used to assess governance and management risk.
          </p>
          <QuestionField
            questionRef="S3_Q1"
            questionNo="3.1"
            questionText="Key management personnel"
            type="table"
            columns={KEY_PERSONNEL_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S3_Q1')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S3_Q1')}
          />
        </FormSection>

        {/* ── SECTION 4: Audit Engagement Details ──────────────────────── */}
        <FormSection title="Audit Engagement Details" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Type of audit engagement"
            type="select"
            options={ENGAGEMENT_TYPES}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S4_Q1')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Select 'Follow-up Audit' only if this engagement is specifically revisiting prior findings."
            {...field('S4_Q1')}
            {...evidenceField('S4_Q1')}
          />
          <QuestionField
            questionRef="S4_Q2"
            questionNo="4.2"
            questionText="Current audit status"
            type="select"
            options={AUDIT_STATUSES}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q2')}
            {...evidenceField('S4_Q2')}
          />
          <div className="grid grid-cols-2 gap-5">
            <QuestionField
              questionRef="S4_Q3"
              questionNo="4.3"
              questionText="Audit period — start date"
              type="date"
              isRequired
              readOnly={readOnly}
              engagementId={engagementId}
              {...field('S4_Q3')}
              {...evidenceField('S4_Q3')}
            />
            <QuestionField
              questionRef="S4_Q4"
              questionNo="4.4"
              questionText="Audit period — end date"
              type="date"
              isRequired
              readOnly={readOnly}
              engagementId={engagementId}
              {...field('S4_Q4')}
              {...evidenceField('S4_Q4')}
            />
          </div>
          <QuestionField
            questionRef="S4_Q5"
            questionNo="4.5"
            questionText="Prior year audit opinion"
            type="select"
            options={PRIOR_OPINIONS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q5')}
            {...evidenceField('S4_Q5')}
          />
          <QuestionField
            questionRef="S4_Q6"
            questionNo="4.6"
            questionText="Prior year key issues (summarise any significant matters raised)"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q6')}
            {...evidenceField('S4_Q6')}
          />
        </FormSection>
      </WorkpaperLayout>

      {/* Finding generation modal */}
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
