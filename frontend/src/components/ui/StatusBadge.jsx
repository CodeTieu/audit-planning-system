const STATUS_MAP = {
  not_started:  { label: 'Not Started',  classes: 'bg-gray-100 text-gray-600' },
  in_progress:  { label: 'In Progress',  classes: 'bg-blue-100 text-blue-700' },
  submitted:    { label: 'Submitted',    classes: 'bg-amber-100 text-amber-700' },
  tl_approved:  { label: 'TL Approved',  classes: 'bg-teal-100 text-teal-700' },
  in_review:    { label: 'In Review',    classes: 'bg-purple-100 text-purple-700' },
  returned:     { label: 'Returned',     classes: 'bg-red-100 text-red-700' },
  finalized:    { label: 'Finalized',    classes: 'bg-green-100 text-green-700' },
  locked:       { label: 'Locked',       classes: 'bg-emerald-800 text-white' },
  active:       { label: 'Active',       classes: 'bg-blue-100 text-blue-700' },
  completed:    { label: 'Completed',    classes: 'bg-green-100 text-green-700' },
  archived:     { label: 'Archived',     classes: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status, className = '' }) {
  const config = STATUS_MAP[status] || { label: status, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        config.classes,
        className,
      ].join(' ')}
    >
      {config.label}
    </span>
  )
}

export default StatusBadge
