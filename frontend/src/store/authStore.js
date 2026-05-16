import { create } from 'zustand'
import api from '../lib/api'

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'aps_access_token',
  REFRESH_TOKEN: 'aps_refresh_token',
  USER: 'aps_user',
}

// Helper: load from localStorage
function loadFromStorage() {
  try {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
    const userRaw = localStorage.getItem(STORAGE_KEYS.USER)
    const user = userRaw ? JSON.parse(userRaw) : null
    return { accessToken, refreshToken, user }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

// Rehydrate initial state from localStorage
const stored = loadFromStorage()

const useAuthStore = create((set, get) => ({
  // State
  user: stored.user,
  accessToken: stored.accessToken,
  refreshToken: stored.refreshToken,
  isAuthenticated: !!(stored.accessToken && stored.user),
  isLoading: false,

  // Actions
  login: async (credentials) => {
    set({ isLoading: true })
    try {
      const response = await api.post('auth/login/', credentials)
      const { access, refresh, user } = response.data

      // Persist to localStorage
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access)
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh)
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))

      set({
        user,
        accessToken: access,
        refreshToken: refresh,
        isAuthenticated: true,
        isLoading: false,
      })

      return { success: true, user }
    } catch (error) {
      set({ isLoading: false })
      const status = error.response?.status
      const data = error.response?.data
      throw { status, data, originalError: error }
    }
  },

  logout: async () => {
    const { refreshToken } = get()
    try {
      if (refreshToken) {
        await api.post('auth/logout/', { refresh: refreshToken })
      }
    } catch {
      // Silently ignore errors — we're logging out regardless
    } finally {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.USER)
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  setUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
    set({ user })
  },

  updateTokens: (access, refresh) => {
    if (access) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access)
    if (refresh) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh)
    set((state) => ({
      accessToken: access ?? state.accessToken,
      refreshToken: refresh ?? state.refreshToken,
    }))
  },

  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER)
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },
}))

export default useAuthStore
