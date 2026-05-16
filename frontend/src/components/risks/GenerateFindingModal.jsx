import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { Modal, Button } from '../ui/index'
import api from '../../lib/api'

// Map source document to relevant ISSAI reference
const ISSAI_REFS = {
  UE1: 'Per ISSAI 2315, the auditor shall identify and assess the risks of material misstatement through understanding the entity and its environment.',
  UE2: 'Per ISSAI 2240, the auditor shall evaluate whether the overall presentation of the financial statements is consistent with the auditor\'s understanding of the entity.',
  UE3: 'Per ISSAI 2250, the auditor shall consider the effect of identified or suspected non-compliance with laws and regulations on the financial statements.',
  UE4: 'Per ISSAI 2520, the auditor shall design and perform analytical procedures near the end of the audit that assist in forming an overall conclusion about the financial statements.',
  UE5: 'Per ISSAI 2315, management shall maintain adequate internal controls to prevent, detect, and correct material misstatements on a timely basis.',
  UE6: 'Per ISSAI 2402, the auditor shall obtain sufficient understanding of the nature of the services provided by the service organisation.',
  UE7: 'Per ISSAI 2550, the auditor shall design and perform audit procedures responsive to identified related party risks.',
  UE8: 'Per ISSAI 2560, the auditor shall perform audit procedures to obtain sufficient appropriate audit evidence that all subsequent events requiring adjustment or disclosure have been identified.',
  DEFAULT: 'Per ISSAI 2315, the auditor shall identify and assess the risks of material misstatement through understanding the entity and its environment.',
}

function getCriteriaFromSource(sourceDocument) {
  if (!sourceDocument) return ISSAI_REFS.DEFAULT
  const key = sourceDocument.toUpperCase().replace('_', '')
  return ISSAI_REFS[key] || ISSAI_REFS[sourceDocument.toUpperCase()] || ISSAI_REFS.DEFAULT
}

function GenerateFindingModal({ isOpen, onClose, risk, engagementId, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    criteria: '',
    finding_body: '',
    cause: '',
    implication: '',
    recommendation: '',
  })
  const [otherRisks, setOtherRisks] = useState([])
  const [selectedRiskIds, setSelectedRiskIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingRisks, setLoadingRisks] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill form when risk changes
  useEffect(() => {
    if (risk) {
      setForm({
        title: risk.risk_description || '',
        criteria: getCriteriaFromSource(risk.source_document),
        finding_body: '',
        cause: '',
        implication: '',
        recommendation: '',
      })
      setSelectedRiskIds([])
      setError('')
    }
  }, [risk])

  // Load other unlinked risks for this engagement
  useEffect(() => {
    if (!isOpen || !engagementId || !risk) return
    setLoadingRisks(true)
    api.get(`risks/?engagement=${engagementId}&status=active`)
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : res.data.results ?? []
        // Exclude the current risk and risks that already have a finding
        setOtherRisks(all.filter((r) => r.id !== risk.id && !r.finding))
      })
      .catch(() => setOtherRisks([]))
      .finally(() => setLoadingRisks(false))
  }, [isOpen, engagementId, risk])

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const toggleRisk = (riskId) => {
    setSelectedRiskIds((prev) =>
      prev.includes(riskId) ? prev.filter((id) => id !== riskId) : [...prev, riskId]
    )
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('findings/', {
        engagement: engagementId,
        title: form.title,
        criteria: form.criteria,
        finding_body: form.finding_body,
        cause: form.cause,
        implication: form.implication,
        recommendation: form.recommendation,
        initial_risk_ids: [risk.id, ...selectedRiskIds],
      })
      onSuccess(res.data)
      onClose()
    } catch (err) {
      const data = err?.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.values(data).flat().join(' ')
        setError(msgs || 'Failed to save finding.')
      } else {
        setError('Failed to save finding. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generate Audit Finding" size="lg">
      <div className="space-y-4">
        {/* Triggered risk info */}
        {risk && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Triggered from Risk</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-gray-700">{risk.risk_no || risk.risk_ref}</span>
              <SeverityPill severity={risk.severity} />
            </div>
            <p className="text-sm text-gray-700 line-clamp-2">{risk.risk_description}</p>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={handleChange('title')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
            placeholder="Finding title..."
          />
        </div>

        {/* Criteria */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Criteria</label>
          <textarea
            value={form.criteria}
            onChange={handleChange('criteria')}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
            placeholder="Applicable standard or criteria..."
          />
        </div>

        {/* Finding Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Finding Body</label>
          <textarea
            value={form.finding_body}
            onChange={handleChange('finding_body')}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
            placeholder="Describe the condition/situation found..."
          />
        </div>

        {/* Cause / Implication */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cause</label>
            <textarea
              value={form.cause}
              onChange={handleChange('cause')}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
              placeholder="Root cause..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Implication</label>
            <textarea
              value={form.implication}
              onChange={handleChange('implication')}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
              placeholder="Effect/impact..."
            />
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation</label>
          <textarea
            value={form.recommendation}
            onChange={handleChange('recommendation')}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
            placeholder="Recommended action..."
          />
        </div>

        {/* Link additional risks */}
        {otherRisks.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link additional risks? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg p-2">
              {loadingRisks ? (
                <p className="text-xs text-gray-400 py-2 text-center">Loading risks...</p>
              ) : (
                otherRisks.map((r) => (
                  <label key={r.id} className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedRiskIds.includes(r.id)}
                      onChange={() => toggleRisk(r.id)}
                      className="mt-0.5 accent-[#1e3a5f]"
                    />
                    <div>
                      <span className="text-xs font-mono font-semibold text-gray-600 mr-1.5">{r.risk_no || r.risk_ref}</span>
                      <span className="text-xs text-gray-700 line-clamp-1">{r.risk_description}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Finding
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function SeverityPill({ severity }) {
  const s = (severity || '').toLowerCase().replace(/-/g, '_').replace(/ /g, '_')
  const config = {
    high_pervasive: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', label: 'HIGH-PERVASIVE' },
    high: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', label: 'HIGH' },
    medium: { bg: '#fffbeb', text: '#d97706', border: '#fcd34d', label: 'MEDIUM' },
    low: { bg: '#f0fdf4', text: '#16a34a', border: '#86efac', label: 'LOW' },
  }
  const c = config[s] || config.low
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      {c.label}
    </span>
  )
}

export default GenerateFindingModal
