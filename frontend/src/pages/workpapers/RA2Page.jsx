import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import FormSection from '../../components/workpaper/FormSection'
import QuestionField from '../../components/workpaper/QuestionField'

// ─── Constants ────────────────────────────────────────────────────────────────
const ASSERTION_OPTIONS = [
  'Existence',
  'Completeness',
  'Rights & Obligations',
  'Valuation',
  'Presentation & Disclosure',
  'Cut-off',
  'Accuracy',
  'Authorization',
  'Occurrence',
]

const PROCEDURE_TYPE_OPTIONS = [
  'Substantive Test of Detail',
  'Analytical Procedure',
  'Test of Controls',
  'Combined',
]

const EXPECTED_CONCLUSION_OPTIONS = [
  'No misstatement expected',
  'Immaterial misstatement',
  'Material misstatement',
]

const FS_SECTION_OPTIONS = [
  'Statement of Financial Position - Assets',
  'Statement of Financial Position - Liabilities',
  'Statement of Financial Position - Equity',
  'Statement of Comprehensive Income - Revenue',
  'Statement of Comprehensive Income - Expenditure',
  'Statement of Cash Flows',
  'Notes and Disclosures',
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

// ─── Multi-select assertions pill selector ────────────────────────────────────
function AssertionSelector({ value = [], onChange, readOnly }) {
  const toggle = (assertion) => {
    if (readOnly) return
    const current = Array.isArray(value) ? value : []
    const updated = current.includes(assertion)
      ? current.filter((a) => a !== assertion)
      : [...current, assertion]
    onChange(updated)
  }

  return (
    <div className="flex flex-wrap gap-1 min-w-[200px]">
      {ASSERTION_OPTIONS.map((a) => {
        const selected = Array.isArray(value) && value.includes(a)
        return (
          <button
            key={a}
            type="button"
            onClick={() => toggle(a)}
            disabled={readOnly}
            className={[
              'px-2 py-0.5 rounded-full text-xs border transition-all',
              selected
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f] font-medium'
                : 'border-gray-300 text-gray-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f]',
              readOnly ? 'cursor-default' : 'cursor-pointer',
            ].join(' ')}
          >
            {a}
          </button>
        )
      })}
    </div>
  )
}

// ─── Required fields check ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['S4_Q1', 'S4_Q2', 'S4_Q3']

function checkCanSubmit(formData) {
  return REQUIRED_FIELDS.every((key) => {
    const val = formData[key]
    return val !== undefined && val !== null && val !== ''
  })
}

