import { createBrowserRouter, RouterProvider, Navigate, Outlet, useParams } from 'react-router-dom'
import useAuthStore from './store/authStore'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import ProfilePage from './pages/auth/ProfilePage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ManagementDashboardPage from './pages/dashboard/ManagementDashboardPage'
import UsersPage from './pages/admin/UsersPage'
import UserDetailPage from './pages/admin/UserDetailPage'
import LookupsPage from './pages/admin/LookupsPage'
import EngagementsPage from './pages/engagements/EngagementsPage'
import EngagementDetailPage from './pages/engagements/EngagementDetailPage'
import NewEngagementPage from './pages/engagements/NewEngagementPage'
import UE1Page from './pages/workpapers/UE1Page'
import UE2Page from './pages/workpapers/UE2Page'
import UE3Page from './pages/workpapers/UE3Page'
import UE4Page from './pages/workpapers/UE4Page'
import UE5Page from './pages/workpapers/UE5Page'
import UE6_1Page from './pages/workpapers/UE6_1Page'
import UE6_2Page from './pages/workpapers/UE6_2Page'
import UE7Page from './pages/workpapers/UE7Page'
import UE8Page from './pages/workpapers/UE8Page'
import FRFPage from './pages/workpapers/FRFPage'
import PE2Page from './pages/workpapers/PE2Page'
import RA1Page from './pages/workpapers/RA1Page'
import RA2Page from './pages/workpapers/RA2Page'
import SchemaPage from './pages/workpapers/SchemaPage'
import RiskRegisterPage from './pages/risks/RiskRegisterPage'
import FindingsCollectionPage from './pages/findings/FindingsCollectionPage'
import ReviewPanel from './pages/reviews/ReviewPanel'
import ExportPage from './pages/exports/ExportPage'

// ─────────────────────────────────────────────────────────────
// WorkpaperRouter — maps docType → the correct workpaper page
// UE4 and UE5 registered once their files complete building
// ─────────────────────────────────────────────────────────────
// Workpapers that have been migrated to the schema-driven renderer.
// As each form's JSON schema is authored, move its code to this set.
const SCHEMA_DRIVEN_CODES = new Set(['UE1'])

const WORKPAPER_PAGES = {
  FRF:   FRFPage,
  PE2:   PE2Page,
  RA1:   RA1Page,
  RA2:   RA2Page,
  UE1:   UE1Page,
  UE2:   UE2Page,
  UE3:   UE3Page,
  UE4:   UE4Page,
  UE5:   UE5Page,
  UE6_1: UE6_1Page,
  UE6_2: UE6_2Page,
  UE7:   UE7Page,
  UE8:   UE8Page,
}

function WorkpaperRouter() {
  const { docType } = useParams()
  const code = docType?.toUpperCase()

  // Schema-driven path — bypasses the per-form components
  if (code && SCHEMA_DRIVEN_CODES.has(code)) {
    return <SchemaPage docCode={code} />
  }

  const PageComponent = WORKPAPER_PAGES[code]

  if (!PageComponent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: '#e8edf4' }}>
          <svg className="w-8 h-8" style={{ color: '#1e3a5f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#1e3a5f' }}>
          {docType?.toUpperCase()} — Under Development
        </h2>
        <p className="text-gray-500 text-sm">
          This workpaper form will be available in a future release.
        </p>
      </div>
    )
  }

  return <PageComponent />
}

// ─────────────────────────────────────────────────────────────
// Auth Guard — wraps all protected routes
// ─────────────────────────────────────────────────────────────
function AuthGuard() {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // If authenticated but needs password change, force that page
  if (user?.is_first_login || user?.password_expired) {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}

// ─────────────────────────────────────────────────────────────
// Guest Guard — prevents authenticated users from accessing /login
// ─────────────────────────────────────────────────────────────
function GuestGuard() {
  const { isAuthenticated, user } = useAuthStore()

  if (isAuthenticated) {
    if (user?.is_first_login || user?.password_expired) {
      return <Navigate to="/change-password" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

// ─────────────────────────────────────────────────────────────
// Admin Guard — only TSSU (6) or Admin (99)
// ─────────────────────────────────────────────────────────────
function AdminGuard() {
  const { user } = useAuthStore()
  const isAdmin = user?.primary_role === 99 || user?.primary_role >= 6

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

// ─────────────────────────────────────────────────────────────
// CEA Guard — only CEA (3) or above, or Admin (99)
// ─────────────────────────────────────────────────────────────
function CEAGuard() {
  const { user } = useAuthStore()
  const allowed = user?.primary_role >= 3 || user?.primary_role === 99

  if (!allowed) {
    return <Navigate to="/engagements" replace />
  }

  return <Outlet />
}

// ─────────────────────────────────────────────────────────────
// Placeholder pages for future phases
// ─────────────────────────────────────────────────────────────
function PlaceholderPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: '#e8edf4' }}>
        <svg className="w-8 h-8" style={{ color: '#1e3a5f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: '#1e3a5f' }}>{title}</h2>
      <p className="text-gray-500 text-sm">This section is under development and will be available in a future phase.</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Router configuration
// ─────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  // Root redirect
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // Public / guest-only routes
  {
    element: <GuestGuard />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },

  // Change password — accessible when authenticated (even if first login)
  {
    path: '/change-password',
    element: (() => {
      const { isAuthenticated } = useAuthStore.getState()
      return isAuthenticated ? <ChangePasswordPage /> : <Navigate to="/login" replace />
    })(),
  },

  // Protected routes — require authentication + no forced password change
  {
    element: <AuthGuard />,
    children: [
      // ── Workpaper full-screen routes (no AppLayout sidebar) ──
      {
        path: '/engagements/:engagementId/workpapers/:docType',
        element: <WorkpaperRouter />,
      },
      // ── Risk Register full-screen (no AppLayout sidebar) ──
      {
        path: '/engagements/:id/risks',
        element: <RiskRegisterPage />,
      },
      // ── Review Panel full-screen (no AppLayout sidebar) ──
      {
        path: '/engagements/:engagementId/review',
        element: <ReviewPanel />,
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          // Engagements (new must come before :id)
          {
            element: <CEAGuard />,
            children: [
              {
                path: '/engagements/new',
                element: <NewEngagementPage />,
              },
            ],
          },
          {
            path: '/engagements/:id',
            element: <EngagementDetailPage />,
          },
          {
            path: '/engagements/:id/findings',
            element: <FindingsCollectionPage />,
          },
          {
            path: '/engagements/:engagementId/export',
            element: <ExportPage />,
          },
          {
            path: '/engagements',
            element: <EngagementsPage />,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
          // CEA+ routes
          {
            element: <CEAGuard />,
            children: [
              {
                path: '/dashboard/management',
                element: <ManagementDashboardPage />,
              },
            ],
          },
          // Admin-only routes
          {
            element: <AdminGuard />,
            children: [
              {
                path: '/admin',
                element: <Navigate to="/admin/users" replace />,
              },
              {
                path: '/admin/users',
                element: <UsersPage />,
              },
              {
                path: '/admin/users/:id',
                element: <UserDetailPage />,
              },
              {
                path: '/admin/lookups',
                element: <LookupsPage />,
              },
              {
                path: '/users',
                element: <UsersPage />,
              },
            ],
          },
        ],
      },
    ],
  },

  // 404 fallback
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
