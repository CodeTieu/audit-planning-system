import { useState, useCallback } from 'react'
import api from '../lib/api'

export function useRisks() {
  const [risks, setRisks] = useState([])
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadRisks = useCallback(async (engagementId) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get(`risks/?engagement=${engagementId}&page_size=200`)
      const data = res.data
      setRisks(Array.isArray(data) ? data : data.results ?? [])
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadSummary = useCallback(async (engagementId) => {
    try {
      const res = await api.get(`risks/summary/?engagement=${engagementId}`)
      setSummary(res.data)
    } catch {
      // non-critical
    }
  }, [])

  const dismissRisk = useCallback(async (riskId, reason) => {
    const res = await api.post(`risks/${riskId}/dismiss/`, { reason })
    return res.data
  }, [])

  const restoreRisk = useCallback(async (riskId) => {
    const res = await api.post(`risks/${riskId}/restore/`)
    return res.data
  }, [])

  const refetch = useCallback((engagementId) => {
    loadRisks(engagementId)
    loadSummary(engagementId)
  }, [loadRisks, loadSummary])

  return {
    risks,
    summary,
    isLoading,
    error,
    loadRisks,
    loadSummary,
    dismissRisk,
    restoreRisk,
    refetch,
  }
}

export default useRisks
