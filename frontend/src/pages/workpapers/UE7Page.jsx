import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Table columns ────────────────────────────────────────────────────────────
const LITIGATION_COLUMNS = [
  { key: 'case_description', label: 'Case Description', type: 'text', minWidth: '200px' },
  {
    key: 'court_level', label: 'Court Level', type: 'select', minWidth: '160px',
    options: ['Primary Court', 'High Court', 'Court of Appeal', 'Labour Court', 'Other'],
  },
  { key: 'amount_claimed', label: 'Amount Claimed', type: 'number', minWidth: '130px' },
  {
    key: 'status', label: 'Status', type: 'select', minWidth: '130px',
    options: ['Pending', 'Settled', 'Dismissed', 'Appealed'],
  },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: '160px' },
]

const RELATED_PARTY_COLUMNS = [
  { key: 'party_name', label: 'Party Name', type: 'text', minWidth: '150px' },
  { key: 'relationship', label: 'Relationship', type: 'text', minWidth: '140px' },
  { key: 'transaction_type', label: 'Transaction Type', type: 'text', minWidth: '150px' },
  { key: 'amount_tzs', label: 'Amount (TZS)', type: 'number', minWidth: '130px' },
  {
    key: 'disclosed', label: 'Disclosed?', type: 'select', minWidth: '110px',
    options: ['Yes', 'No', 'Partial'],
  },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: '160px' },
]

// ─── Risk trigger logic ───────────────────────────────────────────────────────
function computeUE7Risks(formData) {
  const triggered = []

  if (formData['S1_Q1'] === 'yes') {
    triggered.push({ id: 'ue7-s1q1', description: 'Pending litigation — contingent liability risk', severity: 'medium', pervasive: false, questionRef: 'S1_Q1', cotabd: 'Provisions & Contingencies' })
  }
  if (formData['S2_Q1'] === 'yes') {
    triggered.push({ id: 'ue7-s2q1', description: 'Related party transactions identified — conflict of interest risk', severity: 'medium', pervasive: false, questionRef: 'S2_Q1' })
  }
  if (formData['S2_Q4'] === 'no') {
    triggered.push({ id: 'ue7-s2q4', description: 'Related party transactions not disclosed', severity: 'high', pervasive: false, questionRef: 'S2_Q4' })
  }
  if (formData['S3_Q1'] === 'yes') {
    triggered.push({ id: 'ue7-s3q1', description: 'Significant subsequent events identified', severity: 'medium', pervasive: false, questionRef: 'S3_Q1' })
  }
  if (formData['S4_Q1'] === 'yes') {
    triggered.push({ id: 'ue7-s4q1', description: 'Going concern issues identified', severity: 'high', pervasive: true, questionRef: 'S4_Q1' })
  }
  if (formData['S4_Q3'] === 'yes') {
    triggered.push({ id: 'ue7-s4q3', description: 'Unrecorded commitments or contingent liabilities', severity: 'medium', pervasive: false, questionRef: 'S4_Q3', cotabd: 'Provisions & Contingencies' })
  }

  return triggered
}

// ─── Required field check ─────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q3', 'S2_Q1']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UE7Page() {
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
    useWorkpaper(engagementId, 'UE7')

  const triggeredRisks = useMemo(() => computeUE7Risks(formData), [formData])
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
        documentType="UE7"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE7 — Other Considerations</h2>
          <p className="text-sm text-gray-500 mt-1">
            Litigations, related party transactions, subsequent events and other audit considerations.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* SECTION 1 — Litigations & Claims */}
        <FormSection title="Litigations & Claims" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField questionRef="S1_Q1" questionNo="1.1" questionText="Are there any pending litigation cases involving the entity?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S1_Q1')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S1_Q1')} {...evidenceField('S1_Q1')} />
          <QuestionField
            questionRef="S1_Q2"
            questionNo="1.2"
            questionText="Litigation cases — details"
            type="table"
            columns={LITIGATION_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            guidance="Complete this table if question 1.1 is answered Yes."
            {...field('S1_Q2')}
          />
          <QuestionField questionRef="S1_Q3" questionNo="1.3" questionText="Are legal provisions adequately recorded in the financial statements?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q3')} {...evidenceField('S1_Q3')} />
          <QuestionField questionRef="S1_Q4" questionNo="1.4" questionText="Overall assessment of litigation risk" type="text" readOnly={readOnly} engagementId={engagementId} {...field('S1_Q4')} {...evidenceField('S1_Q4')} />
        </FormSection>

        {/* SECTION 2 — Related Party Transactions */}
        <FormSection title="Related Party Transactions" sectionCode="SEC2" sectionNumber={2}>
          <QuestionField questionRef="S2_Q1" questionNo="2.1" questionText="Has the entity transacted with related parties during the audit period?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q1')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q1')} {...evidenceField('S2_Q1')} />
          <QuestionField
            questionRef="S2_Q2"
            questionNo="2.2"
            questionText="Related party transactions — details"
            type="table"
            columns={RELATED_PARTY_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            guidance="Complete this table if question 2.1 is answered Yes."
            {...field('S2_Q2')}
          />
          <QuestionField questionRef="S2_Q3" questionNo="2.3" questionText="Are related party transactions conducted at arm's length?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S2_Q3')} {...evidenceField('S2_Q3')} />
          <QuestionField questionRef="S2_Q4" questionNo="2.4" questionText="Are related party transactions properly disclosed in the financial statements?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q4')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q4')} {...evidenceField('S2_Q4')} />
        </FormSection>

        {/* SECTION 3 — Subsequent Events */}
        <FormSection title="Subsequent Events" sectionCode="SEC3" sectionNumber={3}>
          <QuestionField questionRef="S3_Q1" questionNo="3.1" questionText="Are there any significant events after the balance sheet date that require disclosure?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S3_Q1')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S3_Q1')} {...evidenceField('S3_Q1')} />
          <QuestionField questionRef="S3_Q2" questionNo="3.2" questionText="Describe any subsequent events identified" type="text" readOnly={readOnly} engagementId={engagementId} {...field('S3_Q2')} {...evidenceField('S3_Q2')} />
          <QuestionField questionRef="S3_Q3" questionNo="3.3" questionText="Have subsequent events been properly reflected or disclosed in the financial statements?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S3_Q3')} {...evidenceField('S3_Q3')} />
        </FormSection>

        {/* SECTION 4 — Other Audit Considerations */}
        <FormSection title="Other Audit Considerations" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField questionRef="S4_Q1" questionNo="4.1" questionText="Are there any going concern issues identified?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S4_Q1')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S4_Q1')} {...evidenceField('S4_Q1')} />
          <QuestionField questionRef="S4_Q2" questionNo="4.2" questionText="Are there any management representations that require corroboration?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S4_Q2')} {...evidenceField('S4_Q2')} />
          <QuestionField questionRef="S4_Q3" questionNo="4.3" questionText="Are there any significant commitments or contingent liabilities not yet recorded?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S4_Q3')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S4_Q3')} {...evidenceField('S4_Q3')} />
          <QuestionField questionRef="S4_Q4" questionNo="4.4" questionText="Any other material considerations for the audit" type="text" readOnly={readOnly} engagementId={engagementId} {...field('S4_Q4')} {...evidenceField('S4_Q4')} />
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
