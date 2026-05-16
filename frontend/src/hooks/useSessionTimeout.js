import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../lib/api'
import useAuthStore from '../store/authStore'

const TIMEOUT_DURATION = 5 * 60 * 1000       // 5 minutes in ms
const WARNING_BEFORE = 60 * 1000              // Show warning 60s before timeout
const HEARTBEAT_INTERVAL = 60 * 1000          // Heartbeat every 60s
const WARNING_AT = TIMEOUT_DURATION - WARNING_BEFORE // 4 minutes

export function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuthStore()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(60)

  const lastActivityRef = useRef(Date.now())
  const timeoutTimerRef = useRef(null)
  const warningTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)
  const heartbeatTimerRef = useRef(null)

  const sendHeartbeat = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      await api.post('auth/heartbeat/')
    } catch {
      // Ignore heartbeat errors
    }
  }, [isAuthenticated])

  const clearAllTimers = useCallback(() => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
  }, [])

  const startCountdown = useCallback(() => {
    setSecondsRemaining(60)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const scheduleTimers = useCallback(() => {
    clearAllTimers()

    // Warning timer: show warning at 4 minute mark
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      startCountdown()
    }, WARNING_AT)

    // Logout timer: auto-logout at 5 minutes
    timeoutTimerRef.current = setTimeout(() => {
      setShowWarning(false)
      logout()
    }, TIMEOUT_DURATION)

    // Heartbeat: every 60 seconds
    heartbeatTimerRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current
      if (timeSinceActivity < HEARTBEAT_INTERVAL) {
        sendHeartbeat()
      }
    }, HEARTBEAT_INTERVAL)
  }, [clearAllTimers, logout, sendHeartbeat, startCountdown])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    setShowWarning(false)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    scheduleTimers()
  }, [scheduleTimers])

  const extendSession = useCallback(() => {
    sendHeartbeat()
    resetTimer()
  }, [sendHeartbeat, resetTimer])

  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers()
      setShowWarning(false)
      return
    }

    scheduleTimers()

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

    const handleActivity = () => {
      lastActivityRef.current = Date.now()
      if (showWarning) return // Don't reset while warning is showing
      resetTimer()
    }

    activityEvents.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    )

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      )
      clearAllTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  return {
    showWarning,
    secondsRemaining,
    extendSession,
  }
}

export default useSessionTimeout
