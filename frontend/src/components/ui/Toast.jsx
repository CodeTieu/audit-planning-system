import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const TOAST_STYLES = {
  success: {
    container: 'bg-white border-l-4 border-green-500',
    icon: <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />,
    title: 'text-green-800',
  },
  error: {
    container: 'bg-white border-l-4 border-red-500',
    icon: <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
    title: 'text-red-800',
  },
  info: {
    container: 'bg-white border-l-4 border-blue-500',
    icon: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
    title: 'text-blue-800',
  },
  warning: {
    container: 'bg-white border-l-4 border-amber-500',
    icon: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    title: 'text-amber-800',
  },
}

function ToastItem({ toast, onRemove }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
  return (
    <div
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg min-w-64 max-w-sm',
        style.container,
      ].join(' ')}
    >
      {style.icon}
      <p className={['text-sm font-medium flex-1', style.title].join(' ')}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

export { ToastContainer }
export default ToastContainer
