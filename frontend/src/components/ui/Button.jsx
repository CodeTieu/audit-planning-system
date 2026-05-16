import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-[#1e3a5f] text-white hover:bg-[#284580] border border-transparent disabled:bg-[#1e3a5f]/50',
  secondary: 'bg-white text-[#1e3a5f] border border-gray-300 hover:bg-gray-50 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent disabled:bg-red-400',
  ghost: 'bg-transparent text-[#1e3a5f] border border-transparent hover:bg-gray-100 disabled:opacity-50',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-lg',
}

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer',
        'disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
      {children}
    </button>
  )
}

export default Button
