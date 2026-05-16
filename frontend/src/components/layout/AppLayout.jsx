import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import useAuth from '../../hooks/useAuth'
import useSessionTimeout from '../../hooks/useSessionTimeout'

function SessionWarningModal({ secondsRemaining, onExtend, onLogout }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Session Expiring Soon
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              Your session will expire due to inactivity.
            </p>
            <p className="text-sm text-gray-500">
              Time remaining:{' '}
              <span className="font-semibold text-amber-600">
                {secondsRemaining} second{secondsRemaining !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onExtend}
            className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: '#1e3a5f' }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = '#284580')}
            onMouseLeave={(e) => (e.target.style.backgroundColor = '#1e3a5f')}
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogout}
            className="flex-1 px-4 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { showWarning, secondsRemaining, extendSession } = useSessionTimeout()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col ml-60">
        {/* Top header bar */}
        <header
          className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold" style={{ color: '#1e3a5f' }}>
              Audit Planning System
            </h1>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-sm text-gray-500">
              Office of the Controller and Auditor General
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Session timeout warning modal */}
      {showWarning && (
        <SessionWarningModal
          secondsRemaining={secondsRemaining}
          onExtend={extendSession}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}

export default AppLayout
