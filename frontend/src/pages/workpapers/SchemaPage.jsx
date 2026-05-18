import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import useWorkpaper from '../../hooks/useWorkpaper'
import useSchema from '../../hooks/useSchema'
import WorkpaperLayout from '../../components/workpaper/WorkpaperLayout'
import SchemaFormRenderer from '../../components/workpaper/SchemaFormRenderer'
import FindingModal from '../../components/workpaper/FindingModal'

/**
 * Generic, schema-driven workpaper page.
 *
 * Renders any workpaper whose JSON schema lives at workpapers/schemas/<CODE>.json.
 * Use this page in App.jsx via:  <SchemaPage docCode="UE1" />
 *
 * As more schemas are written (UE2, UE3, …), we point each workpaper route
 * at this component with the appropriate docCode. Eventually it replaces
 * every per-form page.
 */
export default function SchemaPage({ docCode }) {
  const { engagementId } = useParams()
  const navigate = useNavigate()
  const [findingModalRisk, setFindingModalRisk] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const { data: schema, isLoading: schemaLoading, error: schemaError } = useSchema(docCode)

  const { data: engagement } = useQuery({
    queryKey: ['engagement', engagementId],
    queryFn: async () => (await api.get(`engagements/${engagementId}/`)).data,
    enabled: !!engagementId,
  })

  const {
    workpaper,
    formData,
    updateField,
    save,
    submit,
    isLoading,
    isSaving,
    lastSaved,
    error,
  } = useWorkpaper(engagementId, docCode)

  // Required-for-submission check driven by schema
  const canSubmitForm = (() => {
    const required = schema?.required_for_submission || []
    return required.every((id) => {
      const v = formData[id]
      return v !== undefined && v !== null && v !== ''
    })
  })()

  const assignment = workpaper
    ? { ...workpaper, status: workpaper.status || 'not_started' }
    : { status: 'not_started' }

  const readOnly = ['submitted', 'tl_approved', 'locked'].includes(workpaper?.status)

  const handleSave = async () => { await save() }

  const handleSubmit = async () => {
    setSubmitError(null)
    const result = await submit()
    if (result?.success === false) {
      setSubmitError(result.message)
    } else {
      setSubmitSuccess(true)
      setTimeout(() => navigate(`/engagements/${engagementId}`), 1800)
    }
  }

  if (isLoading || schemaLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    )
  }

  if (schemaError || !schema) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Schema not available for {docCode}</p>
          <p>This workpaper's schema has not been authored yet. Falling back to the legacy form is not implemented for this code. Contact a developer.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <WorkpaperLayout
        engagement={engagement ? { ...engagement, assignments: [] } : { id: engagementId, assignments: [] }}
        documentType={docCode}
        assignment={assignment}
        onSave={handleSave}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        lastSaved={lastSaved}
        canSubmit={canSubmitForm && !readOnly}
      >
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {error} — Your changes are saved locally.
          </div>
        )}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700 font-medium">
            Workpaper submitted for TL review. Redirecting…
          </div>
        )}

        <SchemaFormRenderer
          schema={schema}
          formData={formData}
          onChange={updateField}
          readOnly={readOnly}
          engagementId={engagementId}
          onGenerateFinding={(risk) => setFindingModalRisk(risk)}
        />
      </WorkpaperLayout>

      <FindingModal
        isOpen={!!findingModalRisk}
        onClose={() => setFindingModalRisk(null)}
        risk={findingModalRisk}
        engagementId={engagementId}
        allRisks={[]}
      />
    </>
  )
}
