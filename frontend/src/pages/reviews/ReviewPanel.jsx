import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, CornerDownLeft, MessageSquare, Flag, ChevronDown } from 'lucide-react'
import api from '../../lib/api'
import useAuth, { ROLES } from '../../hooks/useAuth'

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function StatusBadge({ status }) {
  const map = {
    draft: { bg: '#f3f4f6', text: '#6b7280', label: 'Draft' },
    in_progress: { bg: '#e8edf4', text: '#1e3a5f', label: 'In Progress' },
    submitted: { bg: '#fdf8ee', text: '#8d641a', label: 'Submitted' },
    tl_approved: { bg: '#f0fdf4', text: '#166534', label: 'TL Approved' },
    approved: { bg: '#f0fdf4', text: '#166534', label: 'Approved' },
    returned: { bg: '#fef2f2', text: '#991b1b', label: 'Returned' },
    finalized: { bg: '#e8edf4', text: '#0f2240', label: 'Finalized' },
    locked: { bg: '#f3f4f6', text: '#374151', label: 'Locked' },
  }
  const cfg = map[status] || { bg: '#f3f4f6', text: '#6b7280', label: status || 'Unknown' }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  )
}

function RoleBadge({ role }) {
  const labels = { 2: 'Team Leader', 3: 'CEA', 4: 'AAG', 5: 'DAG', 6: 'TSSU', 99: 'Admin' }
  const colors = {
    2: { bg: '#fdf8ee', text: '#8d641a' },
    3: { bg: '#f0fdf4', text: '#166534' },
    4: { bg: '#fef2f2', text: '#991b1b' },
    5: { bg: '#fef2f2', text: '#7f1d1d' },
    6: { bg: '#e8edf4', text: '#0f2240' },
  }
  const c = colors[role] || { bg: '#e8edf4', text: '#1e3a5f' }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.text + '33' }}>
      {labels[role] || 'Reviewer'}
    </span>
  )
}

// ── TL Review View ────────────────────────────────────────────────────────────

