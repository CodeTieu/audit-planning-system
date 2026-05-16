import { useState, useEffect } from 'react'
import { Eye, EyeOff, Save } from 'lucide-react'
import api from '../../lib/api'

const TABS = [
  { id: 'export', label: 'Export Settings' },
  { id: 'sequence', label: 'Document Sequence' },
]

// ── Export Settings Tab ───────────────────────────────────────────────────────

function buildPreview(pattern, settings) {
  if (!pattern) return 'ENG-2025-0001_UE-1_Entity_Name_2025.xlsx'
  return pattern
    .replace('{code}', 'ENG-2025-0001')
    .replace('{doc}', 'UE-1')
    .replace('{entity}', settings.entity_name || 'Entity_Name')
    .replace('{year}', settings.audit_year || '2025')
    + '.xlsx'
}

function ExportSettingsTab() {
  const [settings, setSettings] = useState({
    naming_pattern: '{code}_{doc}_{entity}_{year}',
    excel_password: '',
    entity_name: 'Entity_Name',
    audit_year: '2025',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('exports/settings/')
      .then((res) => {
        if (res.data) {
          setSettings((prev) => ({ ...prev, ...res.data }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.patch('exports/settings/', {
        naming_pattern: settings.naming_pattern,
        excel_password: settings.excel_password,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    )
  }

  const preview = buildPreview(settings.naming_pattern, settings)

  return (
    <div className="max-w-xl space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">Settings saved successfully.</div>
      )}

      {/* Naming Pattern */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          File Naming Pattern
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Variables: <code className="bg-gray-100 rounded px-1">{'{code}'}</code>{' '}
          <code className="bg-gray-100 rounded px-1">{'{doc}'}</code>{' '}
          <code className="bg-gray-100 rounded px-1">{'{entity}'}</code>{' '}
          <code className="bg-gray-100 rounded px-1">{'{year}'}</code>
        </p>
        <input
          type="text"
          value={settings.naming_pattern}
          onChange={(e) => setSettings((prev) => ({ ...prev, naming_pattern: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f] font-mono"
          placeholder="{code}_{doc}_{entity}_{year}"
        />

        {/* Live preview */}
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Preview</p>
          <p className="text-sm font-mono text-[#1e3a5f] break-all">{preview}</p>
        </div>
      </div>

      {/* Excel Password */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Excel Password
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Applied to all exported Excel workpapers.
        </p>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={settings.excel_password}
            onChange={(e) => setSettings((prev) => ({ ...prev, excel_password: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            placeholder="Enter password..."
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: '#1e3a5f' }}
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}

// ── Document Sequence Tab ─────────────────────────────────────────────────────

function DocumentSequenceTab() {
  const [docTypes, setDocTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('document-types/')
      .then((res) => {
        const data = res.data
        setDocTypes(Array.isArray(data) ? data : data.results ?? [])
      })
      .catch(() => setDocTypes([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
        Document sequence is read-only. Contact a developer to modify document ordering or unlock dependencies.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Seq', 'Code', 'Document Name', 'Category', 'Unlocks After'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : docTypes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    No document types configured.
                  </td>
                </tr>
              ) : (
                docTypes.map((dt, idx) => (
                  <tr key={dt.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">
                      {dt.sequence_number ?? dt.order ?? idx + 1}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold bg-[#e8edf4] text-[#1e3a5f]">
                        {dt.code || dt.document_type || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">
                      {dt.name || dt.document_name || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 capitalize">
                      {dt.category || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs font-mono">
                      {dt.unlocks_after || dt.prerequisite || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main LookupsPage ──────────────────────────────────────────────────────────

export default function LookupsPage() {
  const [activeTab, setActiveTab] = useState('export')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Lookups &amp; Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage system-wide settings and reference data</p>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-[#1e3a5f] text-[#1e3a5f]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'export' && <ExportSettingsTab />}
        {activeTab === 'sequence' && <DocumentSequenceTab />}
      </div>
    </div>
  )
}
