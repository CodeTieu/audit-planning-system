import { useState } from 'react'
import { ChevronDown, ChevronRight, Paperclip } from 'lucide-react'
import RiskBanner from './RiskBanner'
import TableQuestion from './TableQuestion'

// ─── Yes / No / N/A pill buttons ────────────────────────────────────────────
function YesNoNa({ value, onChange, readOnly }) {
  const options = [
    { val: 'yes', label: 'Yes', activeClass: 'bg-green-50 border-green-500 text-green-700 font-semibold' },
    { val: 'no',  label: 'No',  activeClass: 'bg-red-50 border-red-500 text-red-700 font-semibold' },
    { val: 'na',  label: 'N/A', activeClass: 'bg-gray-100 border-gray-400 text-gray-600 font-semibold' },
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(({ val, label, activeClass }) => (
        <button
          key={val}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange(val)}
          className={[
            'px-4 py-1.5 rounded-full border text-sm transition-all',
            value === val
              ? activeClass
              : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:bg-gray-50',
            readOnly ? 'cursor-default' : 'cursor-pointer',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── PSREC Evidence sub-panel ────────────────────────────────────────────────
function EvidencePanel({ evidence = {}, onChange, readOnly }) {
  const [open, setOpen] = useState(false)

  const fields = [
    { key: 'procedure', label: 'Procedure Performed' },
    { key: 'source',    label: 'Source / Sample' },
    { key: 'results',   label: 'Results / Evidence' },
    { key: 'comment',   label: 'Comments' },
  ]

  const hasContent = fields.some((f) => evidence[f.key]?.trim())

  return (
    <div className="mt-2 ml-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          PSREC Evidence Fields
          {hasContent && !open && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">filled</span>
          )}
        </span>
        <span className="text-gray-400">Procedure · Source · Results · Comments</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <textarea
                value={evidence[key] || ''}
                onChange={(e) => onChange({ ...evidence, [key]: e.target.value })}
                readOnly={readOnly}
                rows={2}
                placeholder={`Enter ${label.toLowerCase()}...`}
                className={[
                  'w-full text-xs px-3 py-2 border border-gray-300 rounded-lg resize-y outline-none transition-colors',
                  readOnly
                    ? 'bg-gray-50 text-gray-500 cursor-default'
                    : 'bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10',
                ].join(' ')}
              />
            </div>
          ))}

          {/* Attach Evidence button */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-[#1e3a5f] hover:underline mt-1"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Attach Evidence
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main QuestionField component ────────────────────────────────────────────
export default function QuestionField({
  questionRef,
  questionNo,
  questionText,
  type = 'text',
  options = [],
  columns = [],
  value,
  onChange,
  evidence = {},
  onEvidenceChange,
  isRequired = false,
  risks = [],
  onGenerateFinding,
  guidance,
  readOnly = false,
  engagementId,
}) {
  const [showGuidance, setShowGuidance] = useState(false)

  // Render the actual input control
  const renderInput = () => {
    switch (type) {
      case 'yes_no_na':
        return (
          <YesNoNa
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        )

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            disabled={readOnly}
            className={[
              'w-full max-w-sm px-3 py-2 text-sm border rounded-lg outline-none transition-colors bg-white',
              readOnly
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
                : 'border-gray-300 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10',
            ].join(' ')}
          >
            <option value="">— Select —</option>
            {options.map((opt) => (
              <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
                {typeof opt === 'string' ? opt : opt.label}
              </option>
            ))}
          </select>
        )

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            readOnly={readOnly}
            className={[
              'px-3 py-2 text-sm border rounded-lg outline-none transition-colors',
              readOnly
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
                : 'border-gray-300 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10',
            ].join(' ')}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            readOnly={readOnly}
            className={[
              'w-40 px-3 py-2 text-sm border rounded-lg outline-none transition-colors',
              readOnly
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
                : 'border-gray-300 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10',
            ].join(' ')}
          />
        )

      case 'table':
        return (
          <TableQuestion
            questionRef={questionRef}
            columns={columns}
            value={value || []}
            onChange={onChange}
            readOnly={readOnly}
          />
        )

      case 'text':
      default:
        return (
          <textarea
            value={value || ''}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            readOnly={readOnly}
            rows={3}
            placeholder="Enter response..."
            className={[
              'w-full px-3 py-2 text-sm border rounded-lg resize-y outline-none transition-colors',
              readOnly
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
                : 'border-gray-300 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10',
            ].join(' ')}
          />
        )
    }
  }

  return (
    <div className="relative">
      {/* Question label row */}
      <div className="flex items-start gap-2 mb-2">
        {questionNo && (
          <span className="flex-shrink-0 text-xs font-mono text-gray-400 mt-0.5 w-8">{questionNo}</span>
        )}
        <div className="flex-1">
          <label className="text-sm text-gray-800 leading-snug">
            {questionText}
            {isRequired && (
              <span className="ml-1 text-red-500 font-bold" title="Required">*</span>
            )}
          </label>

          {/* Guidance tooltip toggle */}
          {guidance && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setShowGuidance((p) => !p)}
                className="text-xs text-[#1e3a5f] hover:underline"
              >
                {showGuidance ? 'Hide guidance' : 'Show guidance'}
              </button>
              {showGuidance && (
                <div className="mt-1 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
                  {guidance}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className={questionNo ? 'pl-10' : ''}>
        {renderInput()}

        {/* Risk banners (inline, after input) */}
        {risks && risks.length > 0 && (
          <div className="mt-2">
            <RiskBanner
              risks={risks}
              engagementId={engagementId}
              onGenerateFinding={onGenerateFinding}
            />
          </div>
        )}

        {/* PSREC Evidence panel */}
        {type !== 'table' && onEvidenceChange && (
          <EvidencePanel
            evidence={evidence}
            onChange={onEvidenceChange}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  )
}
