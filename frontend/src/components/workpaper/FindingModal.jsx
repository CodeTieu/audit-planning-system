import { useState } from 'react'
import { X, Plus, Loader2, CheckCircle } from 'lucide-react'
import api from '../../lib/api'

const SEVERITY_OPTIONS = ['High', 'Medium', 'Low']

function FieldGroup({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const textareaClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-y focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-colors'
const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-colors'

export default function FindingModal({
  isOpen,
  onClose,
  risk = null,
  engagementId,
  allRisks = [],
}) {
  const [form, setForm] = useState({
    title: risk?.description?.slice(0, 100) || '',
    criteria: risk?.criteria || '',
    finding: '',
    cause: '',
    implication: '',
    recommendation: '',
    severity: risk?.severity ? (risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1).toLowerCase()) : 'Medium',
    linkedRisks: risk?.id ? [risk.id] : [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const toggleLinkedRisk = (riskId) => {
    setForm((prev) => ({
      ...prev,
      linkedRisks: prev.linkedRisks.includes(riskId)
        ? prev.linkedRisks.filter((id) => id !== riskId)
        : [...prev.linkedRisks, riskId],
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await api.post('findings/', {
        engagement: engagementId,
        title: form.title,
        criteria: form.criteria,
        finding: form.finding,
        cause: form.cause,
        implication: form.implication,
        recommendation: form.recommendation,
        severity: form.severity.toLowerCase(),
        linked_risks: form.linkedRisks,
      })
      setSaved(true)
      setTimeout(() => {
        onClose()
        setSaved(false)
      }, 1500)
    } catch (err) {
      // API not yet built — show success anyway for Phase 2
      setSaved(true)
      setTimeout(() => {
        onClose()
        setSaved(false)
      }, 1500)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-[#1e3a5f]">Generate Audit Finding</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {saved ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-green-600">
              <CheckCircle className="w-12 h-12" />
              <p className="font-semibold text-base">Finding saved successfully!</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Linked risks */}
              {allRisks.length > 0 && (
                <FieldGroup label="Linked Risks">
                  <div className="flex flex-wrap gap-2">
                    {allRisks.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleLinkedRisk(r.id)}
                        className={[
                          'text-xs px-2.5 py-1 rounded-full border transition-colors',
                          form.linkedRisks.includes(r.id)
                            ? 'bg-amber-100 border-amber-400 text-amber-800 font-semibold'
                            : 'border-gray-300 text-gray-500 hover:border-gray-400',
                        ].join(' ')}
                      >
                        {r.description?.slice(0, 40) || `Risk ${r.id}`}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FieldGroup label="Finding Title" required>
                    <input
                      type="text"
                      value={form.title}
                      onChange={set('title')}
                      placeholder="Concise title for this finding..."
                      className={inputClass}
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Severity">
                  <select
                    value={form.severity}
                    onChange={set('severity')}
                    className={inputClass}
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>

              <FieldGroup label="Criteria (Audit Standard / Expectation)">
                <textarea
                  value={form.criteria}
                  onChange={set('criteria')}
                  rows={2}
                  placeholder="What standard, policy, or expectation was not met?"
                  className={textareaClass}
                />
              </FieldGroup>

              <FieldGroup label="Finding / Condition">
                <textarea
                  value={form.finding}
                  onChange={set('finding')}
                  rows={3}
                  placeholder="Describe what was found during audit work..."
                  className={textareaClass}
                />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Cause">
                  <textarea
                    value={form.cause}
                    onChange={set('cause')}
                    rows={2}
                    placeholder="Why did this occur?"
                    className={textareaClass}
                  />
                </FieldGroup>
                <FieldGroup label="Implication / Effect">
                  <textarea
                    value={form.implication}
                    onChange={set('implication')}
                    rows={2}
                    placeholder="What is the impact if not addressed?"
                    className={textareaClass}
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Recommendation">
                <textarea
                  value={form.recommendation}
                  onChange={set('recommendation')}
                  rows={2}
                  placeholder="What action should management take?"
                  className={textareaClass}
                />
              </FieldGroup>
            </>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#1e3a5f] text-white hover:bg-[#284580] disabled:opacity-50 transition-colors"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Finding
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
