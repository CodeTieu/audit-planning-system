import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Minutes Review table columns ────────────────────────────────────────────
const MINUTES_COLUMNS = [
  { key: 'meeting_date',  label: 'Meeting Date',           type: 'date',   minWidth: '120px' },
  {
    key: 'meeting_type',
    label: 'Meeting Type',
    type: 'select',
    options: ['Board Meeting', 'Committee Meeting', 'Management Meeting', 'AGM', 'Special Meeting'],
    minWidth: '160px',
  },
  { key: 'agenda_items', label: 'Key Agenda Items',        type: 'text',   minWidth: '180px' },
  {
    key: 'quorum_met',
    label: 'Quorum Met',
    type: 'select',
    options: ['Yes', 'No'],
    minWidth: '100px',
  },
  { key: 'resolutions',  label: 'Key Resolutions/Decisions', type: 'text', minWidth: '180px' },
  { key: 'follow_up',    label: 'Follow-up Actions',       type: 'text',   minWidth: '160px' },
  { key: 'evidence_ref', label: 'Evidence Reference',      type: 'text',   minWidth: '140px' },
]

// ─── Risk trigger logic ──────────────────────────────────────────────────────
function computeUE2Risks(formData) {
  const triggered = []

  if (formData['S1_Q1'] === 'no') {
    triggered.push({
      id: 'ue2-s1q1',
      description: 'Board/council not functional — significant governance weakness.',
      severity: 'high',
      pervasive: true,
      questionRef: 'S1_Q1',
    })
  }
  if (formData['S1_Q2'] === 'no') {
    triggered.push({
      id: 'ue2-s1q2',
      description: 'Required governance meetings not held.',
      severity: 'high',
      pervasive: true,
      questionRef: 'S1_Q2',
    })
  }
  if (formData['S1_Q5'] === 'yes') {
    triggered.push({
      id: 'ue2-s1q5',
      description: 'Vacancies in governing board — governance continuity risk.',
      severity: 'medium',
      pervasive: true,
      questionRef: 'S1_Q5',
    })
  }
  if (formData['S2_Q3'] === 'no') {
    triggered.push({
      id: 'ue2-s2q3',
      description: 'Inadequate management-level segregation of duties.',
      severity: 'high',
      pervasive: false,
      questionRef: 'S2_Q3',
    })
  }
  if (formData['S2_Q4'] === 'yes') {
    triggered.push({
      id: 'ue2-s2q4',
      description: 'Significant management changes during period — continuity and control risk.',
      severity: 'medium',
      pervasive: true,
      questionRef: 'S2_Q4',
    })
  }

  return triggered
}

// ─── Required field check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q2', 'S1_Q3', 'S2_Q1', 'S2_Q3', 'S4_Q1', 'S4_Q2']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main UE2 Page ───────────────────────────────────────────────────────────
export default function UE2Page() {
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
  } = useWorkpaper(engagementId, 'UE2')

  // Compute triggered risks
  const triggeredRisks = useMemo(() => computeUE2Risks(formData), [formData])
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
        documentType="UE2"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE2 — Governance Structure</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assess the governance framework in accordance with ISSAI 2315 and ISSAI 2230.
            The PSREC documentation framework applies throughout.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* ── SECTION 1: Those Charged with Governance ───────────────────── */}
        <FormSection title="Those Charged with Governance (TCWG)" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField
            questionRef="S1_Q1"
            questionNo="1.1"
            questionText="Does the entity have a functional governing board/council as required by its establishing legislation?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S1_Q1')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S1_Q1')}
            {...evidenceField('S1_Q1')}
          />
          <QuestionField
            questionRef="S1_Q2"
            questionNo="1.2"
            questionText="Has the board/council held the required number of meetings in the audit period?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S1_Q2')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S1_Q2')}
            {...evidenceField('S1_Q2')}
          />
          <QuestionField
            questionRef="S1_Q3"
            questionNo="1.3"
            questionText="Are board/council minutes maintained and approved in a timely manner?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q3')}
            {...evidenceField('S1_Q3')}
          />
          <QuestionField
            questionRef="S1_Q4"
            questionNo="1.4"
            questionText="Does the board/council receive regular financial and management reports?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q4')}
            {...evidenceField('S1_Q4')}
          />
          <QuestionField
            questionRef="S1_Q5"
            questionNo="1.5"
            questionText="Are there any vacancies in the governing board/council?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S1_Q5')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Yes responses indicate a risk trigger — vacancies create governance continuity concerns."
            {...field('S1_Q5')}
            {...evidenceField('S1_Q5')}
          />
          <QuestionField
            questionRef="S1_Q6"
            questionNo="1.6"
            questionText="Does the board/council have an audit committee or equivalent oversight body?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q6')}
            {...evidenceField('S1_Q6')}
          />
          <QuestionField
            questionRef="S1_Q7"
            questionNo="1.7"
            questionText="Describe the board/council composition and key responsibilities"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q7')}
            {...evidenceField('S1_Q7')}
          />
        </FormSection>

        {/* ── SECTION 2: Management Structure ────────────────────────────── */}
        <FormSection title="Management Structure" sectionCode="SEC2" sectionNumber={2}>
          <QuestionField
            questionRef="S2_Q1"
            questionNo="2.1"
            questionText="Is there a clear organizational structure with defined reporting lines?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q1')}
            {...evidenceField('S2_Q1')}
          />
          <QuestionField
            questionRef="S2_Q2"
            questionNo="2.2"
            questionText="Are there written job descriptions for key management positions?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q2')}
            {...evidenceField('S2_Q2')}
          />
          <QuestionField
            questionRef="S2_Q3"
            questionNo="2.3"
            questionText="Is there adequate segregation of duties at the management level?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S2_Q3')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S2_Q3')}
            {...evidenceField('S2_Q3')}
          />
          <QuestionField
            questionRef="S2_Q4"
            questionNo="2.4"
            questionText="Has management changed significantly during the audit period?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S2_Q4')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Yes responses indicate a risk trigger — significant management changes can disrupt controls."
            {...field('S2_Q4')}
            {...evidenceField('S2_Q4')}
          />
          <QuestionField
            questionRef="S2_Q5"
            questionNo="2.5"
            questionText="Are management performance targets set and monitored?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q5')}
            {...evidenceField('S2_Q5')}
          />
          <QuestionField
            questionRef="S2_Q6"
            questionNo="2.6"
            questionText="Record key management structure observations"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S2_Q6')}
            {...evidenceField('S2_Q6')}
          />
        </FormSection>

        {/* ── SECTION 3: Minutes Review ───────────────────────────────────── */}
        <FormSection title="Minutes Review — Sub-workpaper WP UE-2A" sectionCode="SEC3" sectionNumber={3}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Record details of all board/council and committee meetings reviewed during the audit period.
          </p>
          <QuestionField
            questionRef="S3_Q1"
            questionNo="3.1"
            questionText="Board/council and committee meetings reviewed"
            type="table"
            columns={MINUTES_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S3_Q1')}
          />
        </FormSection>

        {/* ── SECTION 4: Overall Governance Assessment ────────────────────── */}
        <FormSection title="Overall Governance Assessment" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Based on the above, rate the overall governance effectiveness"
            type="select"
            options={['Effective', 'Partially Effective', 'Ineffective']}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q1')}
            {...evidenceField('S4_Q1')}
          />
          <QuestionField
            questionRef="S4_Q2"
            questionNo="4.2"
            questionText="Overall governance conclusion and key observations"
            type="text"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q2')}
            {...evidenceField('S4_Q2')}
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
