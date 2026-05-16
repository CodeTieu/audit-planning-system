import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Sources of Financing table columns ─────────────────────────────────────
const FINANCING_COLUMNS = [
  { key: 'source_name', label: 'Source of Funds', type: 'text', minWidth: '160px' },
  {
    key: 'source_type',
    label: 'Type',
    type: 'select',
    options: ['Government Grant', 'Own Revenue', 'Donor Grant', 'Loan/Borrowing', 'Other'],
    minWidth: '150px',
  },
  { key: 'amount_tzs',  label: 'Amount (TZS Millions)', type: 'number', minWidth: '140px' },
  { key: 'percentage',  label: '% of Total Budget',     type: 'number', minWidth: '120px' },
  { key: 'notes',       label: 'Notes',                 type: 'text',   minWidth: '160px' },
]

// ─── Risk trigger logic ──────────────────────────────────────────────────────
function computeUE4Risks(formData) {
  const triggered = []

  if (formData['S2_Q3'] === 'yes') {
    triggered.push({
      id: 'ue4-s2q3',
      description: 'Significant outsourced functions — control gaps and accountability risks possible.',
      severity: 'medium',
      pervasive: false,
      questionRef: 'S2_Q3',
    })
  }
  if (formData['S2_Q4'] === 'yes') {
    triggered.push({
      id: 'ue4-s2q4',
      description: 'Significant restructuring during period — operational disruption and control risk.',
      severity: 'medium',
      pervasive: true,
      questionRef: 'S2_Q4',
    })
  }
  if (formData['S2_Q5'] === 'no') {
    triggered.push({
      id: 'ue4-s2q5',
      description: 'Inadequate IT systems for financial reporting — data integrity risk.',
      severity: 'high',
      pervasive: false,
      questionRef: 'S2_Q5',
    })
  }
  if (formData['S4_Q3'] === 'yes') {
    triggered.push({
      id: 'ue4-s4q3',
      description: 'Significant pending legal cases — contingent liability may not be adequately disclosed.',
      severity: 'medium',
      pervasive: false,
      questionRef: 'S4_Q3',
    })
  }
  if (formData['S4_Q5'] === 'yes') {
    triggered.push({
      id: 'ue4-s4q5',
      description: 'Significant related party relationships — conflict of interest and disclosure risk.',
      severity: 'medium',
      pervasive: false,
      questionRef: 'S4_Q5',
    })
  }
  if (formData['S5_Q1'] === 'no') {
    triggered.push({
      id: 'ue4-s5q1',
      description: 'No current strategic plan — lack of strategic direction, budget alignment risk.',
      severity: 'medium',
      pervasive: true,
      questionRef: 'S5_Q1',
    })
  }

  return triggered
}

