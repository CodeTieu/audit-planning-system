import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Engagement team table columns ────────────────────────────────────────────
const TEAM_COLUMNS = [
  { key: 'team_member', label: 'Team Member Name', type: 'text', minWidth: '170px' },
  {
    key: 'role_in_engagement', label: 'Role in Engagement', type: 'select', minWidth: '170px',
    options: ['Financial Auditor', 'IS Auditor', 'Team Leader', 'CEA/Overall TL', 'Other'],
  },
  { key: 'qualifications', label: 'Qualifications', type: 'text', minWidth: '160px' },
  { key: 'years_experience', label: 'Years Experience', type: 'number', minWidth: '120px' },
  {
    key: 'prior_engagement_exp', label: 'Prior Experience with this Entity?', type: 'select', minWidth: '180px',
    options: ['Yes', 'No'],
  },
]

// ─── Competency gaps table columns ────────────────────────────────────────────
const GAPS_COLUMNS = [
  { key: 'team_member', label: 'Team Member', type: 'text', minWidth: '150px' },
  { key: 'aspect', label: 'Competency Gap', type: 'text', minWidth: '200px' },
  {
    key: 'current_level', label: 'Current Level', type: 'select', minWidth: '140px',
    options: ['Not Assessed', 'Basic', 'Intermediate', 'Advanced'],
  },
  {
    key: 'required_level', label: 'Required Level', type: 'select', minWidth: '140px',
    options: ['Basic', 'Intermediate', 'Advanced'],
  },
  { key: 'intervention', label: 'Planned Intervention / Training', type: 'text', minWidth: '220px' },
  { key: 'completion_date', label: 'Target Completion Date', type: 'date', minWidth: '150px' },
  {
    key: 'status', label: 'Status', type: 'select', minWidth: '130px',
    options: ['Planned', 'In Progress', 'Completed'],
  },
]

// ─── 12 Competency Aspects ────────────────────────────────────────────────────
const COMPETENCY_ASPECTS = [
  'Technical Accounting Knowledge',
  'Auditing Standards & Procedures',
  'Government Sector Understanding',
  'Internal Control Assessment',
  'IT Systems Knowledge',
  'Financial Analysis Skills',
  'Report Writing & Communication',
  'Professional Skepticism',
  'Fraud / Non-Compliance Detection',
  'Audit Risk Assessment',
  'Engagement Management',
  'Ethics & Independence',
]

const RATING_OPTIONS = ['Not Assessed', 'Basic', 'Intermediate', 'Advanced']

