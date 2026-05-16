import { useState, useCallback, useRef, useEffect } from 'react'
import api from '../lib/api'

/**
 * useWorkpaper — manages workpaper state, auto-save, and submission.
 *
 * @param {string|number} engagementId
 * @param {string} docType  — e.g. 'UE1'
 */
export default function useWorkpaper(engagementId, docType) {
  const [workpaper, setWorkpaper] = useState(null)
  const [formData, setFormData] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState(null)

  const workpaperIdRef = useRef(null)
  const formDataRef = useRef({})

  // ── Load or create workpaper ─────────────────────────────────────────────
  useEffect(() => {
    if (!engagementId || !docType) return

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        // Fetch existing workpapers for this engagement + docType
        const res = await api.get(`workpapers/?engagement=${engagementId}`)
        const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
        // Backend returns document_type as code string (SlugRelatedField)
        const docTypeUpper = docType?.toUpperCase()
        const existing = list.find(
          (wp) => (wp.document_type || '').toUpperCase() === docTypeUpper
        )

        if (existing) {
          if (!cancelled) {
            setWorkpaper(existing)
            workpaperIdRef.current = existing.id
            const data = existing.form_data || {}
            setFormData(data)
            formDataRef.current = data
            if (existing.updated_at) {
              setLastSaved(new Date(existing.updated_at).getTime())
            }
          }
        } else {
          // Create a new workpaper
          const createRes = await api.post('workpapers/', {
            engagement: engagementId,
            document_type: docType,
            form_data: {},
          })
          if (!cancelled) {
            setWorkpaper(createRes.data)
            workpaperIdRef.current = createRes.data.id
            setFormData({})
            formDataRef.current = {}
          }
        }
      } catch (err) {
        if (!cancelled) {
          // If API not ready, work offline with empty form
          setError(err?.response?.data?.detail || 'Could not load workpaper. Working offline.')
          setFormData({})
          formDataRef.current = {}
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [engagementId, docType])

  // ── Update a single field ────────────────────────────────────────────────
  const updateField = useCallback((fieldKey, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [fieldKey]: value }
      formDataRef.current = updated
      return updated
    })
    setIsDirty(true)
  }, [])

  // ── Update a whole section (multiple fields at once) ─────────────────────
  const updateSection = useCallback((fields) => {
    setFormData((prev) => {
      const updated = { ...prev, ...fields }
      formDataRef.current = updated
      return updated
    })
    setIsDirty(true)
  }, [])

  // ── Save (PATCH) ─────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    const id = workpaperIdRef.current
    if (!id) return
    setIsSaving(true)
    try {
      const res = await api.patch(`workpapers/${id}/`, {
        form_data: formDataRef.current,
      })
      setWorkpaper(res.data)
      setLastSaved(Date.now())
      setIsDirty(false)
    } catch (err) {
      // Silent fail on auto-save — show stale "Unsaved changes" indicator
      console.warn('Auto-save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [])

  // ── Submit for TL review ─────────────────────────────────────────────────
  const submit = useCallback(async () => {
    const id = workpaperIdRef.current
    if (!id) return
    // First save
    await save()
    setIsSaving(true)
    try {
      const res = await api.post(`workpapers/${id}/submit/`, {})
      setWorkpaper(res.data)
      setLastSaved(Date.now())
      setIsDirty(false)
      return { success: true }
    } catch (err) {
      const message = err?.response?.data?.detail || 'Submission failed.'
      return { success: false, message }
    } finally {
      setIsSaving(false)
    }
  }, [save])

  // ── canSubmit: all required fields filled ────────────────────────────────
  // This is a basic check — pages can override with their own logic
  const canSubmit = !isLoading && !isSaving && workpaper?.status !== 'submitted' &&
    workpaper?.status !== 'tl_approved' && workpaper?.status !== 'locked'

  return {
    workpaper,
    formData,
    updateField,
    updateSection,
    save,
    submit,
    isLoading,
    isSaving,
    lastSaved,
    isDirty,
    canSubmit,
    error,
  }
}
