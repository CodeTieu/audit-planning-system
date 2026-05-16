import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'
import FindingModal from '../../components/workpaper/FindingModal'

// ─── Law/Regulation table columns (shared for Cat 1 & Cat 2) ────────────────
const LAW_COLUMNS = [
  { key: 'law_name',               label: 'Law / Regulation / Policy',     type: 'text',   minWidth: '180px' },
  { key: 'section_ref',            label: 'Section / Regulation Reference', type: 'text',   minWidth: '160px' },
  { key: 'cotabd_affected',        label: 'COTABD Typically Affected',      type: 'text',   minWidth: '160px' },
  {
    key: 'assertion',
    label: 'Assertion(s) Affected',
    type: 'select',
    options: [
      'Existence',
      'Completeness',
      'Rights & Obligations',
      'Valuation',
      'Presentation & Disclosure',
      'Cut-off',
      'Accuracy',
      'Authorization',
      'Occurrence',
    ],
    minWidth: '180px',
  },
  { key: 'non_compliance_scenario', label: 'Possible Non-Compliance Scenario', type: 'text', minWidth: '200px' },
  {
    key: 'risk_identified',
    label: 'Risk Identified',
    type: 'select',
    options: ['Yes', 'No'],
    minWidth: '110px',
  },
  { key: 'wp_ref', label: 'WP Reference', type: 'text', minWidth: '120px' },
]

// ─── Default rows for Category 1 ────────────────────────────────────────────
function makeId() { return Date.now() + Math.random() }

const DEFAULT_CAT1_ROWS = [
  {
    _id: makeId(),
    law_name: 'Public Finance Act (Cap 348)',
    section_ref: 'Control of Public Funds',
    cotabd_affected: 'All COTABDs',
    assertion: 'Authorization',
    non_compliance_scenario: 'Expenditure incurred without authority',
    risk_identified: '',
    wp_ref: '',
  },
  {
    _id: makeId(),
    law_name: 'Local Government Finances Act',
    section_ref: 'Revenue sources and collection',
    cotabd_affected: 'Revenue',
    assertion: 'Completeness',
    non_compliance_scenario: 'Revenue not collected or misappropriated',
    risk_identified: '',
    wp_ref: '',
  },
  {
    _id: makeId(),
    law_name: 'Public Procurement Act (Cap 410)',
    section_ref: 'Procurement procedures',
    cotabd_affected: 'Procurement & Expenditure',
    assertion: 'Authorization',
    non_compliance_scenario: 'Procurement without proper process',
    risk_identified: '',
    wp_ref: '',
  },
  {
    _id: makeId(),
    law_name: 'Income Tax Act',
    section_ref: 'PAYE withholding obligations',
    cotabd_affected: 'Wages & Salaries',
    assertion: 'Completeness',
    non_compliance_scenario: 'Under-deduction of PAYE',
    risk_identified: '',
    wp_ref: '',
  },
  {
    _id: makeId(),
    law_name: 'NSSF Act',
    section_ref: 'Pension contributions',
    cotabd_affected: 'Wages & Salaries',
    assertion: 'Completeness',
    non_compliance_scenario: 'Non-remittance of NSSF contributions',
    risk_identified: '',
    wp_ref: '',
  },
]

// ─── Default rows for Category 2 ────────────────────────────────────────────
const DEFAULT_CAT2_ROWS = [
  {
    _id: makeId(),
    law_name: 'Public Audit Act (Cap 418)',
    section_ref: 'Audit access and requirements',
    cotabd_affected: 'All areas',
    assertion: 'Presentation & Disclosure',
    non_compliance_scenario: 'Restriction of audit access',
    risk_identified: '',
    wp_ref: '',
  },
]

// ─── Risk trigger logic ──────────────────────────────────────────────────────
function computeUE3Risks(formData) {
  const triggered = []

  if (formData['S4_Q2'] === 'yes') {
    triggered.push({
      id: 'ue3-s4q2',
      description: 'Known or suspected non-compliance with laws and regulations.',
      severity: 'high',
      pervasive: false,
      questionRef: 'S4_Q2',
    })
  }
  if (formData['S4_Q4'] === 'High') {
    triggered.push({
      id: 'ue3-s4q4',
      description: 'High overall NOCLAR risk — enhanced audit procedures required.',
      severity: 'high',
      pervasive: false,
      questionRef: 'S4_Q4',
    })
  }

  return triggered
}

