import { useParams, Link } from 'react-router-dom'
import { Clock } from 'lucide-react'

export function PaymentPending() {
  const { reference } = useParams<{ reference: string }>()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto animate-scale-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <Clock className="w-12 h-12 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-800">Pago pendiente</h2>
            <p className="text-sm text-slate-500">Tu pago aun esta siendo procesado.</p>
            <div className="flex flex-col gap-2 w-full mt-2">
              <Link
                to={`/checkout/pay/${reference}`}
                className="w-full px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                Revisar estado
              </Link>
              <Link
                to="/registro"
                className="w-full px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
