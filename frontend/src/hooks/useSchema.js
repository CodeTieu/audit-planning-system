import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

/** Fetch a workpaper schema by code. Cached for the session. */
export default function useSchema(code) {
  return useQuery({
    queryKey: ['schema', code],
    queryFn: async () => {
      const res = await api.get(`workpapers/schema/${encodeURIComponent(code)}/`)
      return res.data
    },
    enabled: !!code,
    staleTime: 1000 * 60 * 30,
  })
}