// ─── Required field check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S4_Q1', 'S4_Q4']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main UE3 Page ───────────────────────────────────────────────────────────
export default function UE3Page() {
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
  } = useWorkpaper(engagementId, 'UE3')

  // Initialise default rows on first load
  const cat1Value = formData['S2_Q1'] !== undefined ? formData['S2_Q1'] : DEFAULT_CAT1_ROWS
  const cat2Value = formData['S3_Q1'] !== undefined ? formData['S3_Q1'] : DEFAULT_CAT2_ROWS

  // Compute triggered risks
  const triggeredRisks = useMemo(() => computeUE3Risks(formData), [formData])
  const canSubmitForm = checkCanSubmit(formData)

  // Field helpers
  const field = (key) => ({
    value: formData[key] ?? '',
    onChange: (val) => updateField(key, val),
  })

  const fieldWithDefault = (key, defaultVal) => ({
    value: formData[key] !== undefined ? formData[key] : defaultVal,
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
        documentType="UE3"
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">UE3 — Legislative Framework / NOCLAR</h2>
          <p className="text-sm text-gray-500 mt-1">
            Identify applicable laws and assess non-compliance risks in accordance with ISSAI 2250.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* ── SECTION 1: Identification of Applicable Laws ────────────────── */}
        <FormSection title="Identification of Applicable Laws" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField
            questionRef="S1_Q1"
            questionNo="1.1"
            questionText="List all primary legislation governing the entity's operations"
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
            questionText="List all secondary legislation, regulations and policies"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q2')}
            {...evidenceField('S1_Q2')}
          />
          <QuestionField
            questionRef="S1_Q3"
            questionNo="1.3"
            questionText="Has there been any change in applicable legislation during the audit period?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q3')}
            {...evidenceField('S1_Q3')}
          />
          <QuestionField
            questionRef="S1_Q4"
            questionNo="1.4"
            questionText="Is the entity subject to any sector-specific regulatory requirements?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q4')}
            {...evidenceField('S1_Q4')}
          />
        </FormSection>

        {/* ── SECTION 2: Category 1 Laws ──────────────────────────────────── */}
        <FormSection
          title="Law / Regulation Assessment — Category 1 (Direct Effect on Financial Statements)"
          sectionCode="SEC2"
          sectionNumber={2}
        >
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Category 1 laws have a direct effect on material amounts and disclosures in the financial statements.
            Pre-populated rows are editable defaults — add, remove, or modify as required.
          </p>
          <QuestionField
            questionRef="S2_Q1"
            questionNo="2.1"
            questionText="Laws and regulations with direct effect on the financial statements"
            type="table"
            columns={LAW_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...fieldWithDefault('S2_Q1', DEFAULT_CAT1_ROWS)}
          />
        </FormSection>

        {/* ── SECTION 3: Category 2 Laws ──────────────────────────────────── */}
        <FormSection
          title="Law / Regulation Assessment — Category 2 (Indirect Effect on Financial Statements)"
          sectionCode="SEC3"
          sectionNumber={3}
        >
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Category 2 laws do not directly determine material amounts, but compliance may be fundamental
            to the entity's operations or the audit mandate.
          </p>
          <QuestionField
            questionRef="S3_Q1"
            questionNo="3.1"
            questionText="Laws and regulations with indirect effect on the financial statements"
            type="table"
            columns={LAW_COLUMNS}
            readOnly={readOnly}
            engagementId={engagementId}
            {...fieldWithDefault('S3_Q1', DEFAULT_CAT2_ROWS)}
          />
        </FormSection>

        {/* ── SECTION 4: Overall NOCLAR Assessment ────────────────────────── */}
        <FormSection title="Overall NOCLAR Assessment" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Has the entity demonstrated adequate awareness of applicable laws?"
            type="yes_no_na"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q1')}
            {...evidenceField('S4_Q1')}
          />
          <QuestionField
            questionRef="S4_Q2"
            questionNo="4.2"
            questionText="Are there any known or suspected non-compliance issues?"
            type="yes_no_na"
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S4_Q2')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            guidance="A Yes answer triggers a High severity NOCLAR risk."
            {...field('S4_Q2')}
            {...evidenceField('S4_Q2')}
          />
          <QuestionField
            questionRef="S4_Q3"
            questionNo="4.3"
            questionText="Describe any identified or suspected non-compliance matters"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q3')}
            {...evidenceField('S4_Q3')}
          />
          <QuestionField
            questionRef="S4_Q4"
            questionNo="4.4"
            questionText="Overall NOCLAR risk assessment"
            type="select"
            options={['Low', 'Medium', 'High']}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            risks={risksFor('S4_Q4')}
            onGenerateFinding={(risk) => setFindingModalRisk(risk)}
            {...field('S4_Q4')}
            {...evidenceField('S4_Q4')}
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
