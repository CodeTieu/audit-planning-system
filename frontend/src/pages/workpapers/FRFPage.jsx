import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Lookup options ───────────────────────────────────────────────────────────
const FRF_OPTIONS = ['IPSAS (Accrual)', 'IPSAS (Cash)', 'IFRS', 'IFRS for SMEs', 'National GAAP', 'Other']

// ─── Five Attributes table columns ────────────────────────────────────────────
const ATTRIBUTES_COLUMNS = [
  { key: 'attribute', label: 'Attribute', type: 'text', minWidth: '280px' },
  {
    key: 'assessment', label: 'Assessment', type: 'select', minWidth: '170px',
    options: ['Acceptable', 'Partially Acceptable', 'Not Acceptable'],
  },
  { key: 'evidence', label: 'Evidence / Basis', type: 'text', minWidth: '200px' },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: '160px' },
]

// ─── Pre-populated Five Attributes rows ───────────────────────────────────────
const DEFAULT_ATTRIBUTE_ROWS = [
  { attribute: 'Relevance — FRF provides relevant information for decision-making', assessment: '', evidence: '', notes: '' },
  { attribute: 'Completeness — FRF addresses all significant transactions/balances', assessment: '', evidence: '', notes: '' },
  { attribute: 'Reliability — FRF provides reliable and verifiable measurements', assessment: '', evidence: '', notes: '' },
  { attribute: 'Neutrality — FRF is free from bias', assessment: '', evidence: '', notes: '' },
  { attribute: 'Understandability — Users can understand the financial statements', assessment: '', evidence: '', notes: '' },
]

// ─── Risk trigger logic ───────────────────────────────────────────────────────
function computeFRFRisks(formData) {
  const triggered = []

  if (formData['S1_Q4'] === 'no') {
    triggered.push({ id: 'frf-s1q4', description: 'FRF not appropriate for this type of entity', severity: 'high', pervasive: true, questionRef: 'S1_Q4' })
  }
  if (formData['S2_Q2'] === 'no') {
    triggered.push({ id: 'frf-s2q2', description: 'FRF not consistently applied — comparability issue', severity: 'medium', pervasive: false, questionRef: 'S2_Q2' })
  }
  if (formData['S2_Q3'] === 'yes') {
    triggered.push({ id: 'frf-s2q3', description: 'Significant departures from applicable FRF', severity: 'high', pervasive: false, questionRef: 'S2_Q3' })
  }
  if (formData['S4_Q1'] === 'Not Acceptable') {
    triggered.push({ id: 'frf-s4q1', description: 'Financial Reporting Framework is not acceptable — engagement may need to be reconsidered', severity: 'high', pervasive: true, questionRef: 'S4_Q1' })
  }

  return triggered
}

// ─── Required field check ─────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q2', 'S1_Q4', 'S2_Q1', 'S4_Q1', 'S4_Q2']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FRFPage() {
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
    useWorkpaper(engagementId, 'FRF')

  const triggeredRisks = useMemo(() => computeFRFRisks(formData), [formData])
  const canSubmitForm = checkCanSubmit(formData)

  // Five attributes table — use defaults when empty
  const attributesValue = useMemo(() => {
    const stored = formData['S3_Q1']
    if (Array.isArray(stored) && stored.length > 0) return stored
    return DEFAULT_ATTRIBUTE_ROWS
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
        documentType="FRF"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">FRF — Financial Reporting Framework Acceptability</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pre-engagement assessment of the applicable financial reporting framework.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* SECTION 1 — FRF Identification */}
        <FormSection title="FRF Identification" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField questionRef="S1_Q1" questionNo="1.1" questionText="Applicable Financial Reporting Framework" type="select" options={FRF_OPTIONS} isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q1')} {...evidenceField('S1_Q1')} />
          <QuestionField questionRef="S1_Q2" questionNo="1.2" questionText="Is the FRF prescribed by legislation or regulation?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q2')} {...evidenceField('S1_Q2')} />
          <QuestionField questionRef="S1_Q3" questionNo="1.3" questionText="Identify the specific legislation/regulation prescribing the FRF" type="text" readOnly={readOnly} engagementId={engagementId} {...field('S1_Q3')} {...evidenceField('S1_Q3')} />
          <QuestionField questionRef="S1_Q4" questionNo="1.4" questionText="Is the prescribed FRF appropriate for the type of entity?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S1_Q4')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S1_Q4')} {...evidenceField('S1_Q4')} />
        </FormSection>

        {/* SECTION 2 — FRF Hierarchy Evaluation */}
        <FormSection title="FRF Hierarchy Evaluation" sectionCode="SEC2" sectionNumber={2}>
          <QuestionField questionRef="S2_Q1" questionNo="2.1" questionText="Does the FRF address all significant transactions and balances?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S2_Q1')} {...evidenceField('S2_Q1')} />
          <QuestionField questionRef="S2_Q2" questionNo="2.2" questionText="Is the FRF consistently applied from the prior period?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q2')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q2')} {...evidenceField('S2_Q2')} />
          <QuestionField questionRef="S2_Q3" questionNo="2.3" questionText="Are there any significant departures from the FRF?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q3')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q3')} {...evidenceField('S2_Q3')} />
        </FormSection>

        {/* SECTION 3 — Five Attributes Assessment */}
        <FormSection title="Five Attributes Assessment" sectionCode="SEC3" sectionNumber={3}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Assess each of the five qualitative attributes of the applicable FRF.
          </p>
          <QuestionField
            questionRef="S3_Q1"
            questionNo="3.1"
            questionText="Five attributes evaluation"
            type="table"
            columns={ATTRIBUTES_COLUMNS}
            value={attributesValue}
            onChange={(val) => updateField('S3_Q1', val)}
            readOnly={readOnly}
            engagementId={engagementId}
          />
        </FormSection>

        {/* SECTION 4 — FRF Conclusion */}
        <FormSection title="FRF Conclusion" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Overall FRF acceptability"
            type="select"
            options={['Acceptable', 'Acceptable with Modifications', 'Not Acceptable']}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S4_Q1')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S4_Q1')}
            {...evidenceField('S4_Q1')}
          />
          <QuestionField questionRef="S4_Q2" questionNo="4.2" questionText="FRF acceptability conclusion and basis" type="text" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S4_Q2')} {...evidenceField('S4_Q2')} />
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
