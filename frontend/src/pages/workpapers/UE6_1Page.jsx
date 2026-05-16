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
function computeUE6_1Risks(formData) {
  const triggered = []

  const checks = [
    {
      key: 'S2_Q1', triggerVal: 'no', id: 'ue6_1-s2q1',
      description: 'No authorization procedures for financial transactions',
      severity: 'high', pervasive: false, is_cotabd_specific: true,
    },
    {
      key: 'S2_Q2', triggerVal: 'no', id: 'ue6_1-s2q2',
      description: 'Inadequate segregation of duties in financial processes',
      severity: 'high', pervasive: true, is_cotabd_specific: true,
    },
    {
      key: 'S2_Q3', triggerVal: 'no', id: 'ue6_1-s2q3',
      description: 'Physical assets not adequately safeguarded',
      severity: 'medium', pervasive: false, is_cotabd_specific: true,
    },
    {
      key: 'S2_Q4', triggerVal: 'no', id: 'ue6_1-s2q4',
      description: 'Reconciliations not performed or reviewed',
      severity: 'medium', pervasive: false, is_cotabd_specific: true,
    },
    {
      key: 'S2_Q5', triggerVal: 'no', id: 'ue6_1-s2q5',
      description: 'Inadequate procurement controls',
      severity: 'high', pervasive: false, is_cotabd_specific: true, cotabd: 'Procurement & Expenditure',
    },
    {
      key: 'S2_Q6', triggerVal: 'no', id: 'ue6_1-s2q6',
      description: 'Inadequate payroll controls',
      severity: 'high', pervasive: false, is_cotabd_specific: true, cotabd: 'Wages & Salaries',
    },
    {
      key: 'S2_Q7', triggerVal: 'no', id: 'ue6_1-s2q7',
      description: 'Inadequate revenue collection controls',
      severity: 'high', pervasive: false, is_cotabd_specific: true, cotabd: 'Revenue',
    },
    {
      key: 'S3_Q1', triggerVal: 'no', id: 'ue6_1-s3q1',
      description: 'Financial information not captured accurately',
      severity: 'medium', pervasive: false, is_cotabd_specific: true,
    },
    {
      key: 'S3_Q4', triggerVal: 'no', id: 'ue6_1-s3q4',
      description: 'Weak financial reporting controls',
      severity: 'high', pervasive: true, is_cotabd_specific: true,
    },
    {
      key: 'S4_Q3', triggerVal: 'no', id: 'ue6_1-s4q3',
      description: 'Internal audit recommendations not implemented',
      severity: 'medium', pervasive: false, is_cotabd_specific: true,
    },
    {
      key: 'S4_Q4', triggerVal: 'no', id: 'ue6_1-s4q4',
      description: 'Prior audit findings not resolved',
      severity: 'medium', pervasive: false, is_cotabd_specific: true,
    },
  ]

  for (const c of checks) {
    if (formData[c.key] === c.triggerVal) {
      triggered.push({ id: c.id, description: c.description, severity: c.severity, pervasive: c.pervasive, questionRef: c.key, cotabd: c.cotabd })
    }
  }

  return triggered
}

