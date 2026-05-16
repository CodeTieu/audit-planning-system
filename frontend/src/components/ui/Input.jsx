import { forwardRef } from 'react'

const Input = forwardRef(function Input(
  { label, error, helperText, className = '', id, ...rest },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[
          'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors',
          'placeholder:text-gray-400',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-gray-300 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10',
          'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
        {...rest}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!error && helperText && <p className="text-xs text-gray-400">{helperText}</p>}
    </div>
  )
})

export default Input
