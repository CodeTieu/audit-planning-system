const VARIANTS = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
}

function Badge({ variant = 'neutral', label, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        VARIANTS[variant] || VARIANTS.neutral,
        className,
      ].join(' ')}
    >
      {label}
    </span>
  )
}

export default Badge
