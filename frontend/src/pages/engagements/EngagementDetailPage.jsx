import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft, Users, FileText, AlertTriangle, MessageSquare, Eye, Lock,
  Plus, Trash2, Pencil, ChevronRight
} from 'lucide-react'
import api from '../../lib/api'
import useAuth, { ROLES } from '../../hooks/useAuth'
import { Button, StatusBadge, Modal, Select, Badge } from '../../components/ui/index'
import useToast from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'

const TABS = [
  { id: 'overview', label: 'Overview', icon: <Eye className="w-4 h-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
  { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
  { id: 'risks', label: 'Risks', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'findings', label: 'Findings', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'review', label: 'Review', icon: <Eye className="w-4 h-4" /> },
  { id: 'export', label: 'Export', icon: <Lock className="w-4 h-4" /> },
]

const ENGAGEMENT_ROLES = [
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'senior_auditor', label: 'Senior Auditor' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'it_auditor', label: 'IT Auditor' },
  { value: 'specialist', label: 'Specialist' },
]

function PlaceholderTab({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#e8edf4] flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-[#1e3a5f]" />
      </div>
      <h3 className="text-base font-semibold text-[#1e3a5f] mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs">{description}</p>
    </div>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab({ engagement }) {
  const deadline = engagement.overall_deadline ? new Date(engagement.overall_deadline) : null
  const today = new Date()
  const daysLeft = deadline ? Math.ceil((deadline - today) / 86400000) : null
  const submitted = engagement.documents_submitted ?? 0
  const total = engagement.documents_total ?? 13
  const pct = total ? Math.round((submitted / total) * 100) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Entity Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#1e3a5f] mb-4">Entity Details</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {[
            ['Entity', engagement.entity_name || engagement.entity],
            ['Entity Type', engagement.entity_type || '—'],
            ['Audit Period', engagement.period_start && engagement.period_end ? `${engagement.period_start} – ${engagement.period_end}` : '—'],
            ['Reporting Framework', engagement.reporting_framework || 'IPSAS'],
            ['Currency', engagement.reporting_currency || 'TZS'],
            ['Team Leader', engagement.team_leader_name || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
              <dd className="text-sm text-gray-800 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-semibold text-[#1e3a5f]">Engagement Progress</h3>

        {/* Document progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Documents Submitted</span>
            <span>{submitted} / {total}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#1e3a5f] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pct}% complete</p>
        </div>

        {/* Deadline */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Overall Deadline</p>
          {deadline ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-800">
                {deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <span className={[
                'text-xs font-medium px-2 py-0.5 rounded-full',
                daysLeft < 0 ? 'bg-red-100 text-red-700' : daysLeft <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
              ].join(' ')}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft} days left`}
              </span>
            </div>
          ) : '—'}
        </div>

        {/* Status */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Overall Status</p>
          <StatusBadge status={engagement.status} />
        </div>
      </div>
    </div>
  )
}

// ─── Team Tab ────────────────────────────────────────────────────────────────
function TeamTab({ engagementId }) {
  const queryClient = useQueryClient()
  const { toasts, toast, removeToast } = useToast()
  const { hasMinRole, user } = useAuth()
  const isTL = hasMinRole(ROLES.TEAM_LEADER)

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  const { data: team, isLoading } = useQuery({
    queryKey: ['engagement-team', engagementId],
    queryFn: async () => {
      const res = await api.get(`engagements/${engagementId}/team/`)
      return res.data
    },
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('users/?page_size=200')
      return res.data
    },
    enabled: showAddModal,
  })

  const userOptions = (() => {
    const list = Array.isArray(usersData?.results) ? usersData.results
      : Array.isArray(usersData) ? usersData : []
    return list.map((u) => ({ value: u.id, label: u.full_name || u.username }))
  })()

  const addMember = useMutation({
    mutationFn: () => api.post(`engagements/${engagementId}/team/`, {
      user: parseInt(selectedUser),
      engagement_role: selectedRole,
    }),
    onSuccess: () => {
      toast.success('Team member added.')
      queryClient.invalidateQueries({ queryKey: ['engagement-team', engagementId] })
      setShowAddModal(false)
      setSelectedUser('')
      setSelectedRole('')
    },
    onError: () => toast.error('Failed to add team member.'),
  })

  const removeMember = useMutation({
    mutationFn: (memberId) => api.delete(`engagements/${engagementId}/team/${memberId}/`),
    onSuccess: () => {
      toast.success('Member removed.')
      queryClient.invalidateQueries({ queryKey: ['engagement-team', engagementId] })
    },
    onError: () => toast.error('Failed to remove member.'),
  })

  const members = Array.isArray(team) ? team : team?.results ?? []

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
        {isTL && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add Member
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Full Name', 'Role in Engagement', 'Assigned Docs', 'Status', ...(isTL ? ['Actions'] : [])].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={isTL ? 5 : 4} className="px-5 py-10 text-center text-sm text-gray-400">
                  No team members yet.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{m.user_full_name || m.user_name || m.user}</td>
                  <td className="px-5 py-3.5 text-gray-600 capitalize">{m.engagement_role?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{m.assigned_documents_count ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={m.status || 'active'} />
                  </td>
                  {isTL && (
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => removeMember.mutate(m.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Team Member" size="sm">
        <div className="space-y-4">
          <Select
            label="User"
            options={userOptions}
            placeholder="Select user..."
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          />
          <Select
            label="Engagement Role"
            options={ENGAGEMENT_ROLES}
            placeholder="Select role..."
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button
              onClick={() => addMember.mutate()}
              disabled={!selectedUser || !selectedRole}
              loading={addMember.isPending}
            >
              Add Member
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Documents Tab ───────────────────────────────────────────────────────────
function DocumentsTab({ engagementId, engagement }) {
  const queryClient = useQueryClient()
  const { toasts, toast, removeToast } = useToast()
  const { user, hasMinRole } = useAuth()
  const navigate = useNavigate()
  const isTL = hasMinRole(ROLES.TEAM_LEADER)

  const [reassigningId, setReassigningId] = useState(null)
  const [reassignUserId, setReassignUserId] = useState('')

  const { data: docs, isLoading } = useQuery({
    queryKey: ['engagement-docs', engagementId],
    queryFn: async () => {
      const res = await api.get(`engagements/${engagementId}/documents/`)
      return res.data
    },
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('users/?page_size=200')
      return res.data
    },
    enabled: !!reassigningId,
  })

  const reassign = useMutation({
    mutationFn: ({ docId, userId }) =>
      api.patch(`engagements/${engagementId}/documents/${docId}/`, { assigned_to: userId }),
    onSuccess: () => {
      toast.success('Document reassigned.')
      queryClient.invalidateQueries({ queryKey: ['engagement-docs', engagementId] })
      setReassigningId(null)
    },
    onError: () => toast.error('Failed to reassign document.'),
  })

  const userOptions = (() => {
    const list = Array.isArray(usersData?.results) ? usersData.results
      : Array.isArray(usersData) ? usersData : []
    return list.map((u) => ({ value: u.id, label: u.full_name || u.username }))
  })()

  const documents = Array.isArray(docs) ? docs : docs?.results ?? []
  const submittedCount = documents.filter((d) => ['submitted', 'tl_approved', 'finalized', 'locked'].includes(d.status)).length
  const tlApprovedCount = documents.filter((d) => ['tl_approved', 'finalized', 'locked'].includes(d.status)).length
  const total = documents.length || 13

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Progress summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Submitted', value: submittedCount, total, color: 'text-[#1e3a5f]' },
          { label: 'TL Approved', value: tlApprovedCount, total, color: 'text-teal-600' },
          { label: 'Total Documents', value: total, total, color: 'text-gray-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={['text-2xl font-bold', stat.color].join(' ')}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.label} {stat.total !== stat.value ? `/ ${stat.total}` : ''}</p>
          </div>
        ))}
      </div>

      {/* Documents list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['#', 'Document', 'Assigned To', 'Status', 'Deadline', 'Days Left', 'Action'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 13 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                  No documents generated yet.
                </td>
              </tr>
            ) : (
              documents.map((doc, idx) => {
                const today = new Date()
                const deadline = doc.deadline ? new Date(doc.deadline) : null
                const daysLeft = deadline ? Math.ceil((deadline - today) / 86400000) : null
                const isLocked = doc.is_locked || doc.status === 'locked'
                const isMyDoc = doc.assigned_to === user?.id || doc.assigned_to_id === user?.id
                const canOpen = isMyDoc && !isLocked

                return (
                  <tr key={doc.id ?? idx} className={['hover:bg-gray-50 transition-colors', isLocked ? 'opacity-60' : ''].join(' ')}>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {isLocked && <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                        <div>
                          <span className="font-medium text-gray-800">
                            {doc.document_type_name || doc.document_name || doc.name || `Document ${idx + 1}`}
                          </span>
                          {doc.document_type_code && (
                            <span className="ml-2 text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              {doc.document_type_code}
                            </span>
                          )}
                        </div>
                      </div>
                      {isLocked && doc.locked_by_doc && (
                        <p className="text-xs text-gray-400 mt-0.5 ml-5">Waiting for: {doc.locked_by_doc}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {isTL && reassigningId === doc.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={reassignUserId}
                            onChange={(e) => setReassignUserId(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#1e3a5f]"
                          >
                            <option value="">Select user...</option>
                            {userOptions.map((u) => (
                              <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => reassign.mutate({ docId: doc.id, userId: reassignUserId })}
                            disabled={!reassignUserId}
                            className="text-xs text-[#1e3a5f] hover:underline"
                          >
                            Save
                          </button>
                          <button onClick={() => setReassigningId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600">{doc.assigned_to_name || doc.assigned_to || '—'}</span>
                          {isTL && !isLocked && (
                            <button
                              onClick={() => { setReassigningId(doc.id); setReassignUserId('') }}
                              className="text-gray-300 hover:text-[#1e3a5f] transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={doc.status} /></td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {deadline ? deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {daysLeft !== null ? (
                        <span className={[
                          'text-xs font-medium',
                          daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-green-600',
                        ].join(' ')}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {isLocked ? (
                        <span className="text-xs text-gray-300 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : doc.document_type_code ? (
                        <Button
                          variant={canOpen ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => navigate(`/engagements/${engagementId}/workpapers/${doc.document_type_code}`)}
                        >
                          {canOpen ? 'Open' : 'View'}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  high_pervasive: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', label: 'H-Pervasive', dot: '#991b1b' },
  high: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', label: 'High', dot: '#dc2626' },
  medium: { bg: '#fffbeb', text: '#d97706', border: '#fcd34d', label: 'Medium', dot: '#d97706' },
  low: { bg: '#f0fdf4', text: '#16a34a', border: '#86efac', label: 'Low', dot: '#16a34a' },
}

function normSev(sev) {
  return (sev || '').toLowerCase().replace(/[-\s]/g, '_')
}

function getSevConfig(sev) {
  return SEVERITY_CONFIG[normSev(sev)] || SEVERITY_CONFIG.low
}

function SeverityPill({ severity }) {
  const c = getSevConfig(severity)
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      {c.label}
    </span>
  )
}

// ─── Risks Tab ───────────────────────────────────────────────────────────────

function RisksTab({ engagementId }) {
  const [risks, setRisks] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`risks/?engagement=${engagementId}&page_size=200`).catch(() => ({ data: [] })),
      api.get(`risks/summary/?engagement=${engagementId}`).catch(() => ({ data: null })),
    ]).then(([risksRes, summaryRes]) => {
      const r = risksRes.data
      setRisks(Array.isArray(r) ? r : r.results ?? [])
      setSummary(summaryRes.data)
    }).finally(() => setLoading(false))
  }, [engagementId])

  // Prefer authoritative counts from the summary endpoint (covers paginated results too)
  const sevSummary = summary?.by_severity || summary?.severity_counts || {}
  const counts = {
    high_pervasive: sevSummary.high_pervasive
      ?? sevSummary['High-Pervasive']
      ?? risks.filter((r) => normSev(r.severity) === 'high_pervasive' && r.status !== 'dismissed').length,
    high: sevSummary.high
      ?? sevSummary['High']
      ?? risks.filter((r) => normSev(r.severity) === 'high' && r.status !== 'dismissed').length,
    medium: sevSummary.medium
      ?? sevSummary['Medium']
      ?? risks.filter((r) => normSev(r.severity) === 'medium' && r.status !== 'dismissed').length,
    low: sevSummary.low
      ?? sevSummary['Low']
      ?? risks.filter((r) => normSev(r.severity) === 'low' && r.status !== 'dismissed').length,
  }

  const sevBoxes = [
    { key: 'high_pervasive', emoji: '🔴', label: 'High-Pervasive', color: '#991b1b', bg: '#fef2f2' },
    { key: 'high', emoji: '🔴', label: 'High', color: '#dc2626', bg: '#fef2f2' },
    { key: 'medium', emoji: '🟡', label: 'Medium', color: '#d97706', bg: '#fffbeb' },
    { key: 'low', emoji: '🟢', label: 'Low', color: '#16a34a', bg: '#f0fdf4' },
  ]

  const topRisks = risks.filter((r) => r.status !== 'dismissed').slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Severity summary boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sevBoxes.map((box) => (
          <div key={box.key} className="rounded-xl border p-4 text-center"
            style={{ backgroundColor: box.bg, borderColor: SEVERITY_CONFIG[box.key].border }}>
            <p className="text-2xl font-bold" style={{ color: box.color }}>
              {loading ? '—' : counts[box.key]}
            </p>
            <p className="text-xs font-medium mt-0.5" style={{ color: box.color }}>
              {box.emoji} {box.label}
            </p>
          </div>
        ))}
      </div>

      {/* Top 5 risks */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[#1e3a5f]">Top Active Risks</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : topRisks.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No risks generated yet. Complete workpapers to generate risks.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {topRisks.map((risk) => (
              <div key={risk.id} className="px-5 py-3 flex items-start gap-3">
                <SeverityPill severity={risk.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{risk.risk_description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{risk.risk_no || risk.risk_ref} · {risk.source_document}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link to full register */}
      <div className="flex justify-end">
        <Link
          to={`/engagements/${engagementId}/risks`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#1e3a5f] bg-[#e8edf4] rounded-lg hover:bg-[#d0daea] transition-colors"
        >
          View Full Risk Register
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── Findings Tab ─────────────────────────────────────────────────────────────

const FINDING_STATUS_COLORS = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  submitted: { bg: '#eff6ff', text: '#2563eb' },
  reviewed: { bg: '#f5f3ff', text: '#7c3aed' },
  finalized: { bg: '#f0fdf4', text: '#16a34a' },
  dismissed: { bg: '#f3f4f6', text: '#9ca3af' },
}

function FindingStatusChip({ status }) {
  const c = FINDING_STATUS_COLORS[status] || FINDING_STATUS_COLORS.draft
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft'
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {label}
    </span>
  )
}

function FindingsTab({ engagementId }) {
  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`findings/?engagement=${engagementId}`)
      .then((res) => {
        const d = res.data
        setFindings(Array.isArray(d) ? d : d.results ?? [])
      })
      .catch(() => setFindings([]))
      .finally(() => setLoading(false))
  }, [engagementId])

  const statusCounts = findings.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1
    return acc
  }, {})

  const statusOrder = ['draft', 'submitted', 'reviewed', 'finalized', 'dismissed']
  const topFindings = findings.slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Status breakdown chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-[#1e3a5f]">
          {loading ? '—' : findings.length} finding{findings.length !== 1 ? 's' : ''} total
        </span>
        <span className="text-gray-300">·</span>
        {statusOrder.map((s) => {
          const count = statusCounts[s] || 0
          if (count === 0) return null
          return (
            <span key={s} className="flex items-center gap-1">
              <FindingStatusChip status={s} />
              <span className="text-xs text-gray-500">{count}</span>
            </span>
          )
        })}
      </div>

      {/* Mini findings table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[#1e3a5f]">Recent Findings</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : topFindings.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No findings raised yet. Generate findings from the Risk Register.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Ref', 'Title', 'Status', 'Created By'].map((h) => (
                  <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topFindings.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-xs font-mono font-semibold text-gray-500">
                    {f.finding_ref || `#${f.id}`}
                  </td>
                  <td className="px-5 py-3 max-w-xs">
                    <p className="text-sm text-gray-800 truncate">{f.title || '—'}</p>
                  </td>
                  <td className="px-5 py-3">
                    <FindingStatusChip status={f.status} />
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {f.created_by_name || f.created_by || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Link to all findings */}
      <div className="flex justify-end">
        <Link
          to={`/engagements/${engagementId}/findings`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#1e3a5f] bg-[#e8edf4] rounded-lg hover:bg-[#d0daea] transition-colors"
        >
          View All Findings
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── Review Tab ──────────────────────────────────────────────────────────────

function ReviewTab({ engagementId, engagement }) {
  const IN_REVIEW_STATUSES = ['in_review', 'review', 'tl_review', 'cea_review', 'aag_review', 'dag_review', 'tssu_review', 'approved', 'locked', 'completed']
  const canReview = IN_REVIEW_STATUSES.includes(engagement?.status)

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#e8edf4] flex items-center justify-center mb-4">
        <Eye className="w-7 h-7 text-[#1e3a5f]" />
      </div>
      <h3 className="text-base font-semibold text-[#1e3a5f] mb-1">Review Workflow</h3>
      {canReview ? (
        <>
          <p className="text-sm text-gray-500 mb-5 max-w-xs">
            This engagement is in review. Open the full review panel to approve or return documents.
          </p>
          <Link
            to={`/engagements/${engagementId}/review`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            <Eye className="w-4 h-4" />
            Open Review Panel
          </Link>
        </>
      ) : (
        <p className="text-sm text-gray-400 max-w-xs">
          The review panel will be available once this engagement has been submitted for review.
          Current status: <span className="font-semibold">{engagement?.status || 'unknown'}</span>.
        </p>
      )}
    </div>
  )
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab({ engagementId, engagement }) {
  const isLocked = engagement?.status === 'locked'

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#e8edf4] flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-[#1e3a5f]" />
      </div>
      <h3 className="text-base font-semibold text-[#1e3a5f] mb-1">Export Package</h3>
      {isLocked ? (
        <>
          <p className="text-sm text-gray-500 mb-5 max-w-xs">
            This engagement is locked and ready for export to TeamMate+.
          </p>
          <Link
            to={`/engagements/${engagementId}/export`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            <Lock className="w-4 h-4" />
            Open Export Page
          </Link>
        </>
      ) : (
        <p className="text-sm text-gray-400 max-w-xs">
          The export page will be available once this engagement is locked after final approval.
          Current status: <span className="font-semibold">{engagement?.status || 'unknown'}</span>.
        </p>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
function EngagementDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const { data: engagement, isLoading } = useQuery({
    queryKey: ['engagement', id],
    queryFn: async () => {
      const res = await api.get(`engagements/${id}/`)
      return res.data
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (!engagement) {
    return (
      <div className="max-w-6xl mx-auto text-center py-16 text-gray-400">
        <p>Engagement not found.</p>
        <Button variant="ghost" onClick={() => navigate('/engagements')} className="mt-4">
          Back to Engagements
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => navigate('/engagements')}
          className="p-1.5 mt-0.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#1e3a5f]">
              {engagement.engagement_code || `ENG-${id}`}
            </h1>
            <span className="text-gray-300">·</span>
            <span className="text-base text-gray-700 font-medium">{engagement.entity_name || engagement.entity}</span>
            <StatusBadge status={engagement.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Audit Year {engagement.audit_year} · {engagement.team_leader_name ? `TL: ${engagement.team_leader_name}` : 'No team leader assigned'}
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-[#1e3a5f] text-[#1e3a5f]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab engagement={engagement} />}
        {activeTab === 'team' && <TeamTab engagementId={id} />}
        {activeTab === 'documents' && <DocumentsTab engagementId={id} engagement={engagement} />}
        {activeTab === 'risks' && <RisksTab engagementId={id} />}
        {activeTab === 'findings' && <FindingsTab engagementId={id} />}
        {activeTab === 'review' && (
          <ReviewTab engagementId={id} engagement={engagement} />
        )}
        {activeTab === 'export' && (
          <ExportTab engagementId={id} engagement={engagement} />
        )}
      </div>
    </div>
  )
}

export default EngagementDetailPage
