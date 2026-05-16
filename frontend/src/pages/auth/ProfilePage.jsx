import { useState } from 'react'
import { Check, X, Eye, EyeOff } from 'lucide-react'
import api from '../../lib/api'
import useAuth from '../../hooks/useAuth'

function getInitials(name, username) {
  if (name) {
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  }
  if (username) return username.slice(0, 2).toUpperCase()
  return 'AU'
}

const ROLE_COLORS = {
  1: { bg: '#e8edf4', text: '#1e3a5f', label: 'Auditor' },
  2: { bg: '#fdf8ee', text: '#8d641a', label: 'Team Leader' },
  3: { bg: '#f0fdf4', text: '#166534', label: 'CEA' },
  4: { bg: '#fef2f2', text: '#991b1b', label: 'AAG' },
  5: { bg: '#fef2f2', text: '#7f1d1d', label: 'DAG' },
  6: { bg: '#e8edf4', text: '#0f2240', label: 'TSSU' },
  99: { bg: '#0f2240', text: '#ffffff', label: 'Admin' },
}

function PasswordRequirement({ met, label }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      )}
      <span className={['text-xs', met ? 'text-green-700' : 'text-gray-400'].join(' ')}>{label}</span>
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f]"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const roleConfig = ROLE_COLORS[user?.primary_role] || ROLE_COLORS[1]
  const initials = getInitials(user?.full_name, user?.username)

  // Password requirements
  const reqs = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^a-zA-Z0-9]/.test(newPassword),
  }
  const allReqsMet = Object.values(reqs).every(Boolean)
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  async function handleChangePassword(e) {
    e.preventDefault()
    if (!allReqsMet || !passwordsMatch) return
    setChanging(true)
    setError(null)
    setSuccess(false)
    try {
      await api.post('auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      const data = e.response?.data
      setError(
        data?.detail ||
        data?.current_password?.[0] ||
        data?.new_password?.[0] ||
        'Failed to change password.'
      )
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">View your profile information and manage your password</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-xl font-bold text-gray-900">{user?.full_name || user?.username || 'User'}</h2>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: roleConfig.bg, color: roleConfig.text }}
              >
                {user?.role_display || roleConfig.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                <p className="text-sm text-gray-700 font-medium">{user?.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Username</p>
                <p className="text-sm text-gray-700 font-medium font-mono">{user?.username || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Division</p>
                <p className="text-sm text-gray-700 font-medium">{user?.division_name || user?.division || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Staff ID</p>
                <p className="text-sm text-gray-700 font-medium font-mono">{user?.staff_id || user?.employee_id || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-base font-semibold text-[#1e3a5f] mb-1">Change Password</h3>
        <p className="text-sm text-gray-500 mb-5">Choose a strong password that meets the requirements below.</p>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 mb-4">
            Password changed successfully.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />

          {/* Requirements checklist */}
          {newPassword.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requirements</p>
              <PasswordRequirement met={reqs.length} label="At least 8 characters" />
              <PasswordRequirement met={reqs.uppercase} label="At least one uppercase letter" />
              <PasswordRequirement met={reqs.number} label="At least one number" />
              <PasswordRequirement met={reqs.special} label="At least one special character" />
            </div>
          )}

          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />

          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-red-600">Passwords do not match.</p>
          )}
          {confirmPassword.length > 0 && passwordsMatch && (
            <p className="text-xs text-green-600">Passwords match.</p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={changing || !allReqsMet || !passwordsMatch || !currentPassword}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              {changing ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
