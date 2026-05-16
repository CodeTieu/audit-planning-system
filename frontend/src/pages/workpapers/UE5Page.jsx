import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Risk trigger logic ──────────────────────────────────────────────────────
function computeUE5Risks(formData) {
  const triggered = []

  if (formData['SA_Q1'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q1',
      description: 'Fraud identified or suspected — immediate escalation required.',
      severity: 'high',
      pervasive: true,
      questionRef: 'SA_Q1',
    })
  }
  if (formData['SA_Q3'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q3',
      description: 'Management fraud incentives/pressures identified — heightened risk of fraudulent financial reporting.',
      severity: 'high',
      pervasive: true,
      questionRef: 'SA_Q3',
    })
  }
  if (formData['SA_Q4'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q4',
      description: 'Opportunity for fraud due to control weaknesses — enhanced substantive procedures required.',
      severity: 'high',
      pervasive: false,
      questionRef: 'SA_Q4',
    })
  }
  if (formData['SA_Q5'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q5',
      description: 'Management override of controls detected — significant risk to financial statement reliability.',
      severity: 'high',
      pervasive: true,
      questionRef: 'SA_Q5',
    })
  }
  if (formData['SA_Q6'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q6',
      description: 'Unusual or complex transactions identified — increased audit effort required.',
      severity: 'medium',
      pervasive: false,
      questionRef: 'SA_Q6',
    })
  }
  if (formData['SA_Q7'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q7',
      description: 'Significant cash shortages or unexplained losses — misappropriation of assets risk.',
      severity: 'high',
      pervasive: false,
      questionRef: 'SA_Q7',
    })
  }
  if (formData['SA_Q8'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q8',
      description: 'Unusual journal entries or period-end adjustments — potential manipulation of financial records.',
      severity: 'high',
      pervasive: false,
      questionRef: 'SA_Q8',
    })
  }
  if (formData['SA_Q9'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q9',
      description: 'Unusual related party transactions — potential undisclosed conflicts of interest.',
      severity: 'medium',
      pervasive: false,
      questionRef: 'SA_Q9',
    })
  }
  if (formData['SA_Q10'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q10',
      description: 'Evidence of revenue recognition issues or manipulation — material misstatement risk.',
      severity: 'high',
      pervasive: false,
      questionRef: 'SA_Q10',
    })
  }
  if (formData['SA_Q11'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q11',
      description: 'Key employees resistant to audit inquiries — scope limitation and concealment risk.',
      severity: 'high',
      pervasive: false,
      questionRef: 'SA_Q11',
    })
  }
  if (formData['SA_Q12'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q12',
      description: 'High-value procurement contracts awarded without proper process — misappropriation risk.',
      severity: 'high',
      pervasive: false,
      questionRef: 'SA_Q12',
    })
  }
  if (formData['SA_Q2'] === 'yes') {
    triggered.push({
      id: 'ue5-sa-q2',
      description: 'Management representations regarding fraud require corroboration through audit procedures.',
      severity: 'medium',
      pervasive: false,
      questionRef: 'SA_Q2',
    })
  }

  return triggered
}

// ─── Required field check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['SA_Q1', 'SA_Q2', 'SB_Q1', 'SB_Q2']

function checkCanSubmit(formData) {
  // SB_Q1 is only required if any Section A answer is Yes
  const sectionAKeys = [
    'SA_Q1', 'SA_Q2', 'SA_Q3', 'SA_Q4', 'SA_Q5', 'SA_Q6',
    'SA_Q7', 'SA_Q8', 'SA_Q9', 'SA_Q10', 'SA_Q11', 'SA_Q12',
  ]
  const anyYes = sectionAKeys.some((k) => formData[k] === 'yes')

  const baseRequired = ['SA_Q1', 'SA_Q2', 'SB_Q2']
  const allBase = baseRequired.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })

  if (!allBase) return false
  if (anyYes && (!formData['SB_Q1'] || formData['SB_Q1'].trim() === '')) return false
  return true
}