// ─── Required field check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q2']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main UE4 Page ───────────────────────────────────────────────────────────
export default function UE4Page() {
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
  } = useWorkpaper(engagementId, 'UE4')

  // Compute triggered risks
  const triggeredRisks = useMemo(() => computeUE4Risks(formData), [formData])
  const canSubmitForm = checkCanSubmit(formData)

  // Field helpers
  const field = (key) => ({
    value: formData[key] ?? '',
    onChange: (val) => updateField(key, val),
  })

  const evidenceField = (key) => ({
    evidence: formData[`${key}_evidence`] || {},
    onEvidenceChange: (ev) => updateField(`${key}_evidence`, ev),
  })

  const risksFor = (ref) => triggeredRisks.filter((r) => r.questionRef === ref)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSave = async () => { await save() }

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
        documentType="UE4"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE4 — Operational Environment</h2>
          <p className="text-sm text-gray-500 mt-1">
            Understand the entity's operational context in accordance with ISSAI 2315 para 19.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* ── SECTION 1: Mandate & Core Operations ────────────────────────── */}
        <FormSection title="Mandate & Core Operations" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField
            questionRef="S1_Q1"
            questionNo="1.1"
            questionText="Describe the entity's statutory mandate and core functions"
            type="text"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q1')}
            {...evidenceField('S1_Q1')}
          />
          <QuestionField
            questionRef="S1_Q2"
            questionNo="1.2"
            questionText="Describe the main operational activities and programmes"
            type="text"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q2')}
            {...evidenceField('S1_Q2')}
          />
          <QuestionField
            questionRef="S1_Q3"
            questionNo="1.3"
            questionText="Describe the organizational structure (departments/units)"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q3')}
            {...evidenceField('S1_Q3')}
          />
          <div className="grid grid-cols-2 gap-5">
            <QuestionField
              questionRef="S1_Q4"
              questionNo="1.4"
              questionText="Number of staff (approximate)"
              type="number"
              readOnly={readOnly}
              engagementId={engagementId}
              {...field('S1_Q4')}
              {...evidenceField('S1_Q4')}
            />
            <QuestionField
              questionRef="S1_Q5"
              questionNo="1.5"
              questionText="Number of operational locations/offices"
              type="number"
              readOnly={readOnly}
              engagementId={engagementId}
              {...field('S1_Q5')}
              {...evidenceField('S1_Q5')}
            />
          </div>
        </FormSection>

        {/* ── SECTION 2: Operational Structure ────────────────────────────── */}
        <FormSection title="Operational Structure" sectionCode="SEC2" sectionNumber={2}>
          <QuestionField
            questionRef="S2_Q1"
            questionNo="2.1"
            questionText="Are the entity's operations decentralized to regions/districts?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q1')}
            {...evidenceField('S2_Q1')}
          />
          <QuestionField
            questionRef="S2_Q2"
            questionNo="2.2"
            questionText="Does the entity operate through implementing partners or sub-grantees?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q2')}
            {...evidenceField('S2_Q2')}
          />
          <QuestionField
            questionRef="S2_Q3"
            questionNo="2.3"
            questionText="Are there significant outsourced functions or activities?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S2_Q3')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Yes responses indicate a risk trigger — outsourced functions may have control gaps."
            {...field('S2_Q3')}
            {...evidenceField('S2_Q3')}
          />
          <QuestionField
            questionRef="S2_Q4"
            questionNo="2.4"
            questionText="Has the entity undergone any significant restructuring in the audit period?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S2_Q4')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Yes responses indicate a risk trigger — restructuring can disrupt controls and continuity."
            {...field('S2_Q4')}
            {...evidenceField('S2_Q4')}
          />
          <QuestionField
            questionRef="S2_Q5"
            questionNo="2.5"
            questionText="Are there adequate IT systems to support operations and financial reporting?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S2_Q5')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="A No answer triggers a High severity IT risk."
            {...field('S2_Q5')}
            {...evidenceField('S2_Q5')}
          />
        </FormSection>

        {/* ── SECTION 3: Sources of Financing ─────────────────────────────── */}
        <FormSection title="Sources of Financing" sectionCode="SEC3" sectionNumber={3}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Record all sources of funding for the entity in the audit period.
          </p>
          <QuestionField
            questionRef="S3_Q1"
            questionNo="3.1"
            questionText="Sources of financing for the audit period"
            type="table"
            columns={FINANCING_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S3_Q1')}
          />
        </FormSection>

        {/* ── SECTION 4: External Environment ─────────────────────────────── */}
        <FormSection title="External Environment" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Is the entity subject to significant political/policy changes?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q1')}
            {...evidenceField('S4_Q1')}
          />
          <QuestionField
            questionRef="S4_Q2"
            questionNo="4.2"
            questionText="Are there significant economic factors affecting operations?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q2')}
            {...evidenceField('S4_Q2')}
          />
          <QuestionField
            questionRef="S4_Q3"
            questionNo="4.3"
            questionText="Are there significant pending legal cases or disputes?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S4_Q3')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Yes responses indicate a risk trigger — pending legal cases may create contingent liabilities."
            {...field('S4_Q3')}
            {...evidenceField('S4_Q3')}
          />
          <QuestionField
            questionRef="S4_Q4"
            questionNo="4.4"
            questionText="Is the entity subject to significant public/media scrutiny?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q4')}
            {...evidenceField('S4_Q4')}
          />
          <QuestionField
            questionRef="S4_Q5"
            questionNo="4.5"
            questionText="Are there significant related party relationships or transactions?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S4_Q5')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Yes responses indicate a risk trigger — related party transactions require enhanced scrutiny."
            {...field('S4_Q5')}
            {...evidenceField('S4_Q5')}
          />
        </FormSection>

        {/* ── SECTION 5: Strategy & Programme Objectives ───────────────────── */}
        <FormSection title="Strategy & Programme Objectives" sectionCode="SEC5" sectionNumber={5}>
          <QuestionField
            questionRef="S5_Q1"
            questionNo="5.1"
            questionText="Does the entity have a current strategic plan?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S5_Q1')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="A No answer triggers a Medium pervasive risk — absence of a strategic plan affects audit scope."
            {...field('S5_Q1')}
            {...evidenceField('S5_Q1')}
          />
          <QuestionField
            questionRef="S5_Q2"
            questionNo="5.2"
            questionText="Are performance targets set and performance reported?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S5_Q2')}
            {...evidenceField('S5_Q2')}
          />
          <QuestionField
            questionRef="S5_Q3"
            questionNo="5.3"
            questionText="Is actual performance monitored against targets?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S5_Q3')}
            {...evidenceField('S5_Q3')}
          />
          <QuestionField
            questionRef="S5_Q4"
            questionNo="5.4"
            questionText="Key strategic objectives and programmes for the audit period"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S5_Q4')}
            {...evidenceField('S5_Q4')}
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
