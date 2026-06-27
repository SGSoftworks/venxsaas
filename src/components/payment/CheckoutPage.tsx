import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Loader2, Check, Clock, AlertCircle, ArrowLeft } from 'lucide-react'

type Step = 'loading' | 'pending' | 'approved' | 'expired' | 'error'

const POLL_INTERVAL = 3000

export function CheckoutPage() {
  const { reference } = useParams<{ reference: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('loading')
  const [planName, setPlanName] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted = useRef(true)
  const openedTab = useRef(false)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const stopTimers = useCallback(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null }
    if (elapsedTimer.current) { clearInterval(elapsedTimer.current); elapsedTimer.current = null }
  }, [])

  useEffect(() => stopTimers, [stopTimers])

  const checkStatus = useCallback(async () => {
    if (!reference || !mounted.current) return
    try {
      const { data, error } = await supabase.functions.invoke('check-signup', {
        method: 'GET',
        body: { reference },
      })
      if (error) throw error

      if (data?.planName) setPlanName(data.planName)

      if (!openedTab.current && data?.paymentLinkId) {
        openedTab.current = true
        window.open(`https://checkout.wompi.co/l/${data.paymentLinkId}`, '_blank')
      }

      if (data?.status === 'approved') {
        setStep('approved')
        setTimeout(() => { if (mounted.current) navigate(`/payment/success/${reference}`, { replace: true }) }, 2000)
        return
      }
      if (data?.status === 'expired') {
        setStep('expired')
        return
      }
      if (data?.status === 'error') {
        setStep('error')
        return
      }

      setStep('pending')
      pollTimer.current = setTimeout(() => checkStatus(), POLL_INTERVAL)
    } catch {
      if (mounted.current) {
        setStep('error')
        setErrorMsg('Error al verificar el pago')
      }
    }
  }, [reference, navigate])

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    if (step === 'pending' && !elapsedTimer.current) {
      elapsedTimer.current = setInterval(() => {
        if (mounted.current) setElapsed((e) => e + 1)
      }, 1000)
    }
    return () => {
      if (step !== 'pending' && elapsedTimer.current) {
        clearInterval(elapsedTimer.current)
        elapsedTimer.current = null
      }
    }
  }, [step])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleManualCheck = useCallback(async () => {
    stopTimers()
    setErrorMsg('')
    if (!reference || !mounted.current) return
    try {
      const { data, error } = await supabase.functions.invoke('check-signup', {
        method: 'GET',
        body: { reference },
      })
      if (error) throw error

      if (data?.status === 'approved') {
        setStep('approved')
        setTimeout(() => { if (mounted.current) navigate(`/payment/success/${reference}`, { replace: true }) }, 2000)
        return
      }
      if (data?.status === 'expired') { setStep('expired'); return }
      if (data?.status === 'error') { setStep('error'); return }
      setStep('pending')
      setErrorMsg('Aun no se detecta el pago. Intentalo de nuevo en unos segundos.')
    } catch {
      if (mounted.current) setErrorMsg('Error al verificar el pago')
    }
  }, [reference, navigate, stopTimers])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto animate-scale-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">

          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <p className="text-sm text-slate-500">Preparando pago...</p>
            </div>
          )}

          {step === 'pending' && (
            <div className="flex flex-col items-center gap-4">
              <Clock className="w-12 h-12 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-800">Esperando confirmacion de pago</h2>
              {planName && (
                <p className="text-sm text-slate-500">Plan: {planName}</p>
              )}
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400 font-mono">
                <Clock className="w-4 h-4" />
                <span>{formatTime(elapsed)}</span>
              </div>
              {errorMsg && (
                <p className="text-xs text-amber-600">{errorMsg}</p>
              )}
              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  onClick={handleManualCheck}
                  className="w-full px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Ya pague
                </button>
                <Link
                  to="/"
                  className="w-full px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Ir al inicio
                </Link>
              </div>
            </div>
          )}

          {step === 'approved' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Pago aprobado</h2>
              <p className="text-sm text-slate-500">Redirigiendo...</p>
            </div>
          )}

          {step === 'expired' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Clock className="w-12 h-12 text-red-500" />
              <h2 className="text-lg font-semibold text-slate-800">El pago ha expirado</h2>
              <p className="text-sm text-slate-500">El tiempo para completar el pago ha vencido.</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Ir al inicio
              </Link>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <h2 className="text-lg font-semibold text-slate-800">Error al verificar el pago</h2>
              <p className="text-sm text-slate-500">{errorMsg || 'Ocurrio un error inesperado.'}</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Ir al inicio
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
