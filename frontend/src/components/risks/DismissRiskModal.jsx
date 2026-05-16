import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal, Button } from '../ui/index'

function DismissRiskModal({ isOpen, onClose, risk, onSuccess }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDismiss = async () => {
    if (!reason.trim() || reason.trim().length < 10) {
      setError('Please provide a reason of at least 10 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onSuccess(reason.trim())
      setReason('')
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to dismiss risk. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setReason('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Dismiss Risk" size="sm">
      <div className="space-y-4">
        {/* Warning */}
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            You are about to dismiss this risk. This action will be recorded in the audit trail.
          </p>
        </div>

        {/* Risk info */}
        {risk && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {risk.risk_no || risk.risk_ref}
            </p>
            <p className="text-sm text-gray-800 line-clamp-3">{risk.risk_description}</p>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for dismissal <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError('') }}
            rows={3}
            placeholder="Explain why this risk is being dismissed (minimum 10 characters)..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          <p className="text-xs text-gray-400 mt-1">{reason.length} characters</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDismiss}
            loading={loading}
            disabled={reason.trim().length < 10}
          >
            Dismiss Risk
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DismissRiskModal