// ─── Competency Matrix Component ──────────────────────────────────────────────
function CompetencyMatrix({ value = [], onChange, readOnly }) {
  // Initialise rows from value or use defaults
  const rows = useMemo(() => {
    if (Array.isArray(value) && value.length === COMPETENCY_ASPECTS.length) return value
    return COMPETENCY_ASPECTS.map((aspect, i) => ({
      aspect,
      financial_auditor: (value[i]?.financial_auditor) || 'Not Assessed',
      is_auditor: (value[i]?.is_auditor) || 'Not Assessed',
      team_leader: (value[i]?.team_leader) || 'Not Assessed',
      cea: (value[i]?.cea) || 'Not Assessed',
      required_level: (value[i]?.required_level) || 'Intermediate',
    }))
  }, [value])

  const updateRow = (idx, key, val) => {
    const updated = rows.map((row, i) => i === idx ? { ...row, [key]: val } : row)
    onChange(updated)
  }

  const selectClass = (disabled) => [
    'w-full text-xs px-2 py-1.5 border rounded outline-none transition-colors bg-white',
    disabled
      ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
      : 'border-gray-300 focus:border-[#1e3a5f]',
  ].join(' ')

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#1e3a5f] text-white">
            <th className="text-left px-3 py-2 font-semibold min-w-[200px]">Competency Aspect</th>
            <th className="text-center px-3 py-2 font-semibold min-w-[130px]">Financial Auditor</th>
            <th className="text-center px-3 py-2 font-semibold min-w-[110px]">IS Auditor</th>
            <th className="text-center px-3 py-2 font-semibold min-w-[110px]">Team Leader</th>
            <th className="text-center px-3 py-2 font-semibold min-w-[90px]">CEA</th>
            <th className="text-center px-3 py-2 font-semibold min-w-[130px]">Required Level</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.aspect} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 font-medium text-gray-700 border-b border-gray-100">
                {idx + 1}. {row.aspect}
              </td>
              {['financial_auditor', 'is_auditor', 'team_leader', 'cea'].map((col) => (
                <td key={col} className="px-2 py-1.5 border-b border-gray-100">
                  <select
                    value={row[col] || 'Not Assessed'}
                    onChange={(e) => !readOnly && updateRow(idx, col, e.target.value)}
                    disabled={readOnly}
                    className={selectClass(readOnly)}
                  >
                    {RATING_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
              ))}
              <td className="px-2 py-1.5 border-b border-gray-100">
                <select
                  value={row.required_level || 'Intermediate'}
                  onChange={(e) => !readOnly && updateRow(idx, 'required_level', e.target.value)}
                  disabled={readOnly}
                  className={selectClass(readOnly)}
                >
                  {['Basic', 'Intermediate', 'Advanced'].map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Risk trigger logic ───────────────────────────────────────────────────────
function computePE2Risks(formData) {
  const triggered = []

  if (formData['S4_Q1'] === 'no') {
    triggered.push({
      id: 'pe2-s4q1',
      description: 'Engagement team lacks required competencies — quality risk',
      severity: 'high',
      pervasive: true,
      questionRef: 'S4_Q1',
    })
  }

  return triggered
}

// ─── Required field check ─────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S4_Q1', 'S4_Q2']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PE2Page() {
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
    useWorkpaper(engagementId, 'PE2')

  const triggeredRisks = useMemo(() => computePE2Risks(formData), [formData])
  const canSubmitForm = checkCanSubmit(formData)

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
        documentType="PE2"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">PE2 — Competency Matrix / Engagement Team Competency</h2>
          <p className="text-sm text-gray-500 mt-1">
            Engagement team composition and competency assessment, per ISSAI 2220.
            This document is completed by the CEA.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
          <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            Note: This workpaper is completed by the Chief Executive Auditor (CEA) — not the assigned field auditor.
          </div>
        </div>

        {/* SECTION 1 — Engagement Team Composition */}
        <FormSection title="Engagement Team Composition" sectionCode="SEC1" sectionNumber={1}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            List all members of the engagement team and their roles.
          </p>
          <QuestionField
            questionRef="S1_Q1"
            questionNo="1.1"
            questionText="Engagement team members"
            type="table"
            columns={TEAM_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q1')}
          />
        </FormSection>

        {/* SECTION 2 — Competency Assessment Matrix */}
        <FormSection title="Competency Assessment Matrix" sectionCode="SEC2" sectionNumber={2}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Rate each team role against the 12 competency aspects. Set the required level for each aspect.
            Rating scale: Not Assessed / Basic / Intermediate / Advanced.
          </p>
          <CompetencyMatrix
            value={formData['competency_matrix'] || []}
            onChange={(val) => updateField('competency_matrix', val)}
            readOnly={readOnly}
          />
        </FormSection>

        {/* SECTION 3 — Competency Gaps & Interventions */}
        <FormSection title="Competency Gaps & Interventions" sectionCode="SEC3" sectionNumber={3}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Document any identified competency gaps and planned interventions or training.
          </p>
          <QuestionField
            questionRef="S3_Q1"
            questionNo="3.1"
            questionText="Competency gaps and interventions"
            type="table"
            columns={GAPS_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S3_Q1')}
          />
        </FormSection>

        {/* SECTION 4 — Overall Competency Assessment */}
        <FormSection title="Overall Competency Assessment" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Is the engagement team collectively competent to conduct this audit?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S4_Q1')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S4_Q1')}
            {...evidenceField('S4_Q1')}
          />
          <QuestionField questionRef="S4_Q2" questionNo="4.2" questionText="Overall competency assessment and any limitations" type="text" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S4_Q2')} {...evidenceField('S4_Q2')} />
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
