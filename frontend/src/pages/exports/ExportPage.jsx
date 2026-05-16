import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Download, CheckSquare, Square, Package, RefreshCw } from 'lucide-react'
import api from '../../lib/api'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ChecklistRow({ item, onToggle }) {
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    try {
      await onToggle(item.id, !item.uploaded)
    } finally {
      setLoading(false)
    }
  }

  return (
    <tr className={['transition-colors', item.uploaded ? 'bg-green-50' : 'hover:bg-gray-50'].join(' ')}>
      <td className="px-5 py-3.5 w-10">
        <button
          onClick={handleToggle}
          disabled={loading}
          className="text-[#1e3a5f] disabled:opacity-50 transition-colors"
          title={item.uploaded ? 'Mark as not uploaded' : 'Mark as uploaded'}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
          ) : item.uploaded ? (
            <CheckSquare className="w-4 h-4 text-green-600" />
          ) : (
            <Square className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </td>
      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-gray-500">{item.teammate_ref || item.code || '—'}</td>
      <td className="px-5 py-3.5">
        <span className="text-sm text-gray-800">{item.filename || item.file_name || '—'}</span>
      </td>
      <td className="px-5 py-3.5">
        {item.uploaded ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            Uploaded {item.uploaded_at ? formatDate(item.uploaded_at) : ''}
          </span>
        ) : (
          <button
            onClick={handleToggle}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-[#e8edf4] text-[#1e3a5f] hover:bg-[#d0daea] border border-[#1e3a5f]/20 transition-colors disabled:opacity-50"
          >
            Mark Uploaded
          </button>
        )}
      </td>
    </tr>
  )
}

export default function ExportPage() {
  const { engagementId } = useParams()

  const [engagement, setEngagement] = useState(null)
  const [exportPkg, setExportPkg] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)

  // Use engagementId if available, else fall back to 'id' param
  const id = engagementId

  async function fetchData() {
    setLoading(true)
    try {
      const [engRes] = await Promise.all([
        api.get(`engagements/${id}/`).catch(() => ({ data: null })),
      ])
      setEngagement(engRes.data)

      // Try to find existing export package(s) — backend embeds checklist in response.
      try {
        const pkgRes = await api.get(`exports/?engagement=${id}`)
        const packages = Array.isArray(pkgRes.data) ? pkgRes.data : pkgRes.data?.results ?? []
        if (packages.length > 0) {
          const latest = packages[0]
          setExportPkg(latest)
          setChecklist(latest.checklist || [])
        }
      } catch {
        // No existing package
      }
    } catch (e) {
      setError('Failed to load engagement data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await api.post('exports/generate/', { engagement_id: id })
      const pkg = res.data?.package || res.data
      setExportPkg(pkg)
      setChecklist(pkg?.checklist || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate export package.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleToggle(itemId, uploaded) {
    await api.patch(`exports/checklist/${itemId}/`, { uploaded })
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, uploaded, uploaded_at: uploaded ? new Date().toISOString() : null }
          : item
      )
    )
  }

  async function handleMarkAll() {
    setMarkingAll(true)
    try {
      const unuploaded = checklist.filter((i) => !i.uploaded)
      await Promise.all(unuploaded.map((i) => api.patch(`exports/checklist/${i.id}/`, { uploaded: true })))
      setChecklist((prev) => prev.map((i) => ({ ...i, uploaded: true, uploaded_at: i.uploaded_at || new Date().toISOString() })))
    } finally {
      setMarkingAll(false)
    }
  }

  async function handleDownload() {
    if (!exportPkg?.id) return
    setDownloading(true)
    try {
      const res = await api.get(`exports/packages/${exportPkg.id}/download/`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `export-package-${id}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download package.')
    } finally {
      setDownloading(false)
    }
  }

  const uploadedCount = checklist.filter((i) => i.uploaded).length
  const totalCount = checklist.length

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Export Package</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {engagement?.engagement_code || `ENG-${id}`}
            {engagement?.entity_name ? ` · ${engagement.entity_name}` : ''}
          </p>
        </div>
        {exportPkg && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Preparing...' : 'Download All as ZIP'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Status section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#e8edf4' }}>
            <Package className="w-5 h-5" style={{ color: '#1e3a5f' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1e3a5f]">Export Status</p>
            <p className="text-xs text-gray-500">
              {engagement?.status === 'locked'
                ? 'Engagement locked. Ready for export.'
                : engagement?.status
                ? `Engagement status: ${engagement.status}`
                : 'Checking engagement status...'}
            </p>
          </div>
          <div className="ml-auto">
            <span className={[
              'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
              engagement?.status === 'locked'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700',
            ].join(' ')}>
              {engagement?.status === 'locked' ? 'Ready' : 'Not Ready'}
            </span>
          </div>
        </div>

        {!exportPkg ? (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Generating...
              </span>
            ) : (
              'Generate Export Package'
            )}
          </button>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-700 font-semibold">✓ Package generated</span>
            <span className="text-gray-400">{exportPkg.total_files || checklist.length} files</span>
            <span className="text-gray-400">Generated {formatDate(exportPkg.generated_at || exportPkg.created_at)}</span>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="ml-auto text-xs text-[#1e3a5f] hover:underline disabled:opacity-50"
            >
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        )}
      </div>

      {/* Checklist */}
      {exportPkg && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Checklist header */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide">
                  TeamMate+ Upload Checklist
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Progress: {uploadedCount} / {totalCount} files uploaded
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleMarkAll}
                  disabled={markingAll || uploadedCount === totalCount}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#e8edf4] text-[#1e3a5f] hover:bg-[#d0daea] border border-[#1e3a5f]/20 transition-colors disabled:opacity-50"
                >
                  {markingAll ? 'Marking...' : 'Mark All Uploaded'}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloading ? 'Preparing...' : 'Download as ZIP'}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (uploadedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Checklist table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10"></th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ref</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">File Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {checklist.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-400">
                      No checklist items. Generate the export package to populate this list.
                    </td>
                  </tr>
                ) : (
                  checklist.map((item) => (
                    <ChecklistRow key={item.id} item={item} onToggle={handleToggle} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {checklist.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={handleMarkAll}
                disabled={markingAll || uploadedCount === totalCount}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#e8edf4] text-[#1e3a5f] hover:bg-[#d0daea] border border-[#1e3a5f]/20 transition-colors disabled:opacity-50"
              >
                {markingAll ? 'Marking all...' : 'Mark All Uploaded'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