function TLReviewView({ engagementId, pkg, onRefresh }) {
  const [docStates, setDocStates] = useState({}) // keyed by doc.document_type (code)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [error, setError] = useState(null)

  const documents = Array.isArray(pkg?.documents) ? pkg.documents : []
  const approvedCount = documents.filter(
    (d) => docStates[d.document_type]?.action === 'approve' || d.assignment_status === 'tl_approved'
  ).length
  const allApproved = documents.length > 0 && approvedCount === documents.length

  function getState(code) {
    return docStates[code] || {}
  }

  async function handleDocAction(code, action) {
    const state = getState(code)
    setDocStates((prev) => ({ ...prev, [code]: { ...state, action, commentOpen: action === 'return' } }))

    if (action === 'approve') {
      try {
        await api.post('reviews/tl-review/', {
          engagement_id: engagementId,
          document_type: code,
          action: 'approve',
          comment: '',
        })
      } catch {
        // ignore — UI is optimistic
      }
    }
  }

  async function handleSendBack(code) {
    const comment = getState(code).comment || ''
    if (!comment.trim()) return
    try {
      await api.post('reviews/tl-review/', {
        engagement_id: engagementId,
        document_type: code,
        action: 'return',
        comment,
      })
      setDocStates((prev) => ({ ...prev, [code]: { ...getState(code), action: 'returned' } }))
    } catch {
      setError('Failed to send document back.')
    }
  }

  async function handleSubmitPackage() {
    setSubmitting(true)
    setError(null)
    try {
      await api.post('reviews/submit-package/', { engagement_id: engagementId })
      setShowSubmitModal(false)
      onRefresh()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit package.')
    } finally {
      setSubmitting(false)
    }
  }

  const engagement = pkg?.engagement || {}

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#1e3a5f]">
                Team Leader Review &mdash; {engagement.engagement_code || `ENG-${engagementId}`}
              </h1>
              <p className="text-xs text-gray-500">Review all documents before submitting package to CEA</p>
            </div>
          </div>
          <button
            disabled={!allApproved || submitting}
            onClick={() => setShowSubmitModal(true)}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: allApproved ? '#1e3a5f' : '#9ca3af' }}
          >
            Submit Package to CEA
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#1e3a5f]">
              {approvedCount} of {documents.length} documents approved
            </span>
            <span className="text-xs text-gray-400">{documents.length > 0 ? Math.round((approvedCount / documents.length) * 100) : 0}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${documents.length > 0 ? (approvedCount / documents.length) * 100 : 0}%`,
                backgroundColor: '#1e3a5f',
              }}
            />
          </div>
        </div>

        {/* Document cards */}
        {documents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
            No documents in this package yet.
          </div>
        ) : (
          documents.map((doc) => {
            const code = doc.document_type
            const state = getState(code)
            const isApproved = state.action === 'approve' || doc.assignment_status === 'tl_approved'
            const isReturned = state.action === 'returned' || doc.assignment_status === 'returned'

            return (
              <div
                key={code}
                className={[
                  'bg-white rounded-xl border-2 p-5 transition-colors',
                  isApproved ? 'border-green-400' : isReturned ? 'border-red-400' : 'border-gray-200',
                ].join(' ')}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{doc.document_name} <span className="text-xs font-mono text-gray-400 ml-1">{code}</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">Auditor: {doc.assigned_to || '—'}</p>
                  </div>
                  <StatusBadge status={isApproved ? 'tl_approved' : isReturned ? 'returned' : doc.assignment_status} />
                  {!isApproved && !isReturned && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDocAction(code, 'approve')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-300 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => setDocStates((prev) => ({
                          ...prev,
                          [code]: { ...state, commentOpen: !state.commentOpen },
                        }))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-300 transition-colors"
                      >
                        <CornerDownLeft className="w-3.5 h-3.5" /> Send Back
                      </button>
                    </div>
                  )}
                  {(isApproved || isReturned) && (
                    <span className="text-xs font-semibold" style={{ color: isApproved ? '#166534' : '#991b1b' }}>
                      {isApproved ? '✓ Approved' : '↩ Returned'}
                    </span>
                  )}
                </div>

                {/* Comment textarea (send back) */}
                {state.commentOpen && !isReturned && (
                  <div className="mt-3 border-t border-red-100 pt-3">
                    <textarea
                      rows={2}
                      className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none"
                      placeholder="Required: explain what needs to be corrected..."
                      value={state.comment || ''}
                      onChange={(e) => setDocStates((prev) => ({
                        ...prev,
                        [code]: { ...state, comment: e.target.value },
                      }))}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => setDocStates((prev) => ({
                          ...prev,
                          [code]: { ...state, commentOpen: false, comment: '' },
                        }))}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSendBack(code)}
                        disabled={!(state.comment || '').trim()}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Confirm Send Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSubmitModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Submit Package to CEA?</h3>
            <p className="text-sm text-gray-600 mb-6">
              All {documents.length} documents have been approved. This will submit the review package to the CEA for the next level of review. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSubmitPackage}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#1e3a5f' }}
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Package'}
              </button>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Senior Reviewer View (CEA / AAG / DAG / TSSU) ────────────────────────────

const REVIEW_LEVELS = { 3: 'CEA', 4: 'AAG', 5: 'DAG', 6: 'TSSU' }
const NEXT_LEVEL = { 3: 'AAG', 4: 'DAG', 5: 'TSSU', 6: 'Final Approval' }

// Numeric role levels matching the backend RoleLevel constants
const RETURN_LEVEL_TEAM_LEADER = 2
const RETURN_LEVEL_AUDITOR     = 1

function SeniorReviewView({ engagementId, pkg, onRefresh, userRole }) {
  const [flagged, setFlagged] = useState({}) // keyed by doc.document_type (code)
  const [generalComment, setGeneralComment] = useState('')
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnTo, setReturnTo] = useState(RETURN_LEVEL_TEAM_LEADER)
  const [returnComment, setReturnComment] = useState('')
  const [actioning, setActioning] = useState(false)
  const [error, setError] = useState(null)

  const documents = Array.isArray(pkg?.documents) ? pkg.documents : []
  const pkgInfo = pkg || {}
  const levelLabel = REVIEW_LEVELS[userRole] || 'Reviewer'
  const nextLabel = NEXT_LEVEL[userRole] || 'Next Level'

  function toggleFlag(code) {
    setFlagged((prev) => ({
      ...prev,
      [code]: { ...prev[code], flagged: !prev[code]?.flagged },
    }))
  }

  function setFlagComment(code, comment) {
    setFlagged((prev) => ({
      ...prev,
      [code]: { ...prev[code], comment },
    }))
  }

  const flaggedDocs = documents.filter((d) => flagged[d.document_type]?.flagged)

  async function handleAction(action) {
    setActioning(true)
    setError(null)
    const payload = {
      action,
      general_comment: action === 'return' ? returnComment : generalComment,
      flagged_documents: flaggedDocs.map((d) => ({
        document_type: d.document_type,
        comment: flagged[d.document_type]?.comment || '',
      })),
    }
    if (action === 'return') {
      payload.returned_to_level = returnTo
    }
    try {
      await api.post(`reviews/packages/${pkg.id}/action/`, payload)
      setShowForwardModal(false)
      setShowReturnModal(false)
      onRefresh()
    } catch (e) {
      setError(e.response?.data?.detail || 'Action failed.')
    } finally {
      setActioning(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#1e3a5f]">
                  Package Review &mdash; Version {pkg?.package_version || pkg?.version || 1}
                </h1>
                <RoleBadge role={userRole} />
              </div>
              <p className="text-xs text-gray-500">
                Submitted by {pkgInfo.submitted_by_name || pkgInfo.team_leader_name || '—'} &middot;{' '}
                {timeAgo(pkgInfo.submitted_at || pkgInfo.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Document table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#1e3a5f]">Documents ({documents.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Document', 'Auditor', 'Status', 'Flag', 'Comment'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">No documents.</td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const code = doc.document_type
                    const isFlagged = flagged[code]?.flagged
                    return (
                      <tr
                        key={code}
                        className={['transition-colors', isFlagged ? 'bg-amber-50 border-l-4 border-amber-400' : 'hover:bg-gray-50'].join(' ')}
                      >
                        <td className="px-5 py-3.5 font-medium text-gray-800">
                          {doc.document_name}
                          <span className="text-xs font-mono text-gray-400 ml-1.5">{code}</span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{doc.assigned_to || '—'}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={doc.assignment_status} /></td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => toggleFlag(code)}
                            className={[
                              'p-1.5 rounded-lg transition-colors',
                              isFlagged ? 'text-amber-600 bg-amber-100' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50',
                            ].join(' ')}
                            title={isFlagged ? 'Remove flag' : 'Flag this document'}
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-5 py-3.5 min-w-[200px]">
                          {isFlagged ? (
                            <textarea
                              rows={2}
                              className="w-full border border-amber-300 rounded px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                              placeholder="Add comment for this document..."
                              value={flagged[code]?.comment || ''}
                              onChange={(e) => setFlagComment(code, e.target.value)}
                            />
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Overall Comment
            </label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f] resize-none"
              placeholder="Add an overall comment for this review level..."
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowReturnModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-300 transition-colors"
            >
              <CornerDownLeft className="w-4 h-4" /> Return Package
            </button>
            <button
              onClick={() => setShowForwardModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              <CheckCircle className="w-4 h-4" /> Approve &amp; Forward
            </button>
          </div>
        </div>
      </div>

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForwardModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Forward to {nextLabel}?</h3>
            <p className="text-sm text-gray-600 mb-2">
              This package will be forwarded to <strong>{nextLabel}</strong> for the next level of review.
            </p>
            {flaggedDocs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-700 font-semibold mb-1">
                  {flaggedDocs.length} document{flaggedDocs.length !== 1 ? 's' : ''} flagged — included in forwarding notes.
                </p>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleAction('approve')}
                disabled={actioning}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#1e3a5f' }}
              >
                {actioning ? 'Processing...' : `Approve & Forward to ${nextLabel}`}
              </button>
              <button
                onClick={() => setShowForwardModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReturnModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-bold text-[#1e3a5f] mb-4">Return Package</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Return to:</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={returnTo === RETURN_LEVEL_TEAM_LEADER}
                      onChange={() => setReturnTo(RETURN_LEVEL_TEAM_LEADER)}
                      className="accent-[#1e3a5f]"
                    />
                    <span className="text-sm text-gray-700">Team Leader</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={returnTo === RETURN_LEVEL_AUDITOR}
                      onChange={() => setReturnTo(RETURN_LEVEL_AUDITOR)}
                      className="accent-[#1e3a5f]"
                    />
                    <span className="text-sm text-gray-700">Specific Auditors</span>
                  </label>
                </div>
              </div>

              {flaggedDocs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Flagged Documents:</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {flaggedDocs.map((d) => (
                      <div key={d.document_type} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-xs font-medium text-amber-800">
                          {d.document_name}
                          <span className="text-xs font-mono text-amber-600 ml-1.5">{d.document_type}</span>
                        </p>
                        {flagged[d.document_type]?.comment && (
                          <p className="text-xs text-amber-600 mt-0.5">{flagged[d.document_type].comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Return Comment <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f] resize-none"
                  placeholder="Required: reason for returning this package..."
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-1 border-t border-gray-100">
                <button
                  onClick={() => handleAction('return')}
                  disabled={!returnComment.trim() || actioning}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {actioning ? 'Processing...' : 'Confirm Return'}
                </button>
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ReviewPanel ──────────────────────────────────────────────────────────

export default function ReviewPanel() {
  const { engagementId } = useParams()
  const { user } = useAuth()
  const userRole = user?.primary_role || 1

  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function fetchPackage() {
    setLoading(true)
    setError(null)
    try {
      // 1. Find packages for this engagement (latest version first)
      const listRes = await api.get(`reviews/packages/?engagement=${engagementId}`)
      const listData = listRes.data
      const packages = Array.isArray(listData) ? listData : listData.results ?? []
      if (packages.length === 0) {
        setPkg(null)
        return
      }
      const latest = packages.sort(
        (a, b) => (b.package_version || 0) - (a.package_version || 0)
      )[0]
      // 2. Fetch full detail (which embeds documents + review history)
      const detailRes = await api.get(`reviews/packages/${latest.id}/`)
      setPkg(detailRes.data)
    } catch (e) {
      setError('Failed to load review package.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPackage()
  }, [engagementId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading review package...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center">
          <p className="text-red-600 text-sm mb-3">{error}</p>
          <button onClick={() => window.history.back()} className="text-sm text-[#1e3a5f] underline">Go back</button>
        </div>
      </div>
    )
  }

  if (userRole === ROLES.TEAM_LEADER) {
    return <TLReviewView engagementId={engagementId} pkg={pkg} onRefresh={fetchPackage} />
  }

  return <SeniorReviewView engagementId={engagementId} pkg={pkg} onRefresh={fetchPackage} userRole={userRole} />
}
