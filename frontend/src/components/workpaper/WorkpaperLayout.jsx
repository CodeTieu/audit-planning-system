import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, CheckCircle, Loader2, Clock } from 'lucide-react'
import DocumentNavigator from './DocumentNavigator'
import { StatusBadge } from '../ui/index'

const DOC_TITLES = {
  UE1: 'UE1 — General Information',
  UE2: 'UE2 — Governance Review',
  UE3: 'UE3 — Legal Framework',
  UE4: 'UE4 — Internal Controls',
  UE5: 'UE5 — Budget & Finance',
  UE6: 'UE6 — HR & Payroll',
  UE7: 'UE7 — Procurement',
  UE8: 'UE8 — Assets',
  UE9: 'UE9 — Revenue',
  RA1: 'RA-1 — Pervasive Risk Assessment',
  RA2: 'RA-2 — COTABD-Level Risk Assessment',
  AP1: 'AP1 — Audit Strategy',
  AP2: 'AP2 — Materiality',
  AP3: 'AP3 — Risk Assessment',
  AP4: 'AP4 — Audit Programme',
}

function SaveIndicator({ isSaving, lastSaved }) {
  if (isSaving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Saving...
      </span>
    )
  }
  if (lastSaved) {
    const now = Date.now()
    const diff = Math.floor((now - lastSaved) / 60000)
    const label = diff < 1 ? 'just now' : diff === 1 ? '1 min ago' : `${diff} min ago`
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle className="w-3.5 h-3.5" />
        Saved {label}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400">
      <Clock className="w-3.5 h-3.5" />
      Unsaved changes
    </span>
  )
}

export default function WorkpaperLayout({
  engagement,
  documentType,
  assignment,
  children,
  onSave,
  onSubmit,
  isSaving = false,
  lastSaved = null,
  canSubmit = false,
}) {
  const navigate = useNavigate()
  const autoSaveTimer = useRef(null)

  const docTitle = DOC_TITLES[documentType] || documentType
  const status = assignment?.status || 'not_started'

  // Auto-save every 60 seconds
  useEffect(() => {
    if (!onSave) return
    autoSaveTimer.current = setInterval(() => {
      onSave()
    }, 60000)
    return () => clearInterval(autoSaveTimer.current)
  }, [onSave])

  // Save on blur of any input/textarea/select in the form area
  // This is handled via the onBlur prop passed down through context / children
  // The parent (useWorkpaper) handles field blur saves

  const handleBackToEngagement = () => {
    navigate(`/engagements/${engagement?.id}`)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#f8fafc' }}>
      {/* Top Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: back + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBackToEngagement}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors flex-shrink-0"
              title="Back to Engagement"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleBackToEngagement}
                  className="text-xs text-gray-400 hover:text-[#1e3a5f] transition-colors truncate"
                >
                  {engagement?.entity_name || engagement?.entity || 'Engagement'}
                </button>
                <span className="text-gray-300 flex-shrink-0">/</span>
                <span className="text-sm font-semibold text-[#1e3a5f] truncate">{docTitle}</span>
                <StatusBadge status={status} />
              </div>
              {engagement?.audit_year && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Audit Year {engagement.audit_year}
                  {engagement.engagement_code ? ` · ${engagement.engagement_code}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Right: save indicator */}
          <div className="flex-shrink-0">
            <SaveIndicator isSaving={isSaving} lastSaved={lastSaved} />
          </div>
        </div>
      </header>

      {/* Body: navigator + form */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document Navigator */}
        <DocumentNavigator
          engagementId={engagement?.id}
          currentDocType={documentType}
          assignments={engagement?.assignments || []}
        />

        {/* Right: Scrollable form content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 pb-24">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom sticky action bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {assignment?.assigned_to_name
              ? `Assigned to: ${assignment.assigned_to_name}`
              : ''}
            {assignment?.deadline
              ? ` · Due: ${new Date(assignment.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
              : ''}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-[#1e3a5f] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </button>
            <button
              onClick={onSubmit}
              disabled={!canSubmit || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#1e3a5f] text-white hover:bg-[#284580] disabled:bg-[#1e3a5f]/40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit for TL Review
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
