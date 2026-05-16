import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileText, AlertTriangle, X, Plus, ChevronDown } from 'lucide-react'
import api from '../../lib/api'
import { Button } from '../../components/ui/index'
import useRisks from '../../hooks/useRisks'
import useFindings from '../../hooks/useFindings'
import GenerateFindingModal from '../../components/risks/GenerateFindingModal'
import DismissRiskModal from '../../components/risks/DismissRiskModal'
import DismissedFindingModal from '../../components/risks/DismissedFindingModal'

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  high_pervasive: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', dot: '#991b1b', label: 'HIGH-PERVASIVE', emoji: '🔴' },
  high: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', dot: '#dc2626', label: 'HIGH', emoji: '🔴' },
  medium: { bg: '#fffbeb', text: '#d97706', border: '#fcd34d', dot: '#d97706', label: 'MEDIUM', emoji: '🟡' },
  low: { bg: '#f0fdf4', text: '#16a34a', border: '#86efac', dot: '#16a34a', label: 'LOW', emoji: '🟢' },
}

function normSev(sev) {
  return (sev || '').toLowerCase().replace(/[-\s]/g, '_')
}

function getSevConfig(sev) {
  return SEVERITY_CONFIG[normSev(sev)] || SEVERITY_CONFIG.low
}

function SeverityBadge({ severity, size = 'sm' }) {
  const c = getSevConfig(severity)
  const cls = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
  return (
    <span className={`inline-flex items-center font-bold rounded border ${cls}`}
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      {c.label}
    </span>
  )
}

// ─── Finding status helpers ──────────────────────────────────────────────────

const FINDING_STATUS_CONFIG = {
  draft: { bg: '#f3f4f6', text: '#6b7280', label: 'Draft' },
  submitted: { bg: '#eff6ff', text: '#2563eb', label: 'Submitted' },
  reviewed: { bg: '#f5f3ff', text: '#7c3aed', label: 'Reviewed' },
  finalized: { bg: '#f0fdf4', text: '#16a34a', label: 'Finalized' },
  dismissed: { bg: '#f3f4f6', text: '#9ca3af', label: 'Dismissed' },
}

function FindingStatusBadge({ status }) {
  const c = FINDING_STATUS_CONFIG[status] || FINDING_STATUS_CONFIG.draft
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  )
}

// ─── Risk List Item ──────────────────────────────────────────────────────────

