import useAuthStore from '../store/authStore'

// Role level constants
export const ROLES = {
  AUDITOR: 1,
  TEAM_LEADER: 2,
  CEA: 3,
  AAG: 4,
  DAG: 5,
  TSSU: 6,
  ADMIN: 99,
}

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuthStore()

  /**
   * Check if the user has a specific role level.
   * Matches primary_role OR any role in all_roles array.
   */
  function hasRole(level) {
    if (!user) return false
    if (user.primary_role === level) return true
    if (Array.isArray(user.all_roles) && user.all_roles.includes(level)) return true
    return false
  }

  /**
   * Check if user has any of the given role levels.
   */
  function hasAnyRole(levels) {
    if (!user) return false
    return levels.some((level) => hasRole(level))
  }

  /**
   * Check if user has a minimum role level (primary_role >= level).
   */
  function hasMinRole(level) {
    if (!user) return false
    return user.primary_role >= level
  }

  /**
   * canSeeAll: TSSU (6), DAG (5), AAG (4) or Admin (99) can see all engagements.
   * Primary role >= 4 or primary role === 99
   */
  const canSeeAll =
    user
      ? user.primary_role >= ROLES.TSSU || user.primary_role === ROLES.ADMIN
      : false

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole,
    hasAnyRole,
    hasMinRole,
    canSeeAll,
  }
}

export default useAuth
