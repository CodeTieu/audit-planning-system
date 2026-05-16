import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Shield, Lock, Unlock, Wifi, WifiOff, Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { Button, Input, Select, Badge, Modal } from '../../components/ui/index'
import useToast from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'

const ROLE_OPTIONS = [
  { value: '1', label: 'Auditor' },
  { value: '2', label: 'Team Leader' },
  { value: '3', label: 'CEA' },
  { value: '4', label: 'AAG' },
  { value: '5', label: 'DAG' },
  { value: '6', label: 'TSSU' },
  { value: '99', label: 'Admin' },
]

const ROLE_LABELS = { 1: 'Auditor', 2: 'Team Leader', 3: 'CEA', 4: 'AAG', 5: 'DAG', 6: 'TSSU', 99: 'Admin' }

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-[#1e3a5f]">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function FieldRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value || '—'}</span>
    </div>
  )
}

function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toasts, toast, removeToast } = useToast()

  const [editMode, setEditMode] = useState(false)
  const [showAddRoleModal, setShowAddRoleModal] = useState(false)
  const [addRoleValue, setAddRoleValue] = useState('')

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await api.get(`users/${id}/`)
      return res.data
    },
    onSuccess: (data) => {
      reset({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        primary_role: data.primary_role,
        division: data.division,
      })
    },
  })

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

  const updateUser = useMutation({
    mutationFn: (data) => api.patch(`users/${id}/`, data),
    onSuccess: () => {
      toast.success('User updated successfully.')
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      setEditMode(false)
    },
    onError: () => toast.error('Failed to update user.'),
  })

  const unlockUser = useMutation({
    mutationFn: () => api.post(`users/${id}/unlock/`),
    onSuccess: () => {
      toast.success('User unlocked.')
      queryClient.invalidateQueries({ queryKey: ['user', id] })
    },
    onError: () => toast.error('Failed to unlock user.'),
  })

  const toggleOffline = useMutation({
    mutationFn: () => api.post(`users/${id}/offline/`),
    onSuccess: () => {
      toast.success('Offline access updated.')
      queryClient.invalidateQueries({ queryKey: ['user', id] })
    },
    onError: () => toast.error('Failed to update offline access.'),
  })

  const addRole = useMutation({
    mutationFn: (role) => api.post(`users/${id}/roles/`, { role_level: parseInt(role) }),
    onSuccess: () => {
      toast.success('Role added.')
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      setShowAddRoleModal(false)
      setAddRoleValue('')
    },
    onError: () => toast.error('Failed to add role.'),
  })

  const removeRole = useMutation({
    mutationFn: (role) =>
      api.delete(`users/${id}/roles/`, { data: { role_level: parseInt(role) } }),
    onSuccess: () => {
      toast.success('Role removed.')
      queryClient.invalidateQueries({ queryKey: ['user', id] })
    },
    onError: () => toast.error('Failed to remove role.'),
  })

  const onSubmit = (data) => {
    updateUser.mutate({ ...data, primary_role: parseInt(data.primary_role) })
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16 text-gray-400">
        <p>User not found.</p>
        <Button variant="ghost" onClick={() => navigate('/admin/users')} className="mt-4">
          Back to Users
        </Button>
      </div>
    )
  }

  const extraRoles = Array.isArray(user.all_roles)
    ? user.all_roles.filter((r) => r !== user.primary_role)
    : []

  return (
    <div className="max-w-5xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#1e3a5f]">{user.full_name || user.username}</h1>
          <p className="text-sm text-gray-500">{ROLE_LABELS[user.primary_role]} · {user.staff_id || 'No Staff ID'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <SectionCard title="User Information">
          {editMode ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Full Name" error={errors.full_name?.message} {...register('full_name', { required: 'Required' })} />
              <Input label="Email" type="email" error={errors.email?.message} {...register('email', { required: 'Required' })} />
              <Input label="Phone" type="tel" {...register('phone')} />
              <Select label="Primary Role" options={ROLE_OPTIONS} {...register('primary_role')} />
              {divisionOptions.length > 0 && (
                <Select label="Division" options={divisionOptions} placeholder="Select division..." {...register('division')} />
              )}
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" loading={updateUser.isPending}>Save Changes</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Full Name" value={user.full_name} />
                <FieldRow label="Username" value={user.username} />
                <FieldRow label="Email" value={user.email} />
                <FieldRow label="Phone" value={user.phone} />
                <FieldRow label="Staff ID" value={user.staff_id} />
                <FieldRow label="Division" value={user.division_name || user.division} />
              </div>
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={() => { setEditMode(true); reset({ full_name: user.full_name, email: user.email, phone: user.phone, primary_role: user.primary_role, division: user.division }) }}>
                  Edit Information
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Account Security */}
        <SectionCard title={<span className="flex items-center gap-2"><Shield className="w-4 h-4" />Account Security</span>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Last Login" value={user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'} />
              <FieldRow label="Failed Attempts" value={user.failed_login_attempts ?? '0'} />
              <FieldRow label="Password Changed" value={user.password_changed_at ? new Date(user.password_changed_at).toLocaleDateString() : '—'} />
              <FieldRow label="Account Status" value={
                <Badge variant={user.is_locked ? 'danger' : 'success'} label={user.is_locked ? 'Locked' : 'Active'} />
              } />
            </div>
            {user.is_locked && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => unlockUser.mutate()}
                loading={unlockUser.isPending}
              >
                <Unlock className="w-4 h-4" />
                Unlock Account
              </Button>
            )}
          </div>
        </SectionCard>

        {/* Additional Roles */}
        <SectionCard title="Additional Roles">
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Roles beyond the primary role assigned to this user.</p>
            {extraRoles.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No additional roles assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {extraRoles.map((role) => (
                  <div key={role} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1">
                    <span className="text-xs font-medium text-gray-700">{ROLE_LABELS[role] || `Role ${role}`}</span>
                    <button
                      onClick={() => removeRole.mutate(role)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddRoleModal(true)}
            >
              <Plus className="w-4 h-4" />
              Add Role
            </Button>
          </div>
        </SectionCard>

        {/* Offline Access */}
        <SectionCard title={<span className="flex items-center gap-2">{user.offline_enabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}Offline Access</span>}>
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Offline mode allows the user to work on documents without an internet connection.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">
                Offline access is currently{' '}
                <strong className={user.offline_enabled ? 'text-green-600' : 'text-gray-500'}>
                  {user.offline_enabled ? 'enabled' : 'disabled'}
                </strong>
              </span>
              <button
                onClick={() => toggleOffline.mutate()}
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  user.offline_enabled ? 'bg-[#1e3a5f]' : 'bg-gray-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    user.offline_enabled ? 'translate-x-6' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Supervision Links */}
        <div className="lg:col-span-2">
          <SectionCard title="Supervision Links">
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Users that this person supervises or is supervised by.</p>
              {user.supervises && user.supervises.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Supervises:</p>
                  <div className="flex flex-wrap gap-2">
                    {user.supervises.map((s) => (
                      <span key={s.id} className="text-xs bg-[#e8edf4] text-[#1e3a5f] px-3 py-1 rounded-full font-medium">
                        {s.full_name || s.username}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No supervision links configured.</p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Audit trail placeholder */}
        <div className="lg:col-span-2">
          <SectionCard title="Recent Activity (Audit Trail)">
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Audit trail will be available in a future update.</p>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Add Role Modal */}
      <Modal isOpen={showAddRoleModal} onClose={() => setShowAddRoleModal(false)} title="Add Additional Role" size="sm">
        <div className="space-y-4">
          <Select
            label="Role"
            options={ROLE_OPTIONS.filter((r) => !user.all_roles?.includes(parseInt(r.value)))}
            placeholder="Select a role..."
            value={addRoleValue}
            onChange={(e) => setAddRoleValue(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowAddRoleModal(false)}>Cancel</Button>
            <Button
              onClick={() => addRole.mutate(parseInt(addRoleValue))}
              disabled={!addRoleValue}
              loading={addRole.isPending}
            >
              Add Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default UserDetailPage
