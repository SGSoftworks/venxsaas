import { Link } from 'react-router-dom'
import { RefreshCw, Home } from 'lucide-react'

export function ServerErrorPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold text-red-600">500</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Error del servidor</h1>
        <p className="text-sm text-slate-500 mb-8">
          Ocurrió un error inesperado. Intenta de nuevo más tarde.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={16} />
            Reintentar
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            <Home size={16} />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
