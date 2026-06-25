import { useParams, Link } from 'react-router-dom'
import { X } from 'lucide-react'

export function PaymentFailed() {
  const { reference } = useParams<{ reference: string }>()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto animate-scale-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Pago rechazado</h2>
            <p className="text-sm text-slate-500">El pago no pudo ser procesado.</p>
            {reference && (
              <p className="text-xs text-slate-400 font-mono">
                Referencia: {reference}
              </p>
            )}
            <Link
              to="/registro"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors mt-2"
            >
              Intentar de nuevo
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