// ─── Main RA2 Page ────────────────────────────────────────────────────────────
export default function RA2Page() {
  const { engagementId } = useParams()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [newCotabd, setNewCotabd] = useState({ cotabd: '', fs_section: '', significant: '', why_significant: '', audit_focus: '' })
  const [showAddCotabd, setShowAddCotabd] = useState(false)

  // ── Load engagement ───────────────────────────────────────────────────────
  const { data: engagement } = useQuery({
    queryKey: ['engagement', engagementId],
    queryFn: async () => {
      const res = await api.get(`engagements/${engagementId}/`)
      return res.data
    },
    enabled: !!engagementId,
  })

  // ── Load COTABD-specific risks ────────────────────────────────────────────
  const {
    data: cotabdRisks = [],
    isLoading: cotabdRisksLoading,
  } = useQuery({
    queryKey: ['risks-cotabd', engagementId],
    queryFn: async () => {
      const res = await api.get(`risks/?engagement=${engagementId}&is_cotabd_specific=true`)
      return Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
    },
    enabled: !!engagementId,
  })

  // ── Load pervasive risks (for context) ───────────────────────────────────
  const { data: pervasiveRisks = [] } = useQuery({
    queryKey: ['risks-pervasive', engagementId],
    queryFn: async () => {
      const res = await api.get(`risks/?engagement=${engagementId}&is_pervasive=true`)
      return Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
    },
    enabled: !!engagementId,
  })

  // ── Load UE8 for significant COTABDs pre-population ───────────────────────
  const { data: ue8Workpaper } = useQuery({
    queryKey: ['workpaper-ue8', engagementId],
    queryFn: async () => {
      const res = await api.get(`workpapers/?engagement=${engagementId}`)
      const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
      return list.find((wp) => (wp.document_type || '').toUpperCase() === 'UE8') || null
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
  } = useWorkpaper(engagementId, 'RA2')

  const canSubmitForm = checkCanSubmit(formData)
  const readOnly = ['submitted', 'tl_approved', 'locked'].includes(workpaper?.status)

  // ── Derive significant COTABDs from UE8 if not yet set ───────────────────
  const ue8LeadSchedule = useMemo(() => {
    const rows = ue8Workpaper?.form_data?.S2_Q1 || []
    return Array.isArray(rows) ? rows : []
  }, [ue8Workpaper])

  const significantCotabds = useMemo(() => {
    if (formData.significant_cotabds && formData.significant_cotabds.length > 0) {
      return formData.significant_cotabds
    }
    // Auto-derive from UE8 lead schedule
    return ue8LeadSchedule
      .filter((row) => row.significant === 'Yes')
      .map((row) => ({
        cotabd: row.cotabd || '',
        fs_section: row.fs_section || '',
        significant: 'Yes',
        why_significant: row.notes || '',
        audit_focus: '',
      }))
  }, [formData.significant_cotabds, ue8LeadSchedule])

  // ── State helpers ─────────────────────────────────────────────────────────
  const cotabdResponses = formData.cotabd_responses || {}
  const cotabdConclusions = formData.cotabd_conclusions || {}

  const field = (key) => ({
    value: formData[key] ?? '',
    onChange: (val) => updateField(key, val),
  })

  const evidenceField = (key) => ({
    evidence: formData[`${key}_evidence`] || {},
    onEvidenceChange: (ev) => updateField(`${key}_evidence`, ev),
  })

  const updateCotabdResponse = (riskNo, updates) => {
    updateField('cotabd_responses', {
      ...cotabdResponses,
      [riskNo]: { ...(cotabdResponses[riskNo] || {}), ...updates },
    })
  }

  const updateCotabdConclusion = (riskNo, updates) => {
    updateField('cotabd_conclusions', {
      ...cotabdConclusions,
      [riskNo]: { ...(cotabdConclusions[riskNo] || {}), ...updates },
    })
  }

  const updateSignificantCotabd = (index, updates) => {
    const updated = significantCotabds.map((row, i) => (i === index ? { ...row, ...updates } : row))
    updateField('significant_cotabds', updated)
  }

  const addSignificantCotabd = () => {
    if (!newCotabd.cotabd.trim()) return
    updateField('significant_cotabds', [...significantCotabds, { ...newCotabd }])
    setNewCotabd({ cotabd: '', fs_section: '', significant: '', why_significant: '', audit_focus: '' })
    setShowAddCotabd(false)
  }

  const removeSignificantCotabd = (index) => {
    updateField('significant_cotabds', significantCotabds.filter((_, i) => i !== index))
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

  // ── Risks that have responses (for conclusions table) ─────────────────────
  const risksWithResponses = cotabdRisks.filter((r) => {
    const key = r.risk_no || r.id
    const resp = cotabdResponses[key]
    return resp && (resp.assertions?.length || resp.procedure_type || resp.sample_size)
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    )
  }

  return (
    <WorkpaperLayout
      engagement={engagement ? { ...engagement, assignments: [] } : { id: engagementId, assignments: [] }}
      documentType="RA2"
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
        <h2 className="text-lg font-bold text-[#1e3a5f]">RA-2 — COTABD-Level (Balance/Assertion) Risk Assessment</h2>
        <p className="text-sm text-gray-500 mt-1">
          Document responses to COTABD-specific risks and determine planned procedures at the assertion level, per ISSAI 2315.
          Fields marked <span className="text-red-500 font-bold">*</span> are required before submission.
        </p>
      </div>

      {/* Context: pervasive risks count */}
      {pervasiveRisks.length > 0 && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <span className="font-semibold">{pervasiveRisks.length}</span> pervasive risk{pervasiveRisks.length !== 1 ? 's' : ''} identified at FS level (RA-1) — consider their impact on COTABD-level procedures below.
        </div>
      )}

      {/* ── SECTION 1: COTABD Risk Register ───────────────────────────── */}
      <FormSection title="COTABD Risk Register" sectionCode="SEC1" sectionNumber={1}>
        {cotabdRisksLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#1e3a5f] border-t-transparent" />
            Loading COTABD risks from register...
          </div>
        ) : cotabdRisks.length === 0 ? (
          <div className="py-6 px-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            No COTABD risks have been triggered yet. Complete the UE workpapers first.
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 -mt-2 mb-3">
              Showing <span className="font-semibold text-[#1e3a5f]">{cotabdRisks.length}</span> COTABD-specific risk{cotabdRisks.length !== 1 ? 's' : ''} from the risk register.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-max w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white text-xs">
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Risk Ref</th>
                    <th className="px-3 py-2 text-left font-semibold">Risk Description</th>
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Source</th>
                    <th className="px-3 py-2 text-left font-semibold">Severity</th>
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">COTABD Affected</th>
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Assertion(s) Affected</th>
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Planned Procedure Type</th>
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Planned Sample Size</th>
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">WP Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {cotabdRisks.map((risk) => {
                    const key = risk.risk_no || risk.id
                    const resp = cotabdResponses[key] || {}
                    return (
                      <tr key={key} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                        <td className="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">{key}</td>
                        <td className="px-3 py-2 text-sm text-gray-800 min-w-[180px]">{risk.risk_description}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{risk.source_document || '—'}</td>
                        <td className="px-3 py-2">
                          <SeverityBadge severity={risk.severity} />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={resp.cotabd || risk.cotabd || ''}
                            onChange={(e) => updateCotabdResponse(key, { cotabd: e.target.value })}
                            readOnly={readOnly}
                            placeholder="COTABD..."
                            className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[120px] disabled:bg-gray-50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <AssertionSelector
                            value={resp.assertions || []}
                            onChange={(val) => updateCotabdResponse(key, { assertions: val })}
                            readOnly={readOnly}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={resp.procedure_type || ''}
                            onChange={(e) => updateCotabdResponse(key, { procedure_type: e.target.value })}
                            disabled={readOnly}
                            className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[160px] disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            <option value="">— Select —</option>
                            {PROCEDURE_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={resp.sample_size || ''}
                            onChange={(e) => updateCotabdResponse(key, { sample_size: e.target.value })}
                            readOnly={readOnly}
                            placeholder="n"
                            min={0}
                            className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[70px] disabled:bg-gray-50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={resp.wp_ref || ''}
                            onChange={(e) => updateCotabdResponse(key, { wp_ref: e.target.value })}
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
          </>
        )}
      </FormSection>

      {/* ── SECTION 2: Significant COTABD Identification ──────────────── */}
      <FormSection title="Significant COTABD Identification" sectionCode="SEC2" sectionNumber={2}>
        <p className="text-xs text-gray-500 -mt-2 mb-3">
          List all significant COTABDs for detailed audit focus.
          {ue8LeadSchedule.length > 0
            ? ' Pre-populated from UE8 Lead Schedule (significant items only) — adjust as needed.'
            : ' Enter manually or complete UE8 Lead Schedule first to auto-populate.'}
        </p>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-max w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1e3a5f] text-white text-xs">
                <th className="px-3 py-2 text-left font-semibold">COTABD</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">FS Section</th>
                <th className="px-3 py-2 text-left font-semibold">Significant?</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Why Significant</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Audit Focus</th>
                {!readOnly && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {significantCotabds.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 5 : 6} className="px-4 py-6 text-center text-sm text-gray-400 italic">
                    No significant COTABDs identified yet.
                  </td>
                </tr>
              ) : (
                significantCotabds.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.cotabd || ''}
                        onChange={(e) => updateSignificantCotabd(index, { cotabd: e.target.value })}
                        readOnly={readOnly}
                        className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[140px] disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.fs_section || ''}
                        onChange={(e) => updateSignificantCotabd(index, { fs_section: e.target.value })}
                        disabled={readOnly}
                        className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[180px] disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">— Select —</option>
                        {FS_SECTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.significant || ''}
                        onChange={(e) => updateSignificantCotabd(index, { significant: e.target.value })}
                        disabled={readOnly}
                        className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[90px] disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">—</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={row.why_significant || ''}
                        onChange={(e) => updateSignificantCotabd(index, { why_significant: e.target.value })}
                        readOnly={readOnly}
                        rows={2}
                        placeholder="Reason..."
                        className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[160px] resize-none disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={row.audit_focus || ''}
                        onChange={(e) => updateSignificantCotabd(index, { audit_focus: e.target.value })}
                        readOnly={readOnly}
                        rows={2}
                        placeholder="Audit focus..."
                        className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[160px] resize-none disabled:bg-gray-50"
                      />
                    </td>
                    {!readOnly && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeSignificantCotabd(index)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}

              {/* Add new row inline */}
              {!readOnly && showAddCotabd && (
                <tr className="border-b border-gray-100 bg-blue-50 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={newCotabd.cotabd}
                      onChange={(e) => setNewCotabd((p) => ({ ...p, cotabd: e.target.value }))}
                      placeholder="COTABD name..."
                      className="text-sm py-1 px-2 border border-[#1e3a5f] rounded-md outline-none w-full min-w-[140px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={newCotabd.fs_section}
                      onChange={(e) => setNewCotabd((p) => ({ ...p, fs_section: e.target.value }))}
                      className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[180px]"
                    >
                      <option value="">— Select —</option>
                      {FS_SECTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={newCotabd.significant}
                      onChange={(e) => setNewCotabd((p) => ({ ...p, significant: e.target.value }))}
                      className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[90px]"
                    >
                      <option value="">—</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={newCotabd.why_significant}
                      onChange={(e) => setNewCotabd((p) => ({ ...p, why_significant: e.target.value }))}
                      rows={2}
                      placeholder="Reason..."
                      className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[160px] resize-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={newCotabd.audit_focus}
                      onChange={(e) => setNewCotabd((p) => ({ ...p, audit_focus: e.target.value }))}
                      rows={2}
                      placeholder="Audit focus..."
                      className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] w-full min-w-[160px] resize-none"
                    />
                  </td>
                  <td className="px-3 py-2 space-y-1">
                    <button
                      type="button"
                      onClick={addSignificantCotabd}
                      className="block text-xs font-medium text-white bg-[#1e3a5f] px-2 py-1 rounded-md hover:bg-[#284580]"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddCotabd(false); setNewCotabd({ cotabd: '', fs_section: '', significant: '', why_significant: '', audit_focus: '' }) }}
                      className="block text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!readOnly && !showAddCotabd && (
          <button
            type="button"
            onClick={() => setShowAddCotabd(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1e3a5f] border border-[#1e3a5f] rounded-lg hover:bg-[#1e3a5f] hover:text-white transition-colors"
          >
            + Add COTABD
          </button>
        )}
      </FormSection>

      {/* ── SECTION 3: COTABD Conclusions ─────────────────────────────── */}
      <FormSection title="COTABD Conclusions" sectionCode="SEC3" sectionNumber={3}>
        <p className="text-xs text-gray-500 -mt-2 mb-3">
          For each COTABD with a planned procedure, document the expected conclusion.
        </p>

        {risksWithResponses.length === 0 ? (
          <div className="py-4 px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 italic">
            No COTABD risks with planned procedures yet — complete Section 1 above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-max w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1e3a5f] text-white text-xs">
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Risk Ref</th>
                  <th className="px-3 py-2 text-left font-semibold">COTABD</th>
                  <th className="px-3 py-2 text-left font-semibold">Risk Description</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Planned Procedures</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Expected Conclusion</th>
                </tr>
              </thead>
              <tbody>
                {risksWithResponses.map((risk) => {
                  const key = risk.risk_no || risk.id
                  const resp = cotabdResponses[key] || {}
                  const conc = cotabdConclusions[key] || {}
                  return (
                    <tr key={key} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">{key}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 min-w-[120px]">{resp.cotabd || risk.cotabd || '—'}</td>
                      <td className="px-3 py-2 text-sm text-gray-800 min-w-[180px]">{risk.risk_description}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 min-w-[140px]">
                        {resp.procedure_type || '—'}
                        {resp.sample_size ? ` (n=${resp.sample_size})` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={conc.expected_conclusion || ''}
                          onChange={(e) => updateCotabdConclusion(key, { expected_conclusion: e.target.value })}
                          disabled={readOnly}
                          className="text-sm py-1 px-2 border border-gray-300 rounded-md outline-none focus:border-[#1e3a5f] bg-white w-full min-w-[200px] disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">— Select —</option>
                          {EXPECTED_CONCLUSION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      {/* ── SECTION 4: Overall Risk Assessment Conclusion ─────────────── */}
      <FormSection title="Overall Risk Assessment Conclusion" sectionCode="SEC4" sectionNumber={4}>
        <QuestionField
          questionRef="S4_Q1"
          questionNo="4.1"
          questionText="Are there any significant risks identified at COTABD level?"
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
          questionText="Overall COTABD risk assessment"
          type="select"
          options={['Low', 'Medium', 'High']}
          isRequired
          readOnly={readOnly}
          engagementId={engagementId}
          {...field('S4_Q2')}
          {...evidenceField('S4_Q2')}
        />
        <QuestionField
          questionRef="S4_Q3"
          questionNo="4.3"
          questionText="Overall conclusion on COTABD-level risks and planned procedures"
          type="text"
          isRequired
          readOnly={readOnly}
          engagementId={engagementId}
          {...field('S4_Q3')}
          {...evidenceField('S4_Q3')}
        />
      </FormSection>
    </WorkpaperLayout>
  )
}