function RiskListItem({ risk, isSelected, onClick }) {
  const isDismissed = risk.status === 'dismissed'
  const c = getSevConfig(risk.severity)

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-gray-100 transition-all focus:outline-none',
        isSelected
          ? 'bg-blue-50 border-l-4 border-l-[#1e3a5f]'
          : 'hover:bg-gray-50 border-l-4 border-l-transparent',
        isDismissed ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SeverityBadge severity={risk.severity} size="xs" />
          <span className="text-xs font-mono font-semibold text-gray-500">
            {risk.risk_no || risk.risk_ref}
          </span>
          {risk.is_pervasive && (
            <span className="px-1.5 py-0.5 text-xs font-semibold bg-[#991b1b]/10 text-[#991b1b] rounded border border-[#991b1b]/30">
              Pervasive
            </span>
          )}
        </div>
        {isDismissed && (
          <span className="text-xs text-gray-400 italic">Dismissed</span>
        )}
      </div>

      <p className={['text-sm text-gray-800 font-medium leading-snug mb-1', isDismissed ? 'line-through text-gray-400' : ''].join(' ')}>
        {risk.risk_description}
      </p>

      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
        <span>Source: {risk.source_document}</span>
        {risk.trigger_question && <span>· {risk.trigger_question}</span>}
      </div>

      {risk.finding ? (
        <div className="flex items-center gap-1.5 text-xs">
          <FileText className="w-3 h-3 text-blue-500" />
          <span className="text-blue-600 font-medium">
            Finding {risk.finding?.finding_ref || `#${risk.finding?.id || risk.finding}`} linked
          </span>
        </div>
      ) : !isDismissed ? (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
          <span>No finding</span>
          <span className="ml-1 text-[#1e3a5f] font-medium">+ Generate Finding</span>
        </div>
      ) : null}
    </button>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function RiskSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-b border-gray-100 animate-pulse">
          <div className="flex gap-2 mb-2">
            <div className="h-5 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ─── Finding Detail Form ─────────────────────────────────────────────────────

function FindingDetailForm({ finding, engagementId, risks, onUpdate, onDismiss, onUnlinkRisk }) {
  const [form, setForm] = useState({
    title: finding?.title || '',
    criteria: finding?.criteria || '',
    finding_body: finding?.finding_body || '',
    cause: finding?.cause || '',
    implication: finding?.implication || '',
    recommendation: finding?.recommendation || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    setForm({
      title: finding?.title || '',
      criteria: finding?.criteria || '',
      finding_body: finding?.finding_body || '',
      cause: finding?.cause || '',
      implication: finding?.implication || '',
      recommendation: finding?.recommendation || '',
    })
  }, [finding?.id])

  const isDraft = finding?.status === 'draft'
  const isDismissed = finding?.status === 'dismissed'

  const saveNow = async (updatedForm) => {
    if (!isDraft) return
    setSaving(true)
    setError('')
    try {
      const updated = await onUpdate(finding.id, updatedForm)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return updated
    } catch (err) {
      setError('Auto-save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field) => (e) => {
    const val = e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
    if (!isDraft) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveNow({ ...form, [field]: val })
    }, 2000)
  }

  const handleBlur = () => {
    if (!isDraft) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    saveNow(form)
  }

  const handleManualSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    saveNow(form)
  }

  const linkedRisks = Array.isArray(finding?.linked_risks) ? finding.linked_risks
    : Array.isArray(finding?.risks) ? finding.risks : []

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-gray-500">
              {finding.finding_ref || `Finding #${finding.id}`}
            </span>
            <FindingStatusBadge status={finding.status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Created by {finding.created_by_name || finding.created_by || '—'}
            {finding.created_at && ` · ${new Date(finding.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        {isDraft && !isDismissed && (
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-600">Saved</span>}
            {saving && <span className="text-xs text-gray-400">Saving...</span>}
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>
        )}
      </div>

      {/* Form fields */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={handleChange('title')}
            onBlur={handleBlur}
            readOnly={!isDraft}
            className={[
              'w-full px-3 py-2 text-sm border rounded-lg transition-colors',
              isDraft
                ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
                : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
              isDismissed ? 'line-through text-gray-400' : '',
            ].join(' ')}
          />
        </div>

        {/* Criteria */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Criteria</label>
          <textarea
            value={form.criteria}
            onChange={handleChange('criteria')}
            onBlur={handleBlur}
            readOnly={!isDraft}
            rows={2}
            className={[
              'w-full px-3 py-2 text-sm border rounded-lg resize-none',
              isDraft
                ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
                : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
            ].join(' ')}
          />
        </div>

        {/* Finding Body */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Finding Body</label>
          <textarea
            value={form.finding_body}
            onChange={handleChange('finding_body')}
            onBlur={handleBlur}
            readOnly={!isDraft}
            rows={4}
            placeholder={isDraft ? 'Describe the condition/situation found...' : ''}
            className={[
              'w-full px-3 py-2 text-sm border rounded-lg resize-none',
              isDraft
                ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
                : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
            ].join(' ')}
          />
        </div>

        {/* Cause / Implication */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cause</label>
            <textarea
              value={form.cause}
              onChange={handleChange('cause')}
              onBlur={handleBlur}
              readOnly={!isDraft}
              rows={2}
              className={[
                'w-full px-3 py-2 text-sm border rounded-lg resize-none',
                isDraft
                  ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
                  : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
              ].join(' ')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Implication</label>
            <textarea
              value={form.implication}
              onChange={handleChange('implication')}
              onBlur={handleBlur}
              readOnly={!isDraft}
              rows={2}
              className={[
                'w-full px-3 py-2 text-sm border rounded-lg resize-none',
                isDraft
                  ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
                  : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
              ].join(' ')}
            />
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Recommendation</label>
          <textarea
            value={form.recommendation}
            onChange={handleChange('recommendation')}
            onBlur={handleBlur}
            readOnly={!isDraft}
            rows={2}
            className={[
              'w-full px-3 py-2 text-sm border rounded-lg resize-none',
              isDraft
                ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
                : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
            ].join(' ')}
          />
        </div>

        {/* Linked Risks */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Risks</label>
          <div className="flex flex-wrap gap-1.5">
            {linkedRisks.map((r) => {
              const riskId = typeof r === 'object' ? r.id : r
              const riskRef = typeof r === 'object' ? (r.risk_no || r.risk_ref || `RISK-${r.id}`) : `RISK-${r}`
              return (
                <span key={riskId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e8edf4] text-[#1e3a5f] text-xs font-semibold rounded-full border border-[#1e3a5f]/20">
                  {riskRef}
                  {isDraft && (
                    <button
                      onClick={() => onUnlinkRisk(finding.id, riskId)}
                      className="hover:text-red-500 transition-colors"
                      title="Unlink risk"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )
            })}
            {linkedRisks.length === 0 && (
              <span className="text-xs text-gray-400">No risks linked</span>
            )}
            {isDraft && (
              <button
                onClick={() => setShowLinkModal(true)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs text-[#1e3a5f] border border-dashed border-[#1e3a5f]/40 rounded-full hover:bg-[#e8edf4] transition-colors"
              >
                <Plus className="w-3 h-3" />
                Link Risk
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {isDraft && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onDismiss}
            className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
          >
            Dismiss Finding
          </button>
          <Button onClick={handleManualSave} loading={saving}>
            Save Finding
          </Button>
        </div>
      )}

      {/* Link risk modal */}
      {showLinkModal && (
        <LinkRiskModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          engagementId={engagementId}
          linkedRiskIds={linkedRisks.map((r) => (typeof r === 'object' ? r.id : r))}
          onLink={async (riskId) => {
            await onUpdate(finding.id, { link_risk: riskId })
            setShowLinkModal(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Link Risk Modal (inline) ────────────────────────────────────────────────

function LinkRiskModal({ isOpen, onClose, engagementId, linkedRiskIds, onLink }) {
  const [risks, setRisks] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    api.get(`risks/?engagement=${engagementId}&status=active`)
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : res.data.results ?? []
        setRisks(all.filter((r) => !linkedRiskIds.includes(r.id)))
      })
      .finally(() => setLoading(false))
  }, [isOpen, engagementId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[#1e3a5f]">Link Another Risk</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading risks...</p>
          ) : risks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No unlinked risks available.</p>
          ) : (
            <div className="space-y-1">
              {risks.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onLink(r.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <SeverityBadge severity={r.severity} size="xs" />
                    <span className="text-xs font-mono text-gray-500">{r.risk_no || r.risk_ref}</span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2">{r.risk_description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Risk Detail Card ────────────────────────────────────────────────────────

function RiskDetailCard({ risk, onGenerateFinding, onDismiss }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={risk.severity} />
            <span className="text-sm font-mono font-bold text-gray-600">{risk.risk_no || risk.risk_ref}</span>
            {risk.is_pervasive && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[#991b1b]/10 text-[#991b1b] rounded-full border border-[#991b1b]/30">
                Pervasive
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">Source: {risk.source_document}</p>
        </div>
      </div>

      {/* Description */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 text-xs">Risk Description</p>
        <p className="text-sm text-gray-800 leading-relaxed">{risk.risk_description}</p>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        {risk.trigger_question && (
          <div className="col-span-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Trigger Question</p>
            <p className="text-sm text-gray-700">{risk.trigger_question}</p>
          </div>
        )}
        {risk.trigger_answer && (
          <div className="col-span-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Trigger Answer</p>
            <p className="text-sm text-gray-700">{risk.trigger_answer}</p>
          </div>
        )}
        {risk.assertions && (
          <div className="col-span-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Assertions</p>
            <p className="text-sm text-gray-700">{Array.isArray(risk.assertions) ? risk.assertions.join(', ') : risk.assertions}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={onGenerateFinding} className="flex-1">
          <Plus className="w-4 h-4" />
          Generate Finding +
        </Button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Dismiss Risk
        </button>
      </div>
    </div>
  )
}

// ─── Main RiskRegisterPage ───────────────────────────────────────────────────

const SOURCE_DOCS = ['All', 'UE1', 'UE2', 'UE3', 'UE4', 'UE5', 'UE6', 'UE6_1', 'UE6_2', 'UE7', 'UE8']

export default function RiskRegisterPage() {
  const { id: engagementId } = useParams()
  const navigate = useNavigate()

  const { risks, summary, isLoading, loadRisks, loadSummary, dismissRisk } = useRisks()
  const { findings, loadFindings, updateFinding, dismissFinding, linkRisk, unlinkRisk } = useFindings()

  const [engagement, setEngagement] = useState(null)
  const [selectedRiskId, setSelectedRiskId] = useState(null)
  const [filterSeverity, setFilterSeverity] = useState('All')
  const [filterStatus, setFilterStatus] = useState('Active')
  const [filterSource, setFilterSource] = useState('All')

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showDismissRiskModal, setShowDismissRiskModal] = useState(false)
  const [showDismissFindingModal, setShowDismissFindingModal] = useState(false)

  useEffect(() => {
    loadRisks(engagementId)
    loadSummary(engagementId)
    loadFindings(engagementId)
    api.get(`engagements/${engagementId}/`).then((r) => setEngagement(r.data)).catch(() => {})
  }, [engagementId])

  // Build a lookup: riskId → finding
  const findingByRiskId = {}
  findings.forEach((f) => {
    const linkedRisks = Array.isArray(f.linked_risks) ? f.linked_risks : Array.isArray(f.risks) ? f.risks : []
    linkedRisks.forEach((r) => {
      const rId = typeof r === 'object' ? r.id : r
      findingByRiskId[rId] = f
    })
    // Also check initial_risk / risk field
    if (f.risk) findingByRiskId[typeof f.risk === 'object' ? f.risk.id : f.risk] = f
  })

  // Enrich risks with finding info
  const enrichedRisks = risks.map((r) => ({
    ...r,
    finding: findingByRiskId[r.id] || r.finding || null,
  }))

  // Filters
  const filteredRisks = enrichedRisks.filter((r) => {
    const sev = normSev(r.severity)
    if (filterSeverity !== 'All') {
      const fs = normSev(filterSeverity)
      if (sev !== fs) return false
    }
    if (filterStatus !== 'All') {
      const rStatus = r.status || 'active'
      if (filterStatus === 'Active' && rStatus !== 'active') return false
      if (filterStatus === 'Dismissed' && rStatus !== 'dismissed') return false
    }
    if (filterSource !== 'All') {
      const src = (r.source_document || '').toUpperCase()
      if (!src.includes(filterSource.toUpperCase())) return false
    }
    return true
  })

  const selectedRisk = enrichedRisks.find((r) => r.id === selectedRiskId) || null
  const selectedFinding = selectedRisk?.finding || null

  // Summary counts
  const countsBySev = {
    high_pervasive: enrichedRisks.filter((r) => normSev(r.severity) === 'high_pervasive' && r.status !== 'dismissed').length,
    high: enrichedRisks.filter((r) => normSev(r.severity) === 'high' && r.status !== 'dismissed').length,
    medium: enrichedRisks.filter((r) => normSev(r.severity) === 'medium' && r.status !== 'dismissed').length,
    low: enrichedRisks.filter((r) => normSev(r.severity) === 'low' && r.status !== 'dismissed').length,
  }
  const totalActive = Object.values(countsBySev).reduce((a, b) => a + b, 0)

  const handleGenerateFindingSuccess = (newFinding) => {
    loadFindings(engagementId)
    loadRisks(engagementId)
    setShowGenerateModal(false)
  }

  const handleDismissRisk = async (reason) => {
    await dismissRisk(selectedRiskId, reason)
    loadRisks(engagementId)
    setShowDismissRiskModal(false)
  }

  const handleDismissFinding = async (reason) => {
    await dismissFinding(selectedFinding.id, reason)
    loadFindings(engagementId)
    setShowDismissFindingModal(false)
  }

  const handleUpdateFinding = async (id, data) => {
    const updated = await updateFinding(id, data)
    loadFindings(engagementId)
    return updated
  }

  const handleUnlinkRisk = async (findingId, riskId) => {
    await unlinkRisk(findingId, riskId)
    loadFindings(engagementId)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#f8fafc' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <Link
          to={`/engagements/${engagementId}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1e3a5f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Engagement
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-bold text-[#1e3a5f]">Risk Register</h1>
        {engagement && (
          <span className="text-sm text-gray-500 font-medium">{engagement.engagement_code}</span>
        )}
      </div>

      {/* Split panels */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL */}
        <div className="w-2/5 flex flex-col border-r border-gray-200 bg-white min-w-0">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
            <div className="flex gap-2 flex-wrap">
              {/* Severity filter */}
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 text-gray-600 focus:outline-none focus:border-[#1e3a5f] bg-white"
              >
                {['All', 'High-Pervasive', 'High', 'Medium', 'Low'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 text-gray-600 focus:outline-none focus:border-[#1e3a5f] bg-white"
              >
                {['Active', 'Dismissed', 'All'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {/* Source filter */}
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 text-gray-600 focus:outline-none focus:border-[#1e3a5f] bg-white"
              >
                {SOURCE_DOCS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span style={{ color: '#991b1b' }}>🔴 H-P: {countsBySev.high_pervasive}</span>
              <span style={{ color: '#dc2626' }}>🔴 High: {countsBySev.high}</span>
              <span style={{ color: '#d97706' }}>🟡 Med: {countsBySev.medium}</span>
              <span style={{ color: '#16a34a' }}>🟢 Low: {countsBySev.low}</span>
              <span className="text-gray-400 ml-auto">Total: {totalActive}</span>
            </div>
          </div>

          {/* Risk list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <RiskSkeleton />
            ) : filteredRisks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <AlertTriangle className="w-8 h-8 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">No risks match the current filters.</p>
              </div>
            ) : (
              filteredRisks.map((risk) => (
                <RiskListItem
                  key={risk.id}
                  risk={risk}
                  isSelected={selectedRiskId === risk.id}
                  onClick={() => setSelectedRiskId(risk.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedRisk ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-[#e8edf4] flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-[#1e3a5f]" />
                </div>
                <p className="text-sm text-gray-400 max-w-xs">
                  Select a risk from the left panel to view details
                </p>
              </div>
            ) : selectedFinding ? (
              <FindingDetailForm
                finding={selectedFinding}
                engagementId={engagementId}
                risks={enrichedRisks}
                onUpdate={handleUpdateFinding}
                onDismiss={() => setShowDismissFindingModal(true)}
                onUnlinkRisk={handleUnlinkRisk}
              />
            ) : (
              <RiskDetailCard
                risk={selectedRisk}
                onGenerateFinding={() => setShowGenerateModal(true)}
                onDismiss={() => setShowDismissRiskModal(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <GenerateFindingModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        risk={selectedRisk}
        engagementId={engagementId}
        onSuccess={handleGenerateFindingSuccess}
      />

      <DismissRiskModal
        isOpen={showDismissRiskModal}
        onClose={() => setShowDismissRiskModal(false)}
        risk={selectedRisk}
        onSuccess={handleDismissRisk}
      />

      <DismissedFindingModal
        isOpen={showDismissFindingModal}
        onClose={() => setShowDismissFindingModal(false)}
        finding={selectedFinding}
        onSuccess={handleDismissFinding}
      />
    </div>
  )
}
