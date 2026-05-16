import { useState, useEffect } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const SEVERITY_CONFIG = {
  high:   { label: 'HIGH',   classes: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'MEDIUM', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:    { label: 'LOW',    classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
}

function RiskItem({ risk, engagementId, onGenerateFinding }) {
  const navigate = useNavigate()
  const severityCfg = SEVERITY_CONFIG[risk.severity?.toLowerCase()] || SEVERITY_CONFIG.medium
  const description = risk.description || risk.name || 'Risk identified'
  const truncated = description.length > 120 ? description.slice(0, 120) + '…' : description

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={['text-xs font-bold px-1.5 py-0.5 rounded border', severityCfg.classes].join(' ')}>
            {severityCfg.label}
          </span>
          {risk.pervasive && (
            <span className="text-xs text-amber-700 font-medium">· Pervasive</span>
          )}
        </div>
        <p className="text-xs text-amber-900 leading-relaxed">{truncated}</p>
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate(`/engagements/${engagementId}?tab=risks`)}
          className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          View in Risk Register
        </button>
        <button
          type="button"
          onClick={() => onGenerateFinding && onGenerateFinding(risk)}
          className="flex items-center gap-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-2 py-0.5 rounded transition-colors"
        >
          + Generate Finding
        </button>
      </div>
    </div>
  )
}

export default function RiskBanner({ risks = [], engagementId, onGenerateFinding }) {
  const [collapsed, setCollapsed] = useState(false)

  // Auto-collapse after 5 seconds
  useEffect(() => {
    if (risks.length === 0) return
    const timer = setTimeout(() => setCollapsed(true), 5000)
    return () => clearTimeout(timer)
  }, [risks.length])

  if (!risks || risks.length === 0) return null

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 hover:bg-amber-100 transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        {risks.length} risk{risks.length !== 1 ? 's' : ''} triggered
        <ChevronDown className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 border border-amber-200 overflow-hidden">
      {/* Banner header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-800">
            {risks.length === 1 ? 'Risk Triggered' : `${risks.length} Risks Triggered`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-amber-500 hover:text-amber-700 transition-colors"
          title="Collapse"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Risk items */}
      <div className="px-3 py-2.5 space-y-3">
        {risks.map((risk, idx) => (
          <div key={risk.id || risk.riskId || idx}>
            {idx > 0 && <div className="border-t border-amber-200 my-2" />}
            <RiskItem
              risk={risk}
              engagementId={engagementId}
              onGenerateFinding={onGenerateFinding}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
