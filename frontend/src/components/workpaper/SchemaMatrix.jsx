import { Plus, Trash2 } from 'lucide-react'
import SchemaSelect from './SchemaSelect'

/**
 * Editable matrix: configurable rows × configurable columns, each cell a
 * dropdown sourced from a lookup_code (e.g. competency level).
 *
 * Value shape (stored on the workpaper as the question's id):
 * {
 *   columns: [{ id, label, role }],   // user-added team members
 *   rows:    [...],                    // pre-defined or user-added rows
 *   cells:   { "rowId|colId": "Intermediate", ... }
 * }
 *
 * Props:
 *   row_lookup_code   — lookup providing the row labels
 *   column_role_lookup_code — lookup for the column role dropdown (e.g. TEAM_ROLE)
 *   cell_lookup_code  — lookup for each cell's value (e.g. COMPETENCY_LEVEL)
 *   column_label      — singular label, e.g. "Team Member"
 *   max_columns       — cap on number of columns (default 6)
 */
export default function SchemaMatrix({
  value,
  onChange,
  row_lookup_code,
  column_role_lookup_code,
  cell_lookup_code,
  column_label = 'Team Member',
  max_columns = 6,
  readOnly = false,
}) {
  const state = value && typeof value === 'object' && value.columns
    ? value
    : { columns: [], rows: [], cells: {} }

  const setState = (next) => onChange?.(next)

  // Row list: if row_lookup_code present, rows are static from lookup
  // (we'll fetch from the API via SchemaSelect's hook approach later)
  // For now, allow client-side rows added by auditor.

  const addColumn = () => {
    if (state.columns.length >= max_columns) return
    const id = `c_${Date.now().toString(36)}`
    setState({ ...state, columns: [...state.columns, { id, label: `${column_label} ${state.columns.length + 1}`, role: '' }] })
  }

  const removeColumn = (id) => {
    const cells = { ...state.cells }
    Object.keys(cells).forEach((k) => { if (k.endsWith(`|${id}`)) delete cells[k] })
    setState({ ...state, columns: state.columns.filter((c) => c.id !== id), cells })
  }

  const updateColumn = (id, patch) => {
    setState({ ...state, columns: state.columns.map((c) => c.id === id ? { ...c, ...patch } : c) })
  }

  const addRow = () => {
    const id = `r_${Date.now().toString(36)}`
    setState({ ...state, rows: [...state.rows, { id, label: '' }] })
  }

  const removeRow = (id) => {
    const cells = { ...state.cells }
    Object.keys(cells).forEach((k) => { if (k.startsWith(`${id}|`)) delete cells[k] })
    setState({ ...state, rows: state.rows.filter((r) => r.id !== id), cells })
  }

  const updateRow = (id, patch) => {
    setState({ ...state, rows: state.rows.map((r) => r.id === id ? { ...r, ...patch } : r) })
  }

  const setCell = (rowId, colId, v) => {
    setState({ ...state, cells: { ...state.cells, [`${rowId}|${colId}`]: v } })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="text-xs">
        <thead>
          <tr className="bg-[#1e3a5f]">
            <th className="px-3 py-2.5 text-left text-white font-semibold min-w-[200px]">Competency Aspect</th>
            {state.columns.map((col) => (
              <th key={col.id} className="px-2 py-1.5 text-left text-white font-semibold min-w-[150px]">
                <input
                  type="text"
                  value={col.label}
                  onChange={(e) => !readOnly && updateColumn(col.id, { label: e.target.value })}
                  readOnly={readOnly}
                  className="w-full px-1.5 py-1 text-xs text-gray-900 rounded border border-gray-200 bg-white"
                />
                <div className="mt-1">
                  <SchemaSelect
                    value={col.role}
                    onChange={(v) => updateColumn(col.id, { role: v })}
                    lookupCode={column_role_lookup_code}
                    placeholder="Role…"
                    readOnly={readOnly}
                    className="!py-1 !text-[11px]"
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeColumn(col.id)}
                    className="mt-1.5 text-[10px] text-red-200 hover:text-white hover:underline"
                  >
                    Remove
                  </button>
                )}
              </th>
            ))}
            {!readOnly && state.columns.length < max_columns && (
              <th className="px-2 py-2.5 w-10">
                <button
                  type="button"
                  onClick={addColumn}
                  className="text-white hover:text-amber-200"
                  title={`Add ${column_label}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {state.rows.length === 0 && (
            <tr>
              <td
                colSpan={state.columns.length + (readOnly ? 1 : 2)}
                className="px-3 py-6 text-center text-gray-400 italic"
              >
                No competencies yet.{!readOnly && ' Click "Add competency" to start.'}
              </td>
            </tr>
          )}
          {state.rows.map((row, ri) => (
            <tr key={row.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
              <td className="px-3 py-1.5 align-top">
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => !readOnly && updateRow(row.id, { label: e.target.value })}
                  readOnly={readOnly}
                  placeholder="Competency aspect…"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded outline-none focus:border-[#1e3a5f]"
                />
              </td>
              {state.columns.map((col) => {
                const k = `${row.id}|${col.id}`
                return (
                  <td key={col.id} className="px-2 py-1.5 align-top">
                    <SchemaSelect
                      value={state.cells[k]}
                      onChange={(v) => setCell(row.id, col.id, v)}
                      lookupCode={cell_lookup_code}
                      readOnly={readOnly}
                      placeholder="—"
                      className="!py-1 !text-xs"
                    />
                  </td>
                )
              })}
              {!readOnly && (
                <td className="px-2 py-1.5 align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex gap-3">
          <button
            type="button"
            onClick={addRow}
            className="text-xs text-[#1e3a5f] hover:underline font-medium flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add competency
          </button>
          {state.columns.length < max_columns && (
            <button
              type="button"
              onClick={addColumn}
              className="text-xs text-[#1e3a5f] hover:underline font-medium flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add {column_label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