// ─── Required field check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q3', 'S1_Q4', 'S2_Q1', 'S2_Q2', 'S3_Q1', 'S4_Q1', 'S4_Q2', 'S5_Q1', 'S5_Q2']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function UE6_1Page() {
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
    useWorkpaper(engagementId, 'UE6_1')

  const triggeredRisks = useMemo(() => computeUE6_1Risks(formData), [formData])
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
        documentType="UE6_1"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE6.1 — Internal Controls (Excluding Information Systems)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assessment of internal controls excluding IS, per ISSAI 2315.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* SECTION 1 — Control Environment */}
        <FormSection title="Control Environment" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField questionRef="S1_Q1" questionNo="1.1" questionText="Does management demonstrate a commitment to integrity and ethical values?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q1')} {...evidenceField('S1_Q1')} />
          <QuestionField questionRef="S1_Q2" questionNo="1.2" questionText="Is there a code of conduct or ethics policy in place and enforced?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S1_Q2')} {...evidenceField('S1_Q2')} />
          <QuestionField questionRef="S1_Q3" questionNo="1.3" questionText="Does the board/governance structure provide adequate oversight of internal controls?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q3')} {...evidenceField('S1_Q3')} />
          <QuestionField questionRef="S1_Q4" questionNo="1.4" questionText="Is there an adequate organizational structure to support control objectives?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S1_Q4')} {...evidenceField('S1_Q4')} />
          <QuestionField questionRef="S1_Q5" questionNo="1.5" questionText="Are human resource policies adequate (recruitment, training, performance evaluation)?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S1_Q5')} {...evidenceField('S1_Q5')} />
          <QuestionField questionRef="S1_Q6" questionNo="1.6" questionText="Does management demonstrate appropriate attitudes toward financial reporting?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S1_Q6')} {...evidenceField('S1_Q6')} />
        </FormSection>

        {/* SECTION 2 — Control Activities */}
        <FormSection title="Control Activities" sectionCode="SEC2" sectionNumber={2}>
          <QuestionField questionRef="S2_Q1" questionNo="2.1" questionText="Are there adequate authorization procedures for financial transactions?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q1')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q1')} {...evidenceField('S2_Q1')} />
          <QuestionField questionRef="S2_Q2" questionNo="2.2" questionText="Is there adequate segregation of duties in key financial processes?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q2')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q2')} {...evidenceField('S2_Q2')} />
          <QuestionField questionRef="S2_Q3" questionNo="2.3" questionText="Are physical assets adequately safeguarded and access controlled?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q3')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q3')} {...evidenceField('S2_Q3')} />
          <QuestionField questionRef="S2_Q4" questionNo="2.4" questionText="Are reconciliations performed regularly and reviewed by supervisors?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q4')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q4')} {...evidenceField('S2_Q4')} />
          <QuestionField questionRef="S2_Q5" questionNo="2.5" questionText="Are there adequate controls over the procurement process?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q5')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q5')} {...evidenceField('S2_Q5')} />
          <QuestionField questionRef="S2_Q6" questionNo="2.6" questionText="Are payroll controls adequate (preparation, approval, payment)?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q6')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q6')} {...evidenceField('S2_Q6')} />
          <QuestionField questionRef="S2_Q7" questionNo="2.7" questionText="Are controls over revenue collection and banking adequate?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S2_Q7')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S2_Q7')} {...evidenceField('S2_Q7')} />
        </FormSection>

        {/* SECTION 3 — Information & Communication */}
        <FormSection title="Information & Communication" sectionCode="SEC3" sectionNumber={3}>
          <QuestionField questionRef="S3_Q1" questionNo="3.1" questionText="Is financial information captured accurately and timely?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} risks={risksFor('S3_Q1')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S3_Q1')} {...evidenceField('S3_Q1')} />
          <QuestionField questionRef="S3_Q2" questionNo="3.2" questionText="Are management reports produced regularly and reviewed?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S3_Q2')} {...evidenceField('S3_Q2')} />
          <QuestionField questionRef="S3_Q3" questionNo="3.3" questionText="Is there adequate communication of control responsibilities to staff?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} {...field('S3_Q3')} {...evidenceField('S3_Q3')} />
          <QuestionField questionRef="S3_Q4" questionNo="3.4" questionText="Are there adequate controls over financial reporting processes?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S3_Q4')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S3_Q4')} {...evidenceField('S3_Q4')} />
        </FormSection>

        {/* SECTION 4 — Monitoring */}
        <FormSection title="Monitoring" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField questionRef="S4_Q1" questionNo="4.1" questionText="Does management monitor control performance on an ongoing basis?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S4_Q1')} {...evidenceField('S4_Q1')} />
          <QuestionField questionRef="S4_Q2" questionNo="4.2" questionText="Is there a functional internal audit unit?" type="yes_no_na" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S4_Q2')} {...evidenceField('S4_Q2')} />
          <QuestionField questionRef="S4_Q3" questionNo="4.3" questionText="Are internal audit reports acted upon by management?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S4_Q3')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S4_Q3')} {...evidenceField('S4_Q3')} />
          <QuestionField questionRef="S4_Q4" questionNo="4.4" questionText="Are prior audit findings tracked and resolved?" type="yes_no_na" readOnly={readOnly} engagementId={engagementId} risks={risksFor('S4_Q4')} onGenerateFinding={(risk) => setFindingModalRisk(risk)} {...field('S4_Q4')} {...evidenceField('S4_Q4')} />
        </FormSection>

        {/* SECTION 5 — Overall IC Assessment */}
        <FormSection title="Overall IC Assessment (Excluding IS)" sectionCode="SEC5" sectionNumber={5}>
          <QuestionField questionRef="S5_Q1" questionNo="5.1" questionText="Overall control environment rating" type="select" options={['Strong', 'Satisfactory', 'Weak', 'Very Weak']} isRequired readOnly={readOnly} engagementId={engagementId} {...field('S5_Q1')} {...evidenceField('S5_Q1')} />
          <QuestionField questionRef="S5_Q2" questionNo="5.2" questionText="Key internal control weaknesses and observations" type="text" isRequired readOnly={readOnly} engagementId={engagementId} {...field('S5_Q2')} {...evidenceField('S5_Q2')} />
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
