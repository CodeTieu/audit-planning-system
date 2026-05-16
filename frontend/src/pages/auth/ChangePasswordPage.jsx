import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'

function CheckIcon({ met }) {
  return met ? (
    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { level: 1, label: 'Weak', color: '#991b1b' }
  if (score === 2) return { level: 2, label: 'Fair', color: '#92400e' }
  if (score === 3) return { level: 3, label: 'Good', color: '#166534' }
  return { level: 4, label: 'Strong', color: '#166534' }
}

function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'At least one number', met: /[0-9]/.test(newPassword) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(newPassword) },
  ]

  const allRequirementsMet = requirements.every((r) => r.met)
  const strength = getPasswordStrength(newPassword)
  const strengthBarWidths = ['0%', '25%', '50%', '75%', '100%']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!currentPassword) {
      setError('Please enter your current password.')
      return
    }
    if (!allRequirementsMet) {
      setError('New password does not meet all requirements.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const response = await api.patch('auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })

      // Update user state if API returns updated user
      if (response.data?.user) {
        setUser(response.data.user)
      } else if (user) {
        // Clear the first_login / password_expired flags locally
        setUser({ ...user, is_first_login: false, password_expired: false })
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (data?.current_password) {
        setError(`Current password: ${data.current_password[0] || data.current_password}`)
      } else if (data?.new_password) {
        setError(`New password: ${data.new_password[0] || data.new_password}`)
      } else if (data?.detail) {
        setError(data.detail)
      } else if (data?.non_field_errors) {
        setError(data.non_field_errors[0])
      } else {
        setError('Failed to change password. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const inputFocusStyle = (e) => {
    e.target.style.borderColor = '#1e3a5f'
    e.target.style.boxShadow = '0 0 0 3px rgba(30,58,95,0.15)'
  }
  const inputBlurStyle = (e) => {
    e.target.style.borderColor = ''
    e.target.style.boxShadow = ''
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: '#f8fafc' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white font-bold text-2xl mb-4 shadow-lg"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            APS
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
            {user?.is_first_login ? 'Set Your Password' : 'Change Password'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.is_first_login
              ? 'Welcome! Please set a new password to continue.'
              : 'Your password has expired. Please set a new password.'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* Notice banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg mb-6 bg-amber-50 border border-amber-200">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              {user?.is_first_login
                ? 'For security, you must change your password on first login.'
                : 'Your password has expired and must be changed before continuing.'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg mb-5 bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Current password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter your current password"
                  autoFocus
                  className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition disabled:opacity-50"
                  onFocus={inputFocusStyle}
                  onBlur={inputBlurStyle}
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  <EyeIcon open={showCurrent} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 pt-1" />

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition disabled:opacity-50"
                  onFocus={inputFocusStyle}
                  onBlur={inputBlurStyle}
                />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  <EyeIcon open={showNew} />
                </button>
              </div>

              {/* Strength indicator */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Password strength</span>
                    <span className="text-xs font-medium" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: strengthBarWidths[strength.level],
                        backgroundColor: strength.color,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Requirements checklist */}
              <ul className="mt-3 space-y-1.5">
                {requirements.map((req) => (
                  <li key={req.label} className="flex items-center gap-2">
                    <CheckIcon met={req.met} />
                    <span className={`text-xs ${req.met ? 'text-green-700' : 'text-gray-500'}`}>
                      {req.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition disabled:opacity-50"
                  onFocus={inputFocusStyle}
                  onBlur={inputBlurStyle}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match.</p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-600 mt-1">Passwords match.</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              style={{ backgroundColor: '#1e3a5f' }}
              onMouseEnter={(e) => { if (!isLoading) e.target.style.backgroundColor = '#284580' }}
              onMouseLeave={(e) => { e.target.style.backgroundColor = '#1e3a5f' }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                'Set New Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChangePasswordPage
