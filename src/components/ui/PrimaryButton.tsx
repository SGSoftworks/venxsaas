import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface PrimaryButtonProps {
  children: ReactNode
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}

const SIZE_CLASSES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

export function PrimaryButton({
  children,
  onClick,
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-all active:scale-[0.98] shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-600 disabled:active:scale-100 ${SIZE_CLASSES[size]} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}
