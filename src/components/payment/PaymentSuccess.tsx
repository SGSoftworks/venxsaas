import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

export function PaymentSuccess() {
  const { reference } = useParams<{ reference: string }>()
  const [planName, setPlanName] = useState('')
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    if (!reference) return
    supabase.functions.invoke('check-signup', {
      method: 'GET',
      body: { reference },
    }).then(({ data }) => {
      if (data?.planName && mounted.current) setPlanName(data.planName)
    }).finally(() => { if (mounted.current) setLoading(false) })
  }, [reference])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto animate-scale-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <p className="text-sm text-slate-500">Verificando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Cuenta activada exitosamente</h2>
              {planName && (
                <p className="text-sm text-slate-500">Plan: {planName}</p>
              )}
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors mt-2"
              >
                Iniciar sesion
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
