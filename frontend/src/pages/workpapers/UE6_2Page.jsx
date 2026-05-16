import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── IT Systems table columns ─────────────────────────────────────────────────
const IT_SYSTEMS_COLUMNS = [
  { key: 'system_name', label: 'System Name', type: 'text', minWidth: '150px' },
  {
    key: 'system_type', label: 'System Type', type: 'select', minWidth: '160px',
    options: ['Financial Management', 'Payroll', 'Procurement', 'Revenue', 'Other'],
  },
  { key: 'vendor', label: 'Vendor/Developer', type: 'text', minWidth: '140px' },
  { key: 'year_implemented', label: 'Year Implemented', type: 'text', minWidth: '120px' },
  { key: 'key_risks', label: 'Key IT Risks Identified', type: 'text', minWidth: '200px' },
]

// ─── Risk trigger logic ───────────────────────────────────────────────────────
function computeUE6_2Risks(formData) {
  const triggered = []

  const checks = [
    { key: 'S1_Q2', triggerVal: 'no', id: 'ue6_2-s1q2', description: 'Unauthorized access to financial systems possible', severity: 'high', pervasive: true },
    { key: 'S1_Q3', triggerVal: 'no', id: 'ue6_2-s1q3', description: 'No formal user access management — unauthorized users may persist', severity: 'high', pervasive: false },
    { key: 'S1_Q4', triggerVal: 'no', id: 'ue6_2-s1q4', description: 'Weak password policies — system access at risk', severity: 'medium', pervasive: false },
    { key: 'S1_Q5', triggerVal: 'no', id: 'ue6_2-s1q5', description: 'System activities not logged — fraud/errors may go undetected', severity: 'medium', pervasive: false },
    { key: 'S1_Q6', triggerVal: 'no', id: 'ue6_2-s1q6', description: 'No IT segregation of duties', severity: 'high', pervasive: true },
    { key: 'S2_Q2', triggerVal: 'no', id: 'ue6_2-s2q2', description: 'System changes not tested — data integrity at risk', severity: 'medium', pervasive: false },
    { key: 'S3_Q1', triggerVal: 'no', id: 'ue6_2-s3q1', description: 'No disaster recovery plan — business continuity risk', severity: 'high', pervasive: false },
    { key: 'S3_Q2', triggerVal: 'no', id: 'ue6_2-s3q2', description: 'Data backups not performed — data loss risk', severity: 'high', pervasive: false },
    { key: 'S3_Q3', triggerVal: 'no', id: 'ue6_2-s3q3', description: 'No data validation controls', severity: 'medium', pervasive: false, cotabd: 'All COTABDs' },
    { key: 'S3_Q4', triggerVal: 'no', id: 'ue6_2-s3q4', description: 'No audit trails in financial system — unauthorized transactions hard to detect', severity: 'high', pervasive: false },
  ]

  for (const c of checks) {
    if (formData[c.key] === c.triggerVal) {
      triggered.push({ id: c.id, description: c.description, severity: c.severity, pervasive: c.pervasive, questionRef: c.key, cotabd: c.cotabd })
    }
  }

  return triggered
}

// ─── Required field check ─────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q2', 'S3_Q1', 'S5_Q1', 'S5_Q2']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UE6_2Page() {
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
    useWorkpaper(engagementId, 'UE6_2')

  const triggeredRisks = useMemo(() => computeUE6_2Risks(formData), [formData])
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
        documentType="UE6_2"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE6.2 — IT Controls (Information Systems)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assessment of IT general controls and information systems, per ISSAI 2315.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* SECTION 1 — IT General Controls */}
        <FormSection title="IT General Controls" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField questionRef="S1_Q1" questionNo="1.1" questionText="Is there a documented IT governance framework or policy?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q1')} {...evidenceField('S1_Q1')} />
          <QuestionField questionRef="S1_Q2" questionNo="1.2" questionText="Is access to financial systems restricted to authorized personnel?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S1_Q2')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S1_Q2')} {...evidenceField('S1_Q2')} />
          <QuestionField questionRef="S1_Q3" questionNo="1.3" questionText="Is there a formal user access management process (creation, modification, deletion)?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S1_Q3')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S1_Q3')} {...evidenceField('S1_Q3')} />
          <QuestionField questionRef="S1_Q4" questionNo="1.4" questionText="Are password policies enforced (complexity, expiry, lockout)?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S1_Q4')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S1_Q4')} {...evidenceField('S1_Q4')} />
          <QuestionField questionRef="S1_Q5" questionNo="1.5" questionText="Are system activities logged and reviewed regularly?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S1_Q5')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S1_Q5')} {...evidenceField('S1_Q5')} />
          <QuestionField questionRef="S1_Q6" questionNo="1.6" questionText="Is there segregation of duties within IT systems?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S1_Q6')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S1_Q6')} {...evidenceField('S1_Q6')} />
        </FormSection>

        {/* SECTION 2 — Change Management */}
        <FormSection title="Change Management" sectionCode="SEC2" sectionNumber={2}>
          <QuestionField questionRef="S2_Q1" questionNo="2.1" questionText="Is there a formal change management procedure for system changes?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S2_Q1')} {...evidenceField('S2_Q1')} />
          <QuestionField questionRef="S2_Q2" questionNo="2.2" questionText="Are system changes tested before implementation?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q2')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q2')} {...evidenceField('S2_Q2')} />
          <QuestionField questionRef="S2_Q3" questionNo="2.3" questionText="Is there a rollback procedure for failed changes?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S2_Q3')} {...evidenceField('S2_Q3')} />
        </FormSection>

        {/* SECTION 3 — Business Continuity & Data Integrity */}
        <FormSection title="Business Continuity & Data Integrity" sectionCode="SEC3" sectionNumber={3}>
          <QuestionField questionRef="S3_Q1" questionNo="3.1" questionText="Is there a Business Continuity / Disaster Recovery plan?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S3_Q1')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S3_Q1')} {...evidenceField('S3_Q1')} />
          <QuestionField questionRef="S3_Q2" questionNo="3.2" questionText="Are regular data backups performed and tested?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S3_Q2')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S3_Q2')} {...evidenceField('S3_Q2')} />
          <QuestionField questionRef="S3_Q3" questionNo="3.3" questionText="Is there data validation to ensure completeness and accuracy of transactions?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S3_Q3')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S3_Q3')} {...evidenceField('S3_Q3')} />
          <QuestionField questionRef="S3_Q4" questionNo="3.4" questionText="Are audit trails maintained in the financial system?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S3_Q4')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S3_Q4')} {...evidenceField('S3_Q4')} />
        </FormSection>

        {/* SECTION 4 — Key Financial Systems Used */}
        <FormSection title="Key Financial Systems Used" sectionCode="SEC4" sectionNumber={4}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            List all key financial systems in use by the entity during the audit period.
          </p>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Financial systems inventory"
            type="table"
            columns={IT_SYSTEMS_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q1')}
          />
        </FormSection>

        {/* SECTION 5 — Overall IT Control Assessment */}
        <FormSection title="Overall IT Control Assessment" sectionCode="SEC5" sectionNumber={5}>
          <QuestionField questionRef="S5_Q1" questionNo="5.1" questionText="Overall IT control environment rating" type="select" options={['Strong', 'Satisfactory', 'Weak', 'Very Weak']} isRequired readOnly={readOnly} engagementId={engagementId} {...field('S5_Q1')} {...evidenceField('S5_Q1')} />
          <QuestionField questionRef="S5_Q2" questionNo="5.2" questionText="Key IT control weaknesses and observations" type="text" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S5_Q2')} {...evidenceField('S5_Q2')} />
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
