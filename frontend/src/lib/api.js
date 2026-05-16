import axios from 'axios'

const BASE_URL = 'http://127.0.0.1:8001/api/'

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('aps_access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401 (token refresh) and 423 (locked)
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle account locked
    if (error.response?.status === 423) {
      const message =
        error.response?.data?.detail ||
        'Your account has been locked. Please contact an administrator.'
      // Store the lock message so UI can display it
      window.__apsLockMessage = message
      window.dispatchEvent(new CustomEvent('aps:account-locked', { detail: message }))
      return Promise.reject(error)
    }

    // Handle 401: try token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('aps_refresh_token')

      if (!refreshToken) {
        isRefreshing = false
        clearAuthAndRedirect()
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${BASE_URL}auth/token/refresh/`, {
          refresh: refreshToken,
        })

        const { access, refresh } = response.data
        localStorage.setItem('aps_access_token', access)
        if (refresh) {
          localStorage.setItem('aps_refresh_token', refresh)
        }

        api.defaults.headers.common.Authorization = `Bearer ${access}`
        originalRequest.headers.Authorization = `Bearer ${access}`
        processQueue(null, access)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuthAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

function clearAuthAndRedirect() {
  localStorage.removeItem('aps_access_token')
  localStorage.removeItem('aps_refresh_token')
  localStorage.removeItem('aps_user')
  window.dispatchEvent(new CustomEvent('aps:auth-cleared'))
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

export { api }
export default api
