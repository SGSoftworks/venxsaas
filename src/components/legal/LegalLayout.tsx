import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'

export interface LegalSection {
  id: string
  title: string
}

export function LegalLayout({
  title,
  sections,
  children,
  lastUpdated = '21 de junio de 2026',
}: {
  title: string
  sections?: LegalSection[]
  children: ReactNode
  lastUpdated?: string
}) {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <Link
          to="/"
          className="text-sm text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        <div className="flex gap-8">
          {sections && sections.length > 0 && (
            <aside className="hidden lg:block w-56 shrink-0">
              <nav className="sticky top-24 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  En esta página
                </p>
                {sections.map(s => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-[13px] text-slate-500 hover:text-brand-600 transition-colors leading-relaxed py-0.5"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </aside>
          )}

          <div className="flex-1 min-w-0">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-brand-600 to-brand-800 text-white px-8 py-7">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 opacity-80" />
                  <h1 className="text-xl font-bold">{title}</h1>
                </div>
                <p className="text-xs text-white/60 ml-8">
                  Última actualización: {lastUpdated}
                </p>
              </div>

              <div className="px-8 py-6 space-y-0">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
