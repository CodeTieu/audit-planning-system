import useLookup from '../../hooks/useLookup'

/**
 * Select-like dropdown that pulls options from either:
 *   - inline `options` (array of strings or {value,label} objects), or
 *   - `lookupCode` which fetches values from /api/lookups/?code=...
 */
export default function SchemaSelect({
  value,
  onChange,
  options,
  lookupCode,
  placeholder = '— Select —',
  readOnly = false,
  className = '',
}) {
  const { data: lookupValues = [], isLoading } = useLookup(lookupCode, { enabled: !!lookupCode })

  const allOptions = lookupCode
    ? lookupValues.map((v) => ({ value: v.value, label: v.label || v.value }))
    : (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

  return (
    <select
      value={value ?? ''}
      onChange={(e) => !readOnly && onChange(e.target.value)}
      disabled={readOnly || isLoading}
      className={[
        'w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none transition-colors',
        readOnly
          ? 'bg-gray-50 text-gray-500 cursor-default'
          : 'bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10',
        className,
      ].join(' ')}
    >
      <option value="">{isLoading ? 'Loading…' : placeholder}</option>
      {allOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
