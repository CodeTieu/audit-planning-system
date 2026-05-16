import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'

// ─── Constants ────────────────────────────────────────────────────────────────
const REPORTING_FRAMEWORKS = ['IPSAS Accrual', 'IPSAS Cash', 'IFRS', 'Other']

const INHERENT_RISK_OPTIONS = ['Low', 'Medium', 'High']
const RESPONSE_STRATEGY_OPTIONS = ['Reduce', 'Accept', 'Avoid', 'Transfer']
const PERVASIVE_RISK_RATING_OPTIONS = [
  'Low',
  'Medium',
  'High',
]
const OVERALL_RESPONSE_OPTIONS = [
  'Overall emphasis on professional scepticism',
  'Assign more experienced staff',
  'Incorporate unpredictability',
  'Supervise staff more closely',
  'Other',
]

const LIBRARY_RISKS = [
  { code: 'LIB-P1', title: 'Management integrity and ethical values concern' },
  { code: 'LIB-P2', title: 'Going concern doubt' },
  { code: 'LIB-P3', title: 'Related party complexity' },
  { code: 'LIB-P4', title: 'Complex accounting estimates' },
  { code: 'LIB-P5', title: 'Significant unusual transactions' },
  { code: 'LIB-P6', title: 'IT system dependency risk' },
  { code: 'LIB-P7', title: 'Revenue recognition risk' },
  { code: 'LIB-P8', title: 'Regulatory/compliance pressure' },
]

const MANDATORY_RISKS = [
  { code: 'ISSAI-2240-1', title: 'Risk of Management Override of Controls', standard: 'ISSAI 2240 requirement' },
  { code: 'ISSAI-2240-2', title: 'Risk of Fraudulent Revenue Recognition', standard: 'ISSAI 2240 requirement' },
]

const DOC_CHECKLIST_ITEMS = [
  { key: 'ue_completed',        label: 'Understanding of the entity documented (UE1-UE8 completed)' },
  { key: 'ra_procedures',       label: 'Risk assessment procedures performed and documented' },
  { key: 'risks_linked',        label: 'Identified risks linked to planned procedures' },
  { key: 'issai_2240',          label: 'Mandatory ISSAI 2240 risks addressed' },
  { key: 'materiality_det',     label: 'Overall materiality and performance materiality determined' },
  { key: 'team_discussion',     label: 'Engagement team discussion documented' },
]

// ─── Severity badge ───────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const map = {
    low:    'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high:   'bg-red-100 text-red-700',
  }
  const cls = map[(severity || '').toLowerCase()] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {severity || '—'}
    </span>
  )
}

