import { type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down'; value: string }
  color?: 'brand' | 'success' | 'warning' | 'danger'
  className?: string
}

const COLOR_MAP = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', border: 'border-t-brand-600' },
  success: { bg: 'bg-success-50', text: 'text-success-500', border: 'border-t-success-500' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-500', border: 'border-t-warning-500' },
  danger: { bg: 'bg-danger-50', text: 'text-danger-500', border: 'border-t-danger-500' },
}

export function StatCard({ icon: Icon, label, value, trend, color = 'brand', className = '' }: StatCardProps) {
  const c = COLOR_MAP[color]
  return (
    <div className={`group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-t-[3px] ${c.border} ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={18} className={c.text} />
        </div>
        {trend && (
          <span className={`text-[11px] font-semibold ${trend.direction === 'up' ? 'text-success-500' : 'text-danger-500'}`}>
            {trend.direction === 'up' ? '+' : '-'}{trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[13px] text-slate-500 mt-1">{label}</p>
    </div>
  )
}

interface InfoCardProps {
  icon?: LucideIcon
  label: string
  children: ReactNode
  className?: string
}

export function InfoCard({ icon: Icon, label, children, className = '' }: InfoCardProps) {
  return (
    <div className={`flex items-start gap-3 py-3 border-t border-slate-100 first:border-t-0 ${className}`}>
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={15} className="text-slate-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm text-slate-900 font-medium">{children}</div>
      </div>
    </div>
  )
}
