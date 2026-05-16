import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, X, ChevronRight, MessageSquare } from 'lucide-react'
import api from '../../lib/api'
import { Button } from '../../components/ui/index'
import useFindings from '../../hooks/useFindings'
import DismissedFindingModal from '../../components/risks/DismissedFindingModal'

// ─── Finding status helpers ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft: { bg: '#f3f4f6', text: '#6b7280', label: 'Draft' },
  submitted: { bg: '#eff6ff', text: '#2563eb', label: 'Submitted' },
  reviewed: { bg: '#f5f3ff', text: '#7c3aed', label: 'Reviewed' },
  finalized: { bg: '#f0fdf4', text: '#16a34a', label: 'Finalized' },
  dismissed: { bg: '#f3f4f6', text: '#9ca3af', label: 'Dismissed' },
}

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  )
}

const STATUS_FILTERS = ['All', 'Draft', 'Submitted', 'Reviewed', 'Finalized', 'Dismissed']

// ─── Slide-over Finding Form ─────────────────────────────────────────────────

function FindingSlideOver({ finding, engagementId, onClose, onUpdate, onDismiss }) {
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

  const saveNow = async (updatedForm) => {
    if (!isDraft) return
    setSaving(true)
    setError('')
    try {
      await onUpdate(finding.id, updatedForm)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Save failed.')
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

  const linkedRisks = Array.isArray(finding?.linked_risks) ? finding.linked_risks
    : Array.isArray(finding?.risks) ? finding.risks : []

  const textareaClass = (draft) => [
    'w-full px-3 py-2 text-sm border rounded-lg resize-none',
    draft
      ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
      : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
  ].join(' ')

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="relative bg-white w-[500px] max-w-full h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1e3a5f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-gray-500">
              {finding?.finding_ref || `Finding #${finding?.id}`}
            </span>
            <StatusBadge status={finding?.status} />
          </div>
        </div>

        {/* Metadata */}
        <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400 flex-shrink-0">
          Created by {finding?.created_by_name || finding?.created_by || '—'}
          {finding?.created_at && ` · ${new Date(finding.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
          {isDraft && (
            <span className="ml-3">
              {saving && <span className="text-gray-400">Saving...</span>}
              {saved && <span className="text-green-600">Saved</span>}
              {error && <span className="text-red-500">{error}</span>}
            </span>
          )}
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
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
                'w-full px-3 py-2 text-sm border rounded-lg',
                isDraft
                  ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]'
                  : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default',
              ].join(' ')}
            />
          </div>

          {/* Criteria */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Criteria</label>
            <textarea value={form.criteria} onChange={handleChange('criteria')} onBlur={handleBlur} readOnly={!isDraft} rows={2} className={textareaClass(isDraft)} />
          </div>

          {/* Finding Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Finding Body</label>
            <textarea value={form.finding_body} onChange={handleChange('finding_body')} onBlur={handleBlur} readOnly={!isDraft} rows={4} className={textareaClass(isDraft)} placeholder={isDraft ? 'Describe the condition/situation found...' : ''} />
          </div>

          {/* Cause / Implication */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cause</label>
              <textarea value={form.cause} onChange={handleChange('cause')} onBlur={handleBlur} readOnly={!isDraft} rows={2} className={textareaClass(isDraft)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Implication</label>
              <textarea value={form.implication} onChange={handleChange('implication')} onBlur={handleBlur} readOnly={!isDraft} rows={2} className={textareaClass(isDraft)} />
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Recommendation</label>
            <textarea value={form.recommendation} onChange={handleChange('recommendation')} onBlur={handleBlur} readOnly={!isDraft} rows={2} className={textareaClass(isDraft)} />
          </div>

          {/* Linked Risks */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Risks</label>
            <div className="flex flex-wrap gap-1.5">
              {linkedRisks.length === 0 ? (
                <span className="text-xs text-gray-400">No risks linked</span>
              ) : (
                linkedRisks.map((r) => {
                  const rRef = typeof r === 'object' ? (r.risk_no || r.risk_ref || `RISK-${r.id}`) : `RISK-${r}`
                  const rId = typeof r === 'object' ? r.id : r
                  return (
                    <span key={rId}
                      className="inline-flex items-center px-2 py-0.5 bg-[#e8edf4] text-[#1e3a5f] text-xs font-semibold rounded-full border border-[#1e3a5f]/20">
                      {rRef}
                    </span>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        {isDraft && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onDismiss}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Dismiss Finding
            </button>
            <Button onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); saveNow(form) }} loading={saving}>
              Save Finding
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main FindingsCollectionPage ─────────────────────────────────────────────

export default function FindingsCollectionPage() {
  const { id: engagementId } = useParams()
  const { findings, isLoading, loadFindings, updateFinding, dismissFinding } = useFindings()
  const [engagement, setEngagement] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [showDismissModal, setShowDismissModal] = useState(false)
  const [dismissTarget, setDismissTarget] = useState(null)

  useEffect(() => {
    loadFindings(engagementId)
    api.get(`engagements/${engagementId}/`).then((r) => setEngagement(r.data)).catch(() => {})
  }, [engagementId])

  // Status counts
  const statusCounts = findings.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1
    return acc
  }, {})

  const filteredFindings = findings.filter((f) => {
    if (filterStatus === 'All') return true
    return f.status === filterStatus.toLowerCase()
  })

  const handleUpdateFinding = async (id, data) => {
    const updated = await updateFinding(id, data)
    loadFindings(engagementId)
    // Update selectedFinding in place
    if (selectedFinding?.id === id) {
      setSelectedFinding((prev) => ({ ...prev, ...updated }))
    }
    return updated
  }

  const handleDismiss = async (reason) => {
    await dismissFinding(dismissTarget.id, reason)
    loadFindings(engagementId)
    setShowDismissModal(false)
    if (selectedFinding?.id === dismissTarget.id) {
      setSelectedFinding(null)
    }
  }

  const openDismiss = (finding, e) => {
    e?.stopPropagation()
    setDismissTarget(finding)
    setShowDismissModal(true)
  }

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to={`/engagements/${engagementId}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1e3a5f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-xl font-bold text-[#1e3a5f]">Findings Collection</h1>
          {engagement && (
            <span className="text-sm text-gray-500 font-medium">{engagement.engagement_code}</span>
          )}
        </div>
        <Button variant="secondary" disabled title="Export to Word — available in Phase 6">
          <Download className="w-4 h-4" />
          Export to Word
        </Button>
      </div>

      {/* Status summary chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_FILTERS.map((s) => {
          const count = s === 'All' ? findings.length : (statusCounts[s.toLowerCase()] || 0)
          const isActive = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                isActive
                  ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]',
              ].join(' ')}
            >
              {s} {count > 0 && <span className="ml-1 opacity-75">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Ref', 'Title', 'Linked Risks', 'Source WPs', 'Status', 'Created By', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-[#e8edf4] flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6 text-[#1e3a5f]" />
                    </div>
                    <p className="text-sm text-gray-400">
                      {filterStatus === 'All'
                        ? 'No findings raised yet. Generate findings from the Risk Register.'
                        : `No ${filterStatus.toLowerCase()} findings.`}
                    </p>
                    {filterStatus === 'All' && (
                      <Link
                        to={`/engagements/${engagementId}/risks`}
                        className="mt-2 text-sm text-[#1e3a5f] hover:underline font-medium"
                      >
                        Go to Risk Register
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredFindings.map((f) => {
                const linkedRisks = Array.isArray(f.linked_risks) ? f.linked_risks
                  : Array.isArray(f.risks) ? f.risks : []
                const sourceDocs = [...new Set(
                  linkedRisks
                    .filter((r) => typeof r === 'object' && r.source_document)
                    .map((r) => r.source_document)
                )]
                const isDismissed = f.status === 'dismissed'

                return (
                  <tr
                    key={f.id}
                    className={['hover:bg-gray-50 transition-colors', isDismissed ? 'opacity-60' : ''].join(' ')}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-gray-600">
                        {f.finding_ref || `#${f.id}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className={['text-sm text-gray-800 font-medium line-clamp-2', isDismissed ? 'line-through text-gray-400' : ''].join(' ')}>
                        {f.title?.length > 60 ? f.title.slice(0, 60) + '…' : f.title || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {linkedRisks.slice(0, 3).map((r) => {
                          const ref = typeof r === 'object' ? (r.risk_no || r.risk_ref || `R${r.id}`) : `R${r}`
                          const rId = typeof r === 'object' ? r.id : r
                          return (
                            <span key={rId}
                              className="px-1.5 py-0.5 bg-[#e8edf4] text-[#1e3a5f] text-xs font-semibold rounded border border-[#1e3a5f]/20">
                              {ref}
                            </span>
                          )
                        })}
                        {linkedRisks.length > 3 && (
                          <span className="px-1.5 py-0.5 text-xs text-gray-400">+{linkedRisks.length - 3}</span>
                        )}
                        {linkedRisks.length === 0 && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {sourceDocs.slice(0, 3).map((d) => (
                          <span key={d} className="text-xs text-gray-500 font-medium">{d}</span>
                        ))}
                        {sourceDocs.length === 0 && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {f.created_by_name || f.created_by || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedFinding(f)}
                        >
                          {f.status === 'draft' ? 'Edit' : 'View'}
                        </Button>
                        {f.status !== 'dismissed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => openDismiss(f, e)}
                            className="text-red-500 hover:bg-red-50"
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over */}
      {selectedFinding && (
        <FindingSlideOver
          finding={selectedFinding}
          engagementId={engagementId}
          onClose={() => setSelectedFinding(null)}
          onUpdate={handleUpdateFinding}
          onDismiss={() => {
            setDismissTarget(selectedFinding)
            setShowDismissModal(true)
          }}
        />
      )}

      {/* Dismiss modal */}
      <DismissedFindingModal
        isOpen={showDismissModal}
        onClose={() => { setShowDismissModal(false); setDismissTarget(null) }}
        finding={dismissTarget}
        onSuccess={handleDismiss}
      />
    </div>
  )
}
