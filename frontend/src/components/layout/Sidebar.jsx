import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth, ROLES } from '../../hooks/useAuth'

// Icon helpers (inline SVG paths)
const Icons = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  briefcase: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  chart: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  team: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  chevronDown: 'M19 9l-7 7-7-7',
  chevronRight: 'M9 5l7 7-7 7',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
}

function Icon({ path, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

function NavItem({ to, icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        isActive
          ? 'flex items-center gap-3 px-4 py-2.5 rounded-lg text-white bg-[#1e3a5f] font-medium transition-colors'
          : 'flex items-center gap-3 px-4 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors'
      }
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-sm">{label}</span>
    </NavLink>
  )
}

function NavGroup({ icon, label, children, defaultOpen = false, isActive = false }) {
  const [open, setOpen] = useState(defaultOpen || isActive)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
          isActive ? 'text-white' : 'text-white/70 hover:text-white hover:bg-white/10',
        ].join(' ')}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm flex-1 text-left">{label}</span>
        <Icon path={open ? Icons.chevronDown : Icons.chevronRight} className="w-3.5 h-3.5 flex-shrink-0" />
      </button>
      {open && (
        <div className="ml-4 pl-3 border-l border-white/10 mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

function SubNavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'flex items-center px-3 py-2 rounded-lg text-white bg-[#1e3a5f]/60 text-sm font-medium transition-colors'
          : 'flex items-center px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm transition-colors'
      }
    >
      {label}
    </NavLink>
  )
}

function Sidebar({ onLogout }) {
  const { user, hasMinRole, hasAnyRole } = useAuth()
  const location = useLocation()

  const isAdminActive = location.pathname.startsWith('/admin')
  const isEngagementActive = location.pathname.startsWith('/engagements')
  const isAdmin = user?.primary_role === 99 || user?.primary_role >= 6
  const isCEAPlus = hasMinRole(ROLES.CEA)
  const isTLPlus = hasMinRole(ROLES.TEAM_LEADER)

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 flex flex-col z-20"
      style={{ backgroundColor: '#0f2240' }}
    >
      {/* Logo / App Title */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ backgroundColor: '#c9952a' }}
        >
          APS
        </div>
        <div className="overflow-hidden">
          <p className="text-white font-semibold text-sm leading-tight truncate">
            Audit Planning
          </p>
          <p className="text-white/50 text-xs leading-tight truncate">
            System
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* Dashboard — all roles */}
        <NavItem
          to="/dashboard"
          end
          icon={<Icon path={Icons.home} />}
          label="Dashboard"
        />

        {/* Engagements */}
        <NavItem
          to="/engagements"
          icon={<Icon path={Icons.briefcase} />}
          label="Engagements"
        />

        {/* Management Dashboard — CEA+ */}
        {isCEAPlus && (
          <NavItem
            to="/dashboard/management"
            icon={<Icon path={Icons.chart} />}
            label="Management Dashboard"
          />
        )}

        {/* Profile — all roles */}
        <NavItem
          to="/profile"
          icon={<Icon path={Icons.user} />}
          label="Profile"
        />

        {/* Admin group — TSSU / Admin only */}
        {isAdmin && (
          <NavGroup
            icon={<Icon path={Icons.settings} />}
            label="Admin"
            isActive={isAdminActive}
            defaultOpen={isAdminActive}
          >
            <SubNavItem to="/admin/users" label="Users" />
            <SubNavItem to="/admin/lookups" label="Lookups" />
          </NavGroup>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-white/10 px-4 py-4">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              {user.full_name
                ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                : user.username?.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-medium truncate">
                {user.full_name || user.username}
              </p>
              <p className="text-white/50 text-xs truncate">{user.role_display}</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
