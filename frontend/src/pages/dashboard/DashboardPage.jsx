import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import api from '../../lib/api'

const ROLE_DISPLAY_COLORS = {
  1:  { bg: '#e8edf4', text: '#1e3a5f' },
  2:  { bg: '#fdf8ee', text: '#8d641a' },
  3:  { bg: '#f0fdf4', text: '#166534' },
  4:  { bg: '#fef2f2', text: '#991b1b' },
  5:  { bg: '#fef2f2', text: '#7f1d1d' },
  6:  { bg: '#e8edf4', text: '#0f2240' },
  99: { bg: '#0f2240', text: '#ffffff' },
}

const STATUS_COLORS = {
  active:     { bg: '#e8edf4', text: '#1e3a5f' },
  in_review:  { bg: '#fdf8ee', text: '#8d641a' },
  locked:     { bg: '#f0fdf4', text: '#166534' },
  completed:  { bg: '#f0fdf4', text: '#166534' },
  returned:   { bg: '#fef2f2', text: '#991b1b' },
  draft:      { bg: '#f3f4f6', text: '#6b7280' },
}

function StatCard({ label, value, sub, subPositive, icon, iconBg, iconColor, loading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-3xl font-bold mt-1" style={{ color: '#1e3a5f' }}>{value ?? '—'}</p>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      {sub && !loading && (
        <p className="text-xs mt-3 font-medium"
          style={{ color: subPositive === true ? '#166534' : subPositive === false ? '#991b1b' : '#6b7280' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

const ICONS = {
  engagements: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  review: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  risks: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  findings: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
}

function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const roleColors = ROLE_DISPLAY_COLORS[user?.primary_role] || ROLE_DISPLAY_COLORS[1]

  const [stats, setStats] = useState(null)
  const [engagements, setEngagements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('engagements/?page_size=5&ordering=-created_at').catch(() => ({ data: { results: [] } })),
      api.get('risks/?page_size=1').catch(() => ({ data: { count: 0 } })),
      api.get('findings/?page_size=1').catch(() => ({ data: { count: 0 } })),
    ]).then(([engsRes, risksRes, findingsRes]) => {
      const engs = engsRes.data?.results ?? (Array.isArray(engsRes.data) ? engsRes.data : [])
      setEngagements(engs)

      const allEngs = engsRes.data?.count ?? engs.length
      const activeEngs = engs.filter((e) => ['active', 'in_review'].includes(e.status)).length
      const inReview = engs.filter((e) => e.status === 'in_review').length

      setStats({
        activeEngagements: activeEngs,
        totalEngagements: allEngs,
        inReview,
        totalRisks: risksRes.data?.count ?? 0,
        totalFindings: findingsRes.data?.count ?? 0,
      })
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
            Welcome, {user?.full_name || user?.username || 'User'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Here is your audit activity summary for today.
          </p>
        </div>
        {user?.role_display && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: roleColors.bg, color: roleColors.text }}>
            {user.role_display}
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Engagements"
          value={stats?.activeEngagements}
          sub={stats?.totalEngagements != null ? `${stats.totalEngagements} total across all years` : null}
          positive={null}
          icon={ICONS.engagements}
          iconBg="#e8edf4" iconColor="#1e3a5f"
          loading={loading}
        />
        <StatCard
          label="In Review"
          value={stats?.inReview}
          sub={stats?.inReview > 0 ? 'Awaiting reviewer action' : 'No packages pending review'}
          positive={stats?.inReview === 0}
          icon={ICONS.review}
          iconBg="#fdf8ee" iconColor="#c9952a"
          loading={loading}
        />
        <StatCard
          label="Total Risks Identified"
          value={stats?.totalRisks}
          sub="Auto-generated from workpapers"
          positive={null}
          icon={ICONS.risks}
          iconBg="#fffbeb" iconColor="#92400e"
          loading={loading}
        />
        <StatCard
          label="Total Findings"
          value={stats?.totalFindings}
          sub="Raised from risk register"
          positive={null}
          icon={ICONS.findings}
          iconBg="#fef2f2" iconColor="#991b1b"
          loading={loading}
        />
      </div>

      {/* Recent engagements */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#1e3a5f' }}>
              Recent Engagements
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Your most recently created engagements</p>
          </div>
          <button
            onClick={() => navigate('/engagements')}
            className="text-sm font-medium hover:underline"
            style={{ color: '#1e3a5f' }}
          >
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : engagements.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              No engagements found. Create your first engagement to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Engagement Code', 'Entity', 'Audit Year', 'Team Leader', 'Status', 'Deadline'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {engagements.map((eng) => {
                  const sc = STATUS_COLORS[eng.status] || STATUS_COLORS.draft
                  const deadline = eng.overall_deadline ? new Date(eng.overall_deadline) : null
                  const today = new Date()
                  const daysLeft = deadline ? Math.ceil((deadline - today) / 86400000) : null
                  return (
                    <tr
                      key={eng.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/engagements/${eng.id}`)}
                    >
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-[#1e3a5f]">
                        {eng.engagement_code}
                      </td>
                      <td className="px-6 py-4 text-gray-700 max-w-[200px] truncate">
                        {eng.entity_name || eng.entity}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{eng.audit_year}</td>
                      <td className="px-6 py-4 text-gray-600">{eng.team_leader_name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                          style={{ backgroundColor: sc.bg, color: sc.text }}>
                          {eng.status_display || eng.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                        {deadline ? (
                          <span className={daysLeft != null && daysLeft < 0 ? 'text-red-600 font-medium' : ''}>
                            {deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {daysLeft != null && daysLeft < 0 && ` (${Math.abs(daysLeft)}d late)`}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            title: 'View All Engagements',
            desc: 'Browse and manage all audit engagements',
            href: '/engagements',
            icon: ICONS.engagements,
            iconBg: '#e8edf4', iconColor: '#1e3a5f',
          },
          {
            title: 'My Profile',
            desc: 'Update your details and change password',
            href: '/profile',
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
            iconBg: '#f5f3ff', iconColor: '#7c3aed',
          },
          user?.primary_role >= 3 && {
            title: 'Management Dashboard',
            desc: 'Division-level overview and analytics',
            href: '/dashboard/management',
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
            iconBg: '#fdf8ee', iconColor: '#c9952a',
          },
        ].filter(Boolean).map((card) => (
          <button
            key={card.title}
            onClick={() => navigate(card.href)}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-[#1e3a5f] transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
              style={{ backgroundColor: card.iconBg, color: card.iconColor }}>
              {card.icon}
            </div>
            <p className="text-sm font-semibold text-gray-800 group-hover:text-[#1e3a5f] transition-colors">
              {card.title}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{card.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default DashboardPage
