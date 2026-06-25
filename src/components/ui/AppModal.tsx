import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { zIndex } from '@/lib/zIndex'

interface AppModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  size?: 'default' | 'xl' | 'fullscreen'
  z?: number
  ariaLabel?: string
  ariaLabelledby?: string
  hideClose?: boolean
}

const SIZE_CLASSES = {
  default: 'max-w-lg',
  xl: 'max-w-6xl',
  fullscreen: 'max-w-[calc(100vw-2rem)] h-[calc(100vh-4rem)]',
}

export function AppModal({
  open,
  onClose,
  children,
  title,
  size = 'default',
  z = zIndex.MODAL,
  ariaLabel,
  ariaLabelledby,
  hideClose = false,
}: AppModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return

    previousActiveElement.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    const timer = setTimeout(() => {
      const first = contentRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    }, 50)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      clearTimeout(timer)
      previousActiveElement.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: z }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
    >
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" />

      <div
        ref={contentRef}
        className={`relative w-full ${SIZE_CLASSES[size]} bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col animate-scale-in overflow-hidden`}
      >
        {(title || !hideClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            {title ? (
              <h2 className="text-base font-semibold text-slate-900" id={ariaLabelledby}>
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  )
}
