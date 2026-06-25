import { type ReactNode } from 'react'

interface DashboardCardProps {
  title?: string
  children: ReactNode
  className?: string
  padding?: boolean
}

export function DashboardCard({
  title,
  children,
  className = '',
  padding = true,
}: DashboardCardProps) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
      )}
      <div className={padding ? 'p-5' : ''}>{children}</div>
    </div>
  )
}
