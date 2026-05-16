import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Briefcase } from 'lucide-react'
import api from '../../lib/api'
import useAuth, { ROLES } from '../../hooks/useAuth'
import { Button, PageHeader, StatusBadge } from '../../components/ui/index'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'locked', label: 'Locked' },
  { value: 'archived', label: 'Archived' },
]

function EngagementsPage() {
  const navigate = useNavigate()
  const { hasMinRole } = useAuth()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')

  const currentYear = new Date().getFullYear()
  const yearOptions = [
    { value: '', label: 'All Years' },
    ...Array.from({ length: 6 }, (_, i) => {
      const y = currentYear - i
      return { value: String(y), label: String(y) }
    }),
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['engagements', search, statusFilter, yearFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (yearFilter) params.set('audit_year', yearFilter)
      const res = await api.get(`engagements/?${params}`)
      return res.data
    },
  })

  const engagements = Array.isArray(data?.results) ? data.results
    : Array.isArray(data) ? data
    : []

  const canCreate = hasMinRole(ROLES.CEA)

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Engagements"
        subtitle="Manage audit engagements across all entities."
        action={
          canCreate && (
            <Button onClick={() => navigate('/engagements/new')}>
              <Plus className="w-4 h-4" />
              New Engagement
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by entity name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] bg-white w-40"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] bg-white w-32"
        >
          {yearOptions.map((y) => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Code', 'Entity', 'Audit Year', 'Team Leader', 'Status', 'Documents', 'Deadline', 'Actions'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : engagements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Briefcase className="w-10 h-10" />
                    <p className="text-sm font-medium">No engagements found</p>
                    <p className="text-xs">
                      {search || statusFilter || yearFilter
                        ? 'Try adjusting your filters.'
                        : canCreate
                        ? 'Create your first engagement to get started.'
                        : 'No engagements have been assigned to you yet.'}
                    </p>
                    {canCreate && !search && !statusFilter && !yearFilter && (
                      <Button size="sm" onClick={() => navigate('/engagements/new')} className="mt-1">
                        <Plus className="w-3.5 h-3.5" />
                        New Engagement
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              engagements.map((eng) => {
                const submitted = eng.documents_submitted ?? 0
                const total = eng.documents_total ?? 13
                const pct = total ? Math.round((submitted / total) * 100) : 0
                const deadline = eng.overall_deadline ? new Date(eng.overall_deadline) : null
                const today = new Date()
                const daysLeft = deadline ? Math.ceil((deadline - today) / 86400000) : null

                return (
                  <tr
                    key={eng.id}
                    onClick={() => navigate(`/engagements/${eng.id}`)}
                    className="hover:bg-[#f8fafc] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-[#1e3a5f] font-semibold">
                      {eng.engagement_code || `ENG-${eng.id}`}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-800">{eng.entity_name || eng.entity}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{eng.audit_year}</td>
                    <td className="px-5 py-3.5 text-gray-600">{eng.team_leader_name || '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={eng.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1e3a5f] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{submitted}/{total}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {deadline ? (
                        <span className={[
                          'text-xs font-medium',
                          daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-gray-600',
                        ].join(' ')}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/engagements/${eng.id}`) }}
                      >
                        View
                      </Button>
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

export default EngagementsPage
