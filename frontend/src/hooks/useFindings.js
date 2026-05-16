import { useState, useCallback } from 'react'
import api from '../lib/api'

export function useFindings() {
  const [findings, setFindings] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadFindings = useCallback(async (engagementId) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get(`findings/?engagement=${engagementId}&page_size=200`)
      const data = res.data
      setFindings(Array.isArray(data) ? data : data.results ?? [])
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createFinding = useCallback(async (data) => {
    const res = await api.post('findings/', data)
    return res.data
  }, [])

  const updateFinding = useCallback(async (id, data) => {
    const res = await api.patch(`findings/${id}/`, data)
    return res.data
  }, [])

  const dismissFinding = useCallback(async (id, reason) => {
    const res = await api.post(`findings/${id}/dismiss/`, { reason })
    return res.data
  }, [])

  const linkRisk = useCallback(async (findingId, riskId) => {
    const res = await api.post(`findings/${findingId}/link-risk/`, { risk_id: riskId })
    return res.data
  }, [])

  const unlinkRisk = useCallback(async (findingId, riskId) => {
    const res = await api.delete(`findings/${findingId}/unlink-risk/${riskId}/`)
    return res.data
  }, [])

  const refetch = useCallback((engagementId) => {
    loadFindings(engagementId)
  }, [loadFindings])

  return {
    findings,
    isLoading,
    error,
    loadFindings,
    createFinding,
    updateFinding,
    dismissFinding,
    linkRisk,
    unlinkRisk,
    refetch,
  }
}

export default useFindings
