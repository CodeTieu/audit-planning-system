import { Trash2, Plus } from 'lucide-react'

// Renders a single cell based on column type
function CellInput({ col, value, onChange, readOnly }) {
  const base = [
    'w-full px-2 py-1.5 text-xs border rounded outline-none transition-colors',
    readOnly
      ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
      : 'border-gray-300 bg-white focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/10',
  ].join(' ')

  switch (col.type) {
    case 'select':
      return (
        <select
          value={value || ''}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          disabled={readOnly}
          className={base}
        >
          <option value="">—</option>
          {(col.options || []).map((opt) => (
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
          className={base}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          readOnly={readOnly}
          className={base}
        />
      )

    case 'text':
    default:
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={col.placeholder || ''}
          className={base}
        />
      )
  }
}

function createEmptyRow(columns) {
  return columns.reduce((acc, col) => {
    acc[col.key] = ''
    return acc
  }, { _id: Date.now() + Math.random() })
}

export default function TableQuestion({
  questionRef,
  columns = [],
  value = [],
  onChange,
  readOnly = false,
}) {
  const rows = Array.isArray(value) ? value : []

  const addRow = () => {
    onChange([...rows, createEmptyRow(columns)])
  }

  const removeRow = (idx) => {
    onChange(rows.filter((_, i) => i !== idx))
  }

  const updateCell = (rowIdx, colKey, cellVal) => {
    const updated = rows.map((row, i) =>
      i === rowIdx ? { ...row, [colKey]: cellVal } : row
    )
    onChange(updated)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1e3a5f]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap"
                style={{ minWidth: col.minWidth || 'auto' }}
              >
                {col.label}
              </th>
            ))}
            {!readOnly && (
              <th className="px-3 py-2.5 w-10" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (readOnly ? 0 : 1)}
                className="px-3 py-6 text-center text-gray-400 italic"
              >
                No rows yet. {!readOnly && 'Click "Add Row" to begin.'}
              </td>
            </tr>
          )}
          {rows.map((row, rowIdx) => (
            <tr
              key={row._id || rowIdx}
              className={[
                'border-t border-gray-100 transition-colors',
                rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60',
                !readOnly ? 'hover:bg-blue-50/30' : '',
              ].join(' ')}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-2 py-1.5 align-top">
                  <CellInput
                    col={col}
                    value={row[col.key]}
                    onChange={(val) => updateCell(rowIdx, col.key, val)}
                    readOnly={readOnly}
                  />
                </td>
              ))}
              {!readOnly && (
                <td className="px-2 py-1.5 align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIdx)}
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add row */}
      {!readOnly && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-[#1e3a5f] hover:underline font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>
      )}
    </div>
  )
}
