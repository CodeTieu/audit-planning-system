import { useMemo } from 'react'
import FormSection from './FormSection'
import QuestionField from './QuestionField'
import SchemaSelect from './SchemaSelect'
import SchemaSubTable from './SchemaSubTable'
import SchemaMatrix from './SchemaMatrix'
import { evaluateQuestionTriggers, evaluateAllTriggers } from './schemaTriggers'

/**
 * Renders a complete workpaper form from a JSON schema.
 *
 * Props:
 *   schema       — the schema object loaded from /api/workpapers/schema/<code>/
 *   formData     — current form values, keyed by question.id
 *   onChange     — (id, value) => void
 *   readOnly     — boolean
 *   onGenerateFinding — (risk) => void  — passed through to QuestionField
 *   engagementId — pass-through for QuestionField
 */
export default function SchemaFormRenderer({
  schema,
  formData,
  onChange,
  readOnly = false,
  onGenerateFinding,
  engagementId,
}) {
  // Pre-compute triggered risks per question id for fast lookup
  const triggersByQId = useMemo(() => {
    const map = {}
    if (!schema?.sections) return map
    for (const sec of schema.sections) {
      for (const q of (sec.questions || [])) {
        const fired = evaluateQuestionTriggers(q, formData?.[q.id], formData)
        if (fired.length) map[q.id] = fired
      }
    }
    return map
  }, [schema, formData])

  if (!schema) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        No schema loaded.
      </div>
    )
  }

  const handleChange = (id, value) => {
    onChange?.(id, value)
  }

  const evidenceField = (qid) => ({
    evidence: formData?.[`${qid}_evidence`] || {},
    onEvidenceChange: (ev) => handleChange(`${qid}_evidence`, ev),
  })

  function renderQuestion(q, sectionNumber) {
    const value = formData?.[q.id] ?? ''
    const risks = triggersByQId[q.id] || []

    // Table — uses SchemaSubTable directly
    if (q.type === 'table') {
      return (
        <div key={q.id} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                <span className="text-xs font-mono text-gray-400 mr-2">{q.ref}</span>
                {q.text}
              </p>
              {q.guidance && <p className="text-xs text-gray-500 mt-0.5">{q.guidance}</p>}
            </div>
          </div>
          <SchemaSubTable
            columns={q.columns || []}
            value={Array.isArray(value) ? value : []}
            onChange={(rows) => handleChange(q.id, rows)}
            readOnly={readOnly}
          />
          {risks.length > 0 && risks.map((r) => (
            <div key={r.id}
              className="mt-1 px-3 py-2 rounded-lg border text-xs flex items-start gap-2"
              style={{
                backgroundColor: r.severity === 'high' ? '#fef2f2' : '#fffbeb',
                borderColor: r.severity === 'high' ? '#fca5a5' : '#fcd34d',
                color: r.severity === 'high' ? '#991b1b' : '#92400e',
              }}>
              <span className="font-bold">⚠</span>
              <div className="flex-1">
                <p className="font-medium">{r.description}</p>
                {r.pervasive && <p className="text-[10px] opacity-70 mt-0.5">Classification: Pervasive · RA 1</p>}
              </div>
              {onGenerateFinding && (
                <button
                  type="button"
                  onClick={() => onGenerateFinding(r)}
                  className="text-[11px] underline hover:no-underline"
                >
                  Generate finding
                </button>
              )}
            </div>
          ))}
        </div>
      )
    }

    // Select — schema-aware (lookup or inline options)
    if (q.type === 'select') {
      return (
        <div key={q.id} className="space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-gray-400">{q.ref}</span>
            <label className="text-sm text-gray-800 font-medium">
              {q.text}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          </div>
          {q.guidance && <p className="text-xs text-gray-500">{q.guidance}</p>}
          <SchemaSelect
            value={value}
            onChange={(v) => handleChange(q.id, v)}
            lookupCode={q.lookup_code}
            options={q.options}
            readOnly={readOnly}
          />
          {q.evidence_fields && renderPSREC(q)}
        </div>
      )
    }

    // Matrix (rows × columns, each cell a dropdown)
    if (q.type === 'matrix') {
      return (
        <div key={q.id} className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              <span className="text-xs font-mono text-gray-400 mr-2">{q.ref}</span>
              {q.text}
            </p>
            {q.guidance && <p className="text-xs text-gray-500 mt-0.5">{q.guidance}</p>}
          </div>
          <SchemaMatrix
            value={value && typeof value === 'object' ? value : undefined}
            onChange={(v) => handleChange(q.id, v)}
            row_lookup_code={q.row_lookup_code}
            column_role_lookup_code={q.column_role_lookup_code}
            cell_lookup_code={q.cell_lookup_code}
            column_label={q.column_label || 'Team Member'}
            max_columns={q.max_columns || 6}
            readOnly={readOnly}
          />
        </div>
      )
    }

    // Calculated (display-only)
    if (q.type === 'calculated') {
      const calc = q.calculation || 'risk_count_for_workpaper'

      if (calc === 'risk_count_for_workpaper') {
        const allFired = evaluateAllTriggers(schema, formData)
        const count = allFired.length
        return (
          <div key={q.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <span className="text-sm text-gray-700">{q.text}</span>
            <span className={[
              'text-sm font-semibold px-3 py-1 rounded-full',
              count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800',
            ].join(' ')}>
              {count > 0 ? `${count} risk${count !== 1 ? 's' : ''} identified` : 'No risks identified'}
            </span>
          </div>
        )
      }

      if (calc === 'yes_count') {
        // Count Yes answers across specified question ids
        const ids = q.from_questions || []
        const yesCount = ids.filter((id) => String(formData?.[id]).toLowerCase() === 'yes').length
        return (
          <div key={q.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <span className="text-sm text-gray-700">{q.text}</span>
            <span className="text-sm font-semibold text-[#1e3a5f]">{yesCount} / {ids.length}</span>
          </div>
        )
      }

      if (calc === 'weighted_score') {
        // Count Yes answers across from_questions; map to severity bands
        const ids = q.from_questions || []
        const yesCount = ids.filter((id) => String(formData?.[id]).toLowerCase() === 'yes').length
        const bands = q.bands || [
          { max: 1, label: 'Low',    color: '#16a34a' },
          { max: 3, label: 'Medium', color: '#d97706' },
          { max: 99, label: 'High',  color: '#dc2626' },
        ]
        const band = bands.find((b) => yesCount <= b.max) || bands[bands.length - 1]
        return (
          <div key={q.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm text-gray-700">{q.text}</p>
              <p className="text-[11px] text-gray-400">{yesCount} of {ids.length} indicators triggered</p>
            </div>
            <span className="px-3 py-1 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: band.color }}>
              {band.label}
            </span>
          </div>
        )
      }

      return null
    }

    // Default: text / textarea / date / yes_no_na via existing QuestionField
    const typeMap = {
      text: 'text', textarea: 'textarea', date: 'date',
      yes_no_na: 'yes_no_na', narrative: 'textarea',
    }
    const mappedType = typeMap[q.type] || 'text'

    return (
      <QuestionField
        key={q.id}
        questionRef={q.id}
        questionNo={q.ref}
        questionText={q.text}
        type={mappedType}
        isRequired={!!q.required}
        readOnly={readOnly}
        engagementId={engagementId}
        guidance={q.guidance}
        value={value}
        onChange={(v) => handleChange(q.id, v)}
        risks={risks}
        onGenerateFinding={onGenerateFinding}
        {...(q.evidence_fields ? evidenceField(q.id) : {})}
      />
    )
  }

  function renderPSREC(q) {
    const evidence = formData?.[`${q.id}_evidence`] || {}
    const setEv = (ev) => handleChange(`${q.id}_evidence`, ev)
    const fields = [
      { key: 'procedure', label: 'Procedure performed' },
      { key: 'source',    label: 'Source / sample' },
      { key: 'results',   label: 'Results / findings' },
      { key: 'comment',   label: 'Conclusion' },
    ]
    return (
      <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 space-y-2">
        <p className="text-[11px] text-gray-500 uppercase font-medium tracking-wide">
          PSREC documentation (ISSAI 2230)
        </p>
        {fields.map((f) => (
          <textarea
            key={f.key}
            placeholder={f.label}
            value={evidence[f.key] || ''}
            onChange={(e) => setEv({ ...evidence, [f.key]: e.target.value })}
            readOnly={readOnly}
            rows={1}
            className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded outline-none focus:border-[#1e3a5f] resize-y"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#1e3a5f]">{schema.title}</h2>
        {schema.subtitle && <p className="text-sm text-gray-500 mt-0.5">{schema.subtitle}</p>}
        {schema.issai_reference && (
          <p className="text-[11px] text-gray-400 mt-1 italic">{schema.issai_reference}</p>
        )}
        {schema.psrec_note && (
          <p className="text-xs text-gray-500 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded">
            {schema.psrec_note}
          </p>
        )}
      </div>

      {/* Sections */}
      {schema.sections.map((sec) => (
        <FormSection
          key={sec.id}
          title={sec.title}
          sectionCode={sec.id}
          sectionNumber={sec.number}
        >
          {sec.guidance && (
            <p className="text-xs text-gray-500 -mt-2 mb-3">{sec.guidance}</p>
          )}
          <div className="space-y-4">
            {(sec.questions || []).map((q) => renderQuestion(q, sec.number))}
          </div>
        </FormSection>
      ))}
    </div>
  )
}
