import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Pencil, Lock, Unlock, Eye, UserPlus, Search } from 'lucide-react'
import api from '../../lib/api'
import { Button, Input, Select, Modal, Table, PageHeader, Badge } from '../../components/ui/index'
import useToast from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: '1', label: 'Auditor' },
  { value: '2', label: 'Team Leader' },
  { value: '3', label: 'CEA' },
  { value: '4', label: 'AAG' },
  { value: '5', label: 'DAG' },
  { value: '6', label: 'TSSU' },
  { value: '99', label: 'Admin' },
]

const ROLE_FORM_OPTIONS = ROLE_OPTIONS.filter((r) => r.value !== '')

const ROLE_BADGE = {
  1: 'neutral',
  2: 'warning',
  3: 'success',
  4: 'danger',
  5: 'danger',
  6: 'info',
  99: 'info',
}

const ROLE_LABELS = {
  1: 'Auditor',
  2: 'Team Leader',
  3: 'CEA',
  4: 'AAG',
  5: 'DAG',
  6: 'TSSU',
  99: 'Admin',
}

const PAGE_SIZE = 20

function UsersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toasts, toast, removeToast } = useToast()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter) params.set('primary_role', roleFilter)
      params.set('page', page)
      params.set('page_size', PAGE_SIZE)
      const res = await api.get(`users/?${params}`)
      return res.data
    },
    keepPreviousData: true,
  })

  // Fetch divisions for form
  const { data: divisionsData } = useQuery({
    queryKey: ['divisions-flat'],
    queryFn: async () => {
      const res = await api.get('divisions/?flat=true')
      return res.data
    },
  })

  const divisionOptions = Array.isArray(divisionsData)
    ? divisionsData.map((d) => ({ value: d.id, label: d.name }))
    : []

  // Create user mutation
  const createUser = useMutation({
    mutationFn: (data) => api.post('users/', data),
    onSuccess: () => {
      toast.success('User created successfully.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowAddModal(false)
      reset()
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to create user.'
      toast.error(msg)
    },
  })

  // Toggle lock mutation — uses dedicated lock/unlock endpoints
  const toggleLock = useMutation({
    mutationFn: ({ id, locked }) =>
      api.post(`users/${id}/${locked ? 'unlock' : 'lock'}/`),
    onSuccess: (_, vars) => {
      toast.success(vars.locked ? 'User unlocked.' : 'User locked.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to update user status.'),
  })

  const users = Array.isArray(usersData?.results) ? usersData.results
    : Array.isArray(usersData) ? usersData
    : []
  const totalCount = usersData?.count ?? users.length
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const columns = [
    {
      key: 'full_name',
      label: 'Full Name',
      render: (val) => <span className="font-medium text-gray-800">{val || '—'}</span>,
    },
    { key: 'username', label: 'Username' },
    { key: 'staff_id', label: 'Staff ID', render: (val) => val || '—' },
    {
      key: 'primary_role',
      label: 'Role',
      render: (val) => (
        <Badge variant={ROLE_BADGE[val] || 'neutral'} label={ROLE_LABELS[val] || `Role ${val}`} />
      ),
    },
    {
      key: 'division',
      label: 'Division',
      render: (val, row) => row.division_name || val || '—',
    },
    {
      key: 'is_locked',
      label: 'Status',
      render: (val) =>
        val ? (
          <Badge variant="danger" label="Locked" />
        ) : (
          <Badge variant="success" label="Active" />
        ),
    },
    {
      key: 'last_login',
      label: 'Last Login',
      render: (val) =>
        val ? new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/admin/users/${row.id}`)}
            className="p-1.5 rounded text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/admin/users/${row.id}`)}
            className="p-1.5 rounded text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleLock.mutate({ id: row.id, locked: row.is_locked })}
            className={[
              'p-1.5 rounded transition-colors',
              row.is_locked
                ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
                : 'text-gray-400 hover:text-red-600 hover:bg-red-50',
            ].join(' ')}
            title={row.is_locked ? 'Unlock User' : 'Lock User'}
          >
            {row.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ]

  const onSubmit = (data) => {
    createUser.mutate({
      ...data,
      primary_role: parseInt(data.primary_role),
    })
  }

  return (
    <div className="max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and access permissions."
        action={
          <Button onClick={() => setShowAddModal(true)} size="md">
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, username, staff ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10"
            />
          </div>
        </div>
        <div className="w-44">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] bg-white"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div
          className={[
            '[&_tr]:transition-colors',
          ].join(' ')}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-16 text-center text-gray-400 text-sm">
                    No users found. Try adjusting your search.
                  </td>
                </tr>
              ) : (
                users.map((row) => (
                  <tr
                    key={row.id}
                    className={[
                      'hover:bg-gray-50 transition-colors',
                      row.is_locked ? 'bg-red-50/40' : '',
                    ].join(' ')}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-3.5 text-gray-700">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} users
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="px-2">Page {page} of {totalPages}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); reset() }} title="Add New User" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Full Name"
              error={errors.full_name?.message}
              {...register('full_name', { required: 'Full name is required' })}
            />
            <Input
              label="Username"
              error={errors.username?.message}
              {...register('username', { required: 'Username is required' })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Staff ID"
              error={errors.staff_id?.message}
              {...register('staff_id')}
            />
            <Input
              label="Phone"
              type="tel"
              {...register('phone')}
            />
          </div>
          <Select
            label="Primary Role"
            options={ROLE_FORM_OPTIONS}
            placeholder="Select role..."
            error={errors.primary_role?.message}
            {...register('primary_role', { required: 'Role is required' })}
          />
          {divisionOptions.length > 0 && (
            <Select
              label="Division"
              options={divisionOptions}
              placeholder="Select division..."
              {...register('division')}
            />
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => { setShowAddModal(false); reset() }}>
              Cancel
            </Button>
            <Button type="submit" loading={createUser.isPending}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UsersPage
