import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

let sectionCounter = 0

export default function FormSection({
  title,
  sectionCode,
  children,
  isCollapsible = true,
  defaultOpen = true,
  sectionNumber,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-6">
      {/* Section header */}
      <div
        className={[
          'flex items-center gap-3 mb-4',
          isCollapsible ? 'cursor-pointer select-none group' : '',
        ].join(' ')}
        onClick={isCollapsible ? () => setIsOpen((prev) => !prev) : undefined}
      >
        {sectionNumber !== undefined && (
          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">
            {sectionNumber}
          </span>
        )}
        <h3 className="text-sm font-semibold text-[#1e3a5f] flex-1">
          {sectionCode && (
            <span className="text-gray-400 font-mono text-xs mr-2">[{sectionCode}]</span>
          )}
          {title}
        </h3>
        {isCollapsible && (
          <span className="text-gray-400 group-hover:text-[#1e3a5f] transition-colors">
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
      </div>

      {/* Section content */}
      {isOpen && (
        <div className="space-y-5 pl-0">
          {children}
        </div>
      )}

      {/* Divider */}
      <div className="mt-6 border-t border-gray-200" />
    </div>
  )
}
