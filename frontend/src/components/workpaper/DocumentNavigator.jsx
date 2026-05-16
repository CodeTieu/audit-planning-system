import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Paperclip, AlertTriangle, FileText } from 'lucide-react'

// All 13 workpaper documents in order
const DOCUMENTS = [
  { docType: 'UE1', shortName: 'UE1 — General Information', order: 1 },
  { docType: 'UE2', shortName: 'UE2 — Governance', order: 2 },
  { docType: 'UE3', shortName: 'UE3 — Legal Framework', order: 3 },
  { docType: 'UE4', shortName: 'UE4 — Internal Controls', order: 4 },
  { docType: 'UE5', shortName: 'UE5 — Budget & Finance', order: 5 },
  { docType: 'UE6', shortName: 'UE6 — HR & Payroll', order: 6 },
  { docType: 'UE7', shortName: 'UE7 — Procurement', order: 7 },
  { docType: 'UE8', shortName: 'UE8 — Assets', order: 8 },
  { docType: 'UE9', shortName: 'UE9 — Revenue', order: 9 },
  { docType: 'AP1', shortName: 'AP1 — Audit Strategy', order: 10 },
  { docType: 'AP2', shortName: 'AP2 — Materiality', order: 11 },
  { docType: 'AP3', shortName: 'AP3 — Risk Assessment', order: 12 },
  { docType: 'AP4', shortName: 'AP4 — Audit Programme', order: 13 },
]

const STATUS_CONFIG = {
  submitted:   { icon: '✅', label: 'Submitted',   classes: 'bg-green-100 text-green-700' },
  tl_approved: { icon: '✅', label: 'Approved',     classes: 'bg-green-100 text-green-700' },
  finalized:   { icon: '✅', label: 'Finalized',    classes: 'bg-green-100 text-green-700' },
  in_progress: { icon: '🔄', label: 'In Progress',  classes: 'bg-blue-100 text-blue-700' },
  not_started: { icon: '📝', label: 'Not Started',  classes: 'bg-gray-100 text-gray-500' },
  locked:      { icon: '🔒', label: 'Locked',       classes: 'bg-gray-100 text-gray-400' },
  returned:    { icon: '↩', label: 'Returned',      classes: 'bg-red-100 text-red-600' },
}

function getDocStatus(docType, assignments) {
  if (!assignments) return 'not_started'
  const assignment = assignments.find((a) => a.document_type === docType || a.doc_type === docType)
  return assignment?.status || 'not_started'
}

function isDocLocked(docType, assignments) {
  const assignment = assignments?.find((a) => a.document_type === docType || a.doc_type === docType)
  return assignment?.is_locked || assignment?.status === 'locked'
}

function getPrevDocName(docType) {
  const idx = DOCUMENTS.findIndex((d) => d.docType === docType)
  if (idx <= 0) return null
  return DOCUMENTS[idx - 1].shortName
}

export default function DocumentNavigator({ engagementId, currentDocType, assignments = [], onNavigate }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const submittedCount = DOCUMENTS.filter((d) => {
    const status = getDocStatus(d.docType, assignments)
    return ['submitted', 'tl_approved', 'finalized'].includes(status)
  }).length

  const progress = Math.round((submittedCount / DOCUMENTS.length) * 100)

  const handleDocClick = (doc) => {
    const locked = isDocLocked(doc.docType, assignments)
    if (locked) return
    if (onNavigate) {
      onNavigate(doc.docType)
    } else {
      navigate(`/engagements/${engagementId}/workpapers/${doc.docType}`)
    }
  }

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col items-center pt-4 border-r border-gray-200 bg-white">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
          title="Expand navigator"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="mt-4 flex flex-col gap-1.5">
          {DOCUMENTS.map((doc) => {
            const status = getDocStatus(doc.docType, assignments)
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started
            const isCurrent = doc.docType === currentDocType
            return (
              <button
                key={doc.docType}
                onClick={() => handleDocClick(doc)}
                title={doc.shortName}
                className={[
                  'w-7 h-7 rounded text-xs font-bold transition-colors flex items-center justify-center',
                  isCurrent ? 'bg-[#1e3a5f] text-white' : 'text-gray-400 hover:bg-gray-100',
                ].join(' ')}
              >
                {doc.order}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-60 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        <span className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide">Documents</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
          title="Collapse"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto py-2">
        {DOCUMENTS.map((doc) => {
          const status = getDocStatus(doc.docType, assignments)
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started
          const isCurrent = doc.docType === currentDocType
          const locked = isDocLocked(doc.docType, assignments)
          const prevDocName = locked ? getPrevDocName(doc.docType) : null

          return (
            <div key={doc.docType} className="relative group">
              <button
                onClick={() => handleDocClick(doc)}
                disabled={locked}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors',
                  isCurrent
                    ? 'bg-[#1e3a5f] text-white'
                    : locked
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="text-base leading-none flex-shrink-0">{cfg.icon}</span>
                <span className={['text-xs leading-snug flex-1 min-w-0 truncate', isCurrent ? 'font-semibold' : 'font-medium'].join(' ')}>
                  {doc.shortName}
                </span>
                {!isCurrent && (
                  <span className={[
                    'text-xs px-1.5 py-0.5 rounded-full flex-shrink-0',
                    isCurrent ? 'bg-white/20 text-white' : cfg.classes,
                  ].join(' ')}>
                    {cfg.label}
                  </span>
                )}
              </button>

              {/* Locked tooltip */}
              {locked && prevDocName && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20 hidden group-hover:block">
                  <div className="bg-gray-800 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg">
                    Waiting for {prevDocName} to be submitted
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3 space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{submittedCount} / {DOCUMENTS.length}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Quick links */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => navigate(`/engagements/${engagementId}?tab=documents`)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1e3a5f] transition-colors px-1 py-0.5"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Attachments
          </button>
          <button
            onClick={() => navigate(`/engagements/${engagementId}?tab=risks`)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1e3a5f] transition-colors px-1 py-0.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Risks
          </button>
          <button
            onClick={() => navigate(`/engagements/${engagementId}?tab=findings`)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1e3a5f] transition-colors px-1 py-0.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Findings
          </button>
        </div>
      </div>
    </div>
  )
}
