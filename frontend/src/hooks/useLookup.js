import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

/**
 * Fetch values for a single lookup category by code (e.g. 'ENTITY_TYPE').
 * Cached aggressively — lookups change rarely.
 *
 * Returns: { data: [{value, label, extra, ...}], isLoading }
 */
export default function useLookup(code, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['lookup', code],
    queryFn: async () => {
      if (!code) return []
      const res = await api.get(`lookups/?code=${encodeURIComponent(code)}`)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!code && enabled,
    staleTime: 1000 * 60 * 30,        // 30 min
    gcTime:    1000 * 60 * 60 * 4,    // 4 hours
  })
}