// ─── Add Risk from Library Modal ──────────────────────────────────────────────
function LibraryModal({ isOpen, onClose, existingCodes, onAdd }) {
  const [selected, setSelected] = useState([])

  if (!isOpen) return null

  const available = LIBRARY_RISKS.filter((r) => !existingCodes.includes(r.code))

  const toggle = (code) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleAdd = () => {
    const toAdd = LIBRARY_RISKS.filter((r) => selected.includes(r.code))
    onAdd(toAdd)
    setSelected([])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-[#1e3a5f]">Add Risk from Library</h3>
          <p className="text-xs text-gray-500 mt-0.5">Select standard pervasive risks to add to this assessment.</p>
        </div>
        <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
          {available.length === 0 && (
            <p className="text-sm text-gray-400 italic">All library risks have already been added.</p>
          )}
          {available.map((risk) => (
            <label key={risk.code} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selected.includes(risk.code)}
                onChange={() => toggle(risk.code)}
                className="mt-0.5 accent-[#1e3a5f]"
              />
              <span className="text-sm text-gray-800 group-hover:text-[#1e3a5f]">{risk.title}</span>
            </label>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selected.length === 0}
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#1e3a5f] rounded-lg hover:bg-[#284580] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add {selected.length > 0 ? `(${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Risk Response Row (shared for live risks, library risks, mandatory risks) ─
function RiskResponseRow({ riskNo, label, source, severity, response, onUpdate, readOnly, showSource = true }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 align-top">
      <td className="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">{riskNo}</td>
      <td className="px-3 py-2 text-sm text-gray-800 min-w-[180px]">{label}</td>
      {showSource && (
        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{source || '—'}</td>
      )}
      <td className="px-3 py-2">
        <SeverityBadge severity={severity} />
      </td>
      <td className="px-3 py-2">
        <select
          value={response?.rating || ''}
          onChange={(e) => onUpdate({ ...response, rating: e.target.value })}
          disabled={readOnly}
          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[90px] disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">—</option>
          {INHERENT_RISK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={response?.strategy || ''}
          onChange={(e) => onUpdate({ ...response, strategy: e.target.value })}
          disabled={readOnly}
          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[100px] disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">—</option>
          {RESPONSE_STRATEGY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <textarea
          value={response?.controls || ''}
          onChange={(e) => onUpdate({ ...response, controls: e.target.value })}
          readOnly={readOnly}
          rows={2}
          placeholder="Key controls..."
          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[140px] resize-none disabled:bg-gray-50 disabled:text-gray-400"
        />
      </td>
      <td className="px-3 py-2">
        <textarea
          value={response?.procedures || ''}
          onChange={(e) => onUpdate({ ...response, procedures: e.target.value })}
          readOnly={readOnly}
          rows={2}
          placeholder="Planned procedures..."
          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[160px] resize-none disabled:bg-gray-50 disabled:text-gray-400"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={response?.wp_ref || ''}
          onChange={(e) => onUpdate({ ...response, wp_ref: e.target.value })}
          readOnly={readOnly}
          placeholder="WP ref"
          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[80px] disabled:bg-gray-50 disabled:text-gray-400"
        />
      </td>
    </tr>
  )
}

// ─── Shared table header ──────────────────────────────────────────────────────
function RiskTableHeader({ showSource = true }) {
  return (
    <thead>
      <tr className="bg-[#1e3a5f] text-white text-xs">
        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Risk Ref</th>
        <th className="px-3 py-2 text-left font-semibold">Risk Description</th>
        {showSource && <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Source</th>}
        <th className="px-3 py-2 text-left font-semibold">Severity</th>
        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Inherent Risk Rating</th>
        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Overall Response Strategy</th>
        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Key Controls to Test</th>
        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Planned Overall Procedures</th>
        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Cross-ref WP</th>
      </tr>
    </thead>
  )
}

// ─── Required fields check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S1_Q1', 'S1_Q2', 'S1_Q3', 'S1_Q4', 'S4_Q1', 'S4_Q2', 'S4_Q3']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main RA1 Page ────────────────────────────────────────────────────────────
export default function RA1Page() {
  const { engagementId } = useParams()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [libraryModalOpen, setLibraryModalOpen] = useState(false)

  // ── Load engagement metadata ──────────────────────────────────────────────
  const { data: engagement } = useQuery({
    queryKey: ['engagement', engagementId],
    queryFn: async () => {
      const res = await api.get(`engagements/${engagementId}/`)
      return res.data
    },
    enabled: !!engagementId,
  })

  // ── Load UE8 workpaper for materiality pre-population ─────────────────────
  const { data: ue8Workpaper } = useQuery({
    queryKey: ['workpaper-ue8', engagementId],
    queryFn: async () => {
      const res = await api.get(`workpapers/?engagement=${engagementId}`)
      const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
      return list.find((wp) => (wp.document_type || '').toUpperCase() === 'UE8') || null
    },
    enabled: !!engagementId,
  })

  // ── Load pervasive risks ──────────────────────────────────────────────────
  const {
    data: pervasiveRisks = [],
    isLoading: risksLoading,
  } = useQuery({
    queryKey: ['risks-pervasive', engagementId],
    queryFn: async () => {
      const res = await api.get(`risks/?engagement=${engagementId}&is_pervasive=true`)
      return Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
    },
    enabled: !!engagementId,
  })

  // ── Workpaper state ───────────────────────────────────────────────────────
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
  } = useWorkpaper(engagementId, 'RA1')

  const canSubmitForm = checkCanSubmit(formData)
  const readOnly = ['submitted', 'tl_approved', 'locked'].includes(workpaper?.status)

  // ── Pre-populate materiality from UE8 ────────────────────────────────────
  const ue8FormData = ue8Workpaper?.form_data || {}

  const field = (key, fallback = '') => {
    // Check for UE8 pre-population for S1 fields
    let defaultVal = fallback
    if (key === 'S1_Q1' && !formData[key]) defaultVal = ue8FormData['S1_Q1'] || ''
    if (key === 'S1_Q2' && !formData[key]) defaultVal = ue8FormData['S1_Q2'] || ''
    if (key === 'S1_Q3' && !formData[key]) defaultVal = ue8FormData['S1_Q3'] || ''
    return {
      value: formData[key] ?? defaultVal,
      onChange: (val) => updateField(key, val),
    }
  }

  const evidenceField = (key) => ({
    evidence: formData[`${key}_evidence`] || {},
    onEvidenceChange: (ev) => updateField(`${key}_evidence`, ev),
  })

  // ── Risk responses state helpers ──────────────────────────────────────────
  const riskResponses = formData.risk_responses || {}
  const libraryRisks = formData.library_risks || []
  const mandatoryRisks = formData.mandatory_risks || {}
  const docChecklist = formData.doc_checklist || {}

  const updateRiskResponse = (riskNo, updates) => {
    updateField('risk_responses', {
      ...riskResponses,
      [riskNo]: { ...(riskResponses[riskNo] || {}), ...updates },
    })
  }

  const updateLibraryRiskResponse = (code, updates) => {
    const updated = libraryRisks.map((r) =>
      r.code === code ? { ...r, ...updates } : r
    )
    updateField('library_risks', updated)
  }

  const updateMandatoryRiskResponse = (code, updates) => {
    updateField('mandatory_risks', {
      ...mandatoryRisks,
      [code]: { ...(mandatoryRisks[code] || {}), ...updates },
    })
  }

  const addLibraryRisks = (risks) => {
    const existing = libraryRisks.map((r) => r.code)
    const newRisks = risks.filter((r) => !existing.includes(r.code))
    updateField('library_risks', [...libraryRisks, ...newRisks])
  }

  const removeLibraryRisk = (code) => {
    updateField('library_risks', libraryRisks.filter((r) => r.code !== code))
  }

  const toggleChecklist = (key) => {
    updateField('doc_checklist', { ...docChecklist, [key]: !docChecklist[key] })
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
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
        documentType="RA1"
        assignment={assignment}
        onSave={handleSave}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        lastSaved={lastSaved}
        canSubmit={canSubmitForm && !readOnly}
      >
        {/* Alerts */}
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
          <h2 className="text-lg font-bold text-[#1e3a5f]">RA-1 — Pervasive (Financial-Statement Level) Risk Assessment</h2>
          <p className="text-sm text-gray-500 mt-1">
            Document responses to pervasive risks identified in the understanding of the entity phase, per ISSAI 2240.
            Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
          </p>
        </div>

        {/* ── SECTION 1: Setup & Engagement Details ─────────────────────── */}
        <FormSection title="Setup & Engagement Details" sectionCode="SEC1" sectionNumber={1}>
          <QuestionField
            questionRef="S1_Q1"
            questionNo="1.1"
            questionText="Overall Materiality (TZS)"
            type="number"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q1')}
            {...evidenceField('S1_Q1')}
          />
          {ue8FormData['S1_Q1'] && !formData['S1_Q1'] && (
            <p className="text-xs text-blue-600 -mt-3 pl-10">
              Pre-populated from UE8 — confirm or adjust.
            </p>
          )}
          <QuestionField
            questionRef="S1_Q2"
            questionNo="1.2"
            questionText="Performance Materiality (TZS)"
            type="number"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q2')}
            {...evidenceField('S1_Q2')}
          />
          <QuestionField
            questionRef="S1_Q3"
            questionNo="1.3"
            questionText="Clearly Trivial Threshold (TZS)"
            type="number"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q3')}
            {...evidenceField('S1_Q3')}
          />
          <QuestionField
            questionRef="S1_Q4"
            questionNo="1.4"
            questionText="Reporting Framework"
            type="select"
            options={REPORTING_FRAMEWORKS}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S1_Q4')}
            {...evidenceField('S1_Q4')}
          />
        </FormSection>

        {/* ── SECTION 2: Pervasive Risk Register ───────────────────────── */}
        <FormSection title="Pervasive Risk Register" sectionCode="SEC2" sectionNumber={2}>
          {risksLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#1e3a5f] border-t-transparent" />
              Loading risks from register...
            </div>
          ) : pervasiveRisks.length === 0 ? (
            <div className="py-6 px-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              No pervasive risks have been triggered yet. Complete the UE workpapers first.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 -mt-2 mb-3">
                Showing <span className="font-semibold text-[#1e3a5f]">{pervasiveRisks.length}</span> pervasive risk{pervasiveRisks.length !== 1 ? 's' : ''} from the risk register.
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-max w-full text-sm border-collapse">
                  <RiskTableHeader />
                  <tbody>
                    {pervasiveRisks.map((risk) => (
                      <RiskResponseRow
                        key={risk.risk_no || risk.id}
                        riskNo={risk.risk_no || risk.id}
                        label={risk.risk_description}
                        source={risk.source_document}
                        severity={risk.severity}
                        response={riskResponses[risk.risk_no || risk.id] || {}}
                        onUpdate={(updates) => updateRiskResponse(risk.risk_no || risk.id, updates)}
                        readOnly={readOnly}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Additional risks note */}
          <p className="text-xs text-gray-400 mt-2 italic">
            Additional risks from the risk library can be added below.
          </p>
        </FormSection>

        {/* ── SECTION 2B: Additional Risks from Library ────────────────── */}
        <FormSection title="Additional Risks from Library" sectionCode="SEC2B" sectionNumber="2B">
          <div className="flex items-center justify-between mb-3">
            {libraryRisks.length > 0 && (
              <p className="text-xs text-gray-500">
                {libraryRisks.length} library risk{libraryRisks.length !== 1 ? 's' : ''} added.
              </p>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setLibraryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1e3a5f] border border-[#1e3a5f] rounded-lg hover:bg-[#1e3a5f] hover:text-white transition-colors"
              >
                + Add Risk from Library
              </button>
            )}
          </div>

          {libraryRisks.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No library risks added yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-max w-full text-sm border-collapse">
                <RiskTableHeader showSource={false} />
                <tbody>
                  {libraryRisks.map((risk) => (
                    <tr key={risk.code} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">{risk.code}</td>
                      <td className="px-3 py-2 text-sm text-gray-800 min-w-[180px]">
                        <div>{risk.title}</div>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removeLibraryRisk(risk.code)}
                            className="text-xs text-red-400 hover:text-red-600 mt-0.5"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          library
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={risk.rating || ''}
                          onChange={(e) => updateLibraryRiskResponse(risk.code, { rating: e.target.value })}
                          disabled={readOnly}
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[90px] disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">—</option>
                          {INHERENT_RISK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={risk.strategy || ''}
                          onChange={(e) => updateLibraryRiskResponse(risk.code, { strategy: e.target.value })}
                          disabled={readOnly}
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[100px] disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">—</option>
                          {RESPONSE_STRATEGY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <textarea
                          value={risk.controls || ''}
                          onChange={(e) => updateLibraryRiskResponse(risk.code, { controls: e.target.value })}
                          readOnly={readOnly}
                          rows={2}
                          placeholder="Key controls..."
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[140px] resize-none disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <textarea
                          value={risk.procedures || ''}
                          onChange={(e) => updateLibraryRiskResponse(risk.code, { procedures: e.target.value })}
                          readOnly={readOnly}
                          rows={2}
                          placeholder="Planned procedures..."
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[160px] resize-none disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={risk.wp_ref || ''}
                          onChange={(e) => updateLibraryRiskResponse(risk.code, { wp_ref: e.target.value })}
                          readOnly={readOnly}
                          placeholder="WP ref"
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[80px] disabled:bg-gray-50"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormSection>

        {/* ── SECTION 3: Mandatory ISSAI 2240 Risks ────────────────────── */}
        <FormSection title="Mandatory ISSAI 2240 Risk Responses" sectionCode="SEC3" sectionNumber={3}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            ISSAI 2240 requires these two risks to always be addressed, regardless of assessed risk level.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-max w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1e3a5f] text-white text-xs">
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Risk Ref</th>
                  <th className="px-3 py-2 text-left font-semibold">Risk Description</th>
                  <th className="px-3 py-2 text-left font-semibold">Standard</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Overall Response Strategy</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Planned Overall Procedures</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Cross-ref WP</th>
                </tr>
              </thead>
              <tbody>
                {MANDATORY_RISKS.map((risk) => {
                  const resp = mandatoryRisks[risk.code] || {}
                  return (
                    <tr key={risk.code} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">{risk.code}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 min-w-[200px]">{risk.title}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
                          {risk.standard}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={resp.strategy || ''}
                          onChange={(e) => updateMandatoryRiskResponse(risk.code, { strategy: e.target.value })}
                          disabled={readOnly}
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[100px] disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">—</option>
                          {RESPONSE_STRATEGY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <textarea
                          value={resp.procedures || ''}
                          onChange={(e) => updateMandatoryRiskResponse(risk.code, { procedures: e.target.value })}
                          readOnly={readOnly}
                          rows={2}
                          placeholder="Planned procedures..."
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[180px] resize-none disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={resp.wp_ref || ''}
                          onChange={(e) => updateMandatoryRiskResponse(risk.code, { wp_ref: e.target.value })}
                          readOnly={readOnly}
                          placeholder="WP ref"
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[80px] disabled:bg-gray-50"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </FormSection>

        {/* ── SECTION 4: Overall Pervasive Risk Conclusion ──────────────── */}
        <FormSection title="Overall Pervasive Risk Conclusion" sectionCode="SEC4" sectionNumber={4}>
          <QuestionField
            questionRef="S4_Q1"
            questionNo="4.1"
            questionText="Overall pervasive (FS-level) risk assessment"
            type="select"
            options={PERVASIVE_RISK_RATING_OPTIONS}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q1')}
            {...evidenceField('S4_Q1')}
          />
          <QuestionField
            questionRef="S4_Q2"
            questionNo="4.2"
            questionText="Planned overall response to pervasive risks"
            type="select"
            options={OVERALL_RESPONSE_OPTIONS}
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q2')}
            {...evidenceField('S4_Q2')}
          />
          <QuestionField
            questionRef="S4_Q3"
            questionNo="4.3"
            questionText="Detailed overall response strategy and conclusion"
            type="text"
            isRequired
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q3')}
            {...evidenceField('S4_Q3')}
          />
          <QuestionField
            questionRef="S4_Q4"
            questionNo="4.4"
            questionText="Any pervasive risk considerations not captured above"
            type="text"
            readOnly={readOnly}
            engagementId={engagementId}
            {...field('S4_Q4')}
            {...evidenceField('S4_Q4')}
          />
        </FormSection>

        {/* ── SECTION 5: Documentation Checklist ───────────────────────── */}
        <FormSection title="Documentation Checklist (ISSAI 2230)" sectionCode="SEC5" sectionNumber={5}>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            Confirm that all required documentation has been completed per ISSAI 2230.
          </p>
          <div className="space-y-3">
            {DOC_CHECKLIST_ITEMS.map(({ key, label }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!docChecklist[key]}
                  onChange={() => !readOnly && toggleChecklist(key)}
                  disabled={readOnly}
                  className="mt-0.5 accent-[#1e3a5f] w-4 h-4 flex-shrink-0"
                />
                <span className={`text-sm ${docChecklist[key] ? 'text-green-700 line-through' : 'text-gray-700'} group-hover:text-[#1e3a5f] transition-colors`}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </FormSection>
      </WorkpaperLayout>

      {/* Add from Library modal */}
      <LibraryModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        existingCodes={libraryRisks.map((r) => r.code)}
        onAdd={addLibraryRisks}
      />
    </>
  )
}