// ─── Main UE5 Page ───────────────────────────────────────────────────────────
export default function UE5Page() {
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
  } = useWorkpaper(engagementId, 'UE5')

  // Compute triggered risks
  const triggeredRisks = useMemo(() => computeUE5Risks(formData), [formData])
  const canSubmitForm = checkCanSubmit(formData)

  // Check if any Section A answer is Yes (for SB_Q1 required hint)
  const anyYesInSectionA = useMemo(() => {
    const keys = [
      'SA_Q1', 'SA_Q2', 'SA_Q3', 'SA_Q4', 'SA_Q5', 'SA_Q6',
      'SA_Q7', 'SA_Q8', 'SA_Q9', 'SA_Q10', 'SA_Q11', 'SA_Q12',
    ]
    return keys.some((k) => formData[k] === 'yes')
  }, [formData])

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
        documentType="UE5"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE5 — Fraud Considerations</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assess fraud risks in accordance with ISSAI 2240. Any Yes response in Section A triggers an
            individual fraud risk that must be addressed in the audit plan.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* High-risk advisory banner */}
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <span className="font-semibold">ISSAI 2240 Reminder:</span> The auditor must maintain professional
          scepticism throughout the engagement. Fraud risk factors identified here must be communicated
          to the team and addressed in the Audit Programme (AP4).
        </div>

        {/* ── SECTION A: Fraud Risk Assessment ────────────────────────────── */}
        <FormSection title="Fraud Risk Assessment" sectionCode="SEC-A" sectionNumber="A">
          <QuestionField
            questionRef="SA_Q1"
            questionNo="A.1"
            questionText="Has the audit team identified or been made aware of any fraud or suspected fraud?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q1')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="A Yes answer triggers immediate escalation requirements under ISSAI 2240."
            {...field('SA_Q1')}
            {...evidenceField('SA_Q1')}
          />
          <QuestionField
            questionRef="SA_Q2"
            questionNo="A.2"
            questionText="Has management made any representations regarding fraud during the period?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q2')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('SA_Q2')}
            {...evidenceField('SA_Q2')}
          />
          <QuestionField
            questionRef="SA_Q3"
            questionNo="A.3"
            questionText="Are there incentives or pressures on management that could lead to fraudulent financial reporting?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q3')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Consider budget pressures, performance targets, personal financial pressures, and political influences."
            {...field('SA_Q3')}
            {...evidenceField('SA_Q3')}
          />
          <QuestionField
            questionRef="SA_Q4"
            questionNo="A.4"
            questionText="Are there opportunities for fraud due to weak controls or override of controls?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q4')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('SA_Q4')}
            {...evidenceField('SA_Q4')}
          />
          <QuestionField
            questionRef="SA_Q5"
            questionNo="A.5"
            questionText="Is there evidence of management override of controls?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q5')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Management override is a presumed fraud risk under ISSAI 2240 — always test journal entries and estimates."
            {...field('SA_Q5')}
            {...evidenceField('SA_Q5')}
          />
          <QuestionField
            questionRef="SA_Q6"
            questionNo="A.6"
            questionText="Are there unusual or complex transactions that are difficult to audit?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q6')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('SA_Q6')}
            {...evidenceField('SA_Q6')}
          />
          <QuestionField
            questionRef="SA_Q7"
            questionNo="A.7"
            questionText="Has the entity experienced any significant cash shortages or unexplained losses?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q7')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('SA_Q7')}
            {...evidenceField('SA_Q7')}
          />
          <QuestionField
            questionRef="SA_Q8"
            questionNo="A.8"
            questionText="Are there unusual journal entries or adjustments at period end?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q8')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Pay particular attention to entries posted by unusual users, at unusual times, or with vague descriptions."
            {...field('SA_Q8')}
            {...evidenceField('SA_Q8')}
          />
          <QuestionField
            questionRef="SA_Q9"
            questionNo="A.9"
            questionText="Are there significant related party transactions that appear unusual?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q9')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('SA_Q9')}
            {...evidenceField('SA_Q9')}
          />
          <QuestionField
            questionRef="SA_Q10"
            questionNo="A.10"
            questionText="Is there evidence of revenue recognition issues or manipulation?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q10')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('SA_Q10')}
            {...evidenceField('SA_Q10')}
          />
          <QuestionField
            questionRef="SA_Q11"
            questionNo="A.11"
            questionText="Are key employees resistant to providing information or explanations?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q11')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="Resistance or evasiveness is a significant behavioural indicator of fraud."
            {...field('SA_Q11')}
            {...evidenceField('SA_Q11')}
          />
          <QuestionField
            questionRef="SA_Q12"
            questionNo="A.12"
            questionText="Are there high-value procurement contracts awarded without proper process?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('SA_Q12')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('SA_Q12')}
            {...evidenceField('SA_Q12')}
          />
        </FormSection>

        {/* ── SECTION B: Fraud Risk Summary ───────────────────────────────── */}
        <FormSection title="Fraud Risk Summary" sectionCode="SEC-B" sectionNumber="B">
          {anyYesInSectionA && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              One or more fraud indicators have been identified. The description of identified fraud risks
              and planned responses is <span className="font-semibold">required</span> before submission.
            </div>
          )}
          <QuestionField
            questionRef="SB_Q1"
            questionNo="B.1"
            questionText="Describe any identified fraud risks and planned responses"
            type="text"
            isRequired={anyYesInSectionA}
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('SB_Q1')}
            {...evidenceField('SB_Q1')}
          />
          <QuestionField
            questionRef="SB_Q2"
            questionNo="B.2"
            questionText="Overall fraud risk level assessment"
            type="select"
            options={['Low', 'Medium', 'High']}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('SB_Q2')}
            {...evidenceField('SB_Q2')}
          />
          <QuestionField
            questionRef="SB_Q3"
            questionNo="B.3"
            questionText="Additional fraud considerations and auditor observations"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('SB_Q3')}
            {...evidenceField('SB_Q3')}
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
