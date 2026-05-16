import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Clock, AlertTriangle, MessageSquare } from 'lucide-react'
import api from '../../lib/api'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }) {
  const map = {
    draft: { bg: '#f3f4f6', text: '#6b7280', label: 'Draft' },
    planning: { bg: '#e8edf4', text: '#1e3a5f', label: 'Planning' },
    in_progress: { bg: '#fdf8ee', text: '#8d641a', label: 'In Progress' },
    in_review: { bg: '#f5f3ff', text: '#7c3aed', label: 'In Review' },
    approved: { bg: '#f0fdf4', text: '#166534', label: 'Approved' },
    locked: { bg: '#f3f4f6', text: '#374151', label: 'Locked' },
    completed: { bg: '#f0fdf4', text: '#166534', label: 'Completed' },
  }
  const cfg = map[status] || { bg: '#f3f4f6', text: '#6b7280', label: status || '—' }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  )
}

function StatCard({ label, value, icon, iconBg, iconColor, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#1e3a5f' }}>
            {value ?? <span className="text-gray-300 text-2xl">—</span>}
          </p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

const PIPELINE_LEVELS = [
  { label: 'TL Review', key: 'tl_review', color: '#fdf8ee', textColor: '#8d641a', border: '#f6d887' },
  { label: 'CEA Review', key: 'cea_review', color: '#f0fdf4', textColor: '#166534', border: '#86efac' },
  { label: 'AAG Review', key: 'aag_review', color: '#fef2f2', textColor: '#991b1b', border: '#fca5a5' },
  { label: 'DAG Review', key: 'dag_review', color: '#fef2f2', textColor: '#7f1d1d', border: '#fca5a5' },
  { label: 'TSSU Review', key: 'tssu_review', color: '#e8edf4', textColor: '#0f2240', border: '#93afc8' },
]

function PipelinePanel({ pipeline }) {
  const maxCount = Math.max(...PIPELINE_LEVELS.map((l) => pipeline[l.key] || 0), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#1e3a5f] mb-4">Review Pipeline</h3>
      <div className="space-y-3">
        {PIPELINE_LEVELS.map((level) => {
          const count = pipeline[level.key] || 0
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
          return (
            <div key={level.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">{level.label}</span>
                <span className="text-xs font-bold" style={{ color: level.textColor }}>{count}</span>
              </div>
              <div className="h-5 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                    backgroundColor: level.color,
                    border: `1px solid ${level.border}`,
                    minWidth: count > 0 ? '32px' : '0',
                  }}
                >
                  {count > 0 && (
                    <span className="text-[10px] font-bold" style={{ color: level.textColor }}>{count}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecentEngagementsPanel({ engagements }) {
  const recent = engagements.slice(0, 5)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-[#1e3a5f]">Recent Engagements</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {['Entity', 'Stage', 'Documents', 'Deadline', 'Action'].map((h) => (
              <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {recent.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">No engagements found.</td>
            </tr>
          ) : (
            recent.map((eng) => {
              const deadline = eng.overall_deadline ? new Date(eng.overall_deadline) : null
              const daysLeft = deadline ? Math.ceil((deadline - Date.now()) / 86400000) : null
              const submitted = eng.documents_submitted ?? 0
              const total = eng.documents_total ?? 13
              return (
                <tr key={eng.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800 text-sm truncate max-w-[140px]">
                      {eng.entity_name || eng.entity || '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">{eng.engagement_code}</p>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={eng.status} />
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600">
                    {submitted} / {total}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {deadline ? (
                      <span className={daysLeft !== null && daysLeft < 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        {daysLeft !== null && (
                          <span className="block text-[10px]">
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                          </span>
                        )}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      to={`/engagements/${eng.id}`}
                      className="text-xs font-semibold text-[#1e3a5f] hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function ManagementDashboardPage() {
  const [engagements, setEngagements] = useState([])
  const [riskSummary, setRiskSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const [engRes, riskRes] = await Promise.all([
        api.get('engagements/?page_size=100').catch(() => ({ data: { results: [] } })),
        api.get('risks/summary/').catch(() => ({ data: null })),
      ])
      const engList = Array.isArray(engRes.data) ? engRes.data : engRes.data?.results ?? []
      setEngagements(engList)
      setRiskSummary(riskRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  // Compute stats
  const activeCount = engagements.filter((e) => ['planning', 'in_progress'].includes(e.status)).length
  const inReviewCount = engagements.filter((e) => e.status === 'in_review').length
  const totalRisks = riskSummary?.total || 0
  const findingsCount = riskSummary?.findings_count || 0

  // Pipeline counts
  const pipeline = {
    tl_review: engagements.filter((e) => e.review_level === 1 || e.current_review_level === 1).length,
    cea_review: engagements.filter((e) => e.review_level === 2 || e.current_review_level === 2).length,
    aag_review: engagements.filter((e) => e.review_level === 3 || e.current_review_level === 3).length,
    dag_review: engagements.filter((e) => e.review_level === 4 || e.current_review_level === 4).length,
    tssu_review: engagements.filter((e) => e.review_level === 5 || e.current_review_level === 5).length,
  }

  // If no review_level field, estimate from status
  if (Object.values(pipeline).every((v) => v === 0) && inReviewCount > 0) {
    pipeline.tl_review = inReviewCount
  }

  const statCards = [
    {
      label: 'Active Engagements',
      value: loading ? null : activeCount,
      icon: <FileText className="w-6 h-6" />,
      iconBg: '#e8edf4',
      iconColor: '#1e3a5f',
      sub: 'Planning + In Progress',
    },
    {
      label: 'In Review',
      value: loading ? null : inReviewCount,
      icon: <Clock className="w-6 h-6" />,
      iconBg: '#fdf8ee',
      iconColor: '#c9952a',
      sub: 'Awaiting review approval',
    },
    {
      label: 'Total Risks',
      value: loading ? null : totalRisks,
      icon: <AlertTriangle className="w-6 h-6" />,
      iconBg: '#fffbeb',
      iconColor: '#92400e',
      sub: 'Across all engagements',
    },
    {
      label: 'Findings Raised',
      value: loading ? null : findingsCount,
      icon: <MessageSquare className="w-6 h-6" />,
      iconBg: '#fef2f2',
      iconColor: '#991b1b',
      sub: 'Total findings',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Management Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of all engagements and review activity</p>
      </div>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Row 2: Pipeline + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PipelinePanel pipeline={pipeline} />
        <RecentEngagementsPanel engagements={engagements} />
      </div>

      {/* Row 3: Full engagement table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1e3a5f]">All Engagements</h3>
          <span className="text-xs text-gray-400">{engagements.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Code', 'Entity', 'Team Leader', 'Status', 'Documents', 'Deadline', 'Action'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : engagements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                    No engagements found.
                  </td>
                </tr>
              ) : (
                engagements.map((eng) => {
                  const deadline = eng.overall_deadline ? new Date(eng.overall_deadline) : null
                  const daysLeft = deadline ? Math.ceil((deadline - Date.now()) / 86400000) : null
                  const submitted = eng.documents_submitted ?? 0
                  const total = eng.documents_total ?? 13
                  return (
                    <tr key={eng.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-gray-500">
                        {eng.engagement_code || `ENG-${eng.id}`}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800 max-w-[180px] truncate">
                        {eng.entity_name || eng.entity || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {eng.team_leader_name || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={eng.status} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <span>{submitted}/{total}</span>
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1e3a5f] rounded-full"
                              style={{ width: `${total > 0 ? (submitted / total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {deadline ? (
                          <span className={daysLeft !== null && daysLeft < 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/engagements/${eng.id}`}
                          className="text-xs font-semibold text-[#1e3a5f] hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
