import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Shield, Store, Users, CheckCircle, Loader2, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react'
import type { Plan } from '@/types'

type Step = 'loading' | 'checkout' | 'waiting' | 'approved' | 'declined' | 'expired' | 'session_expired'

const POLL_INTERVAL = 3000
const MAX_POLLS = 100

export function PaymentPage() {
  const navigate = useNavigate()
  const { session, tenant, plan: storePlan, refreshTenant } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [step, setStep] = useState<Step>('loading')
  const [localPlan, setLocalPlan] = useState<Plan | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [paymentUrl, setPaymentUrl] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)

  const publicKey = import.meta.env.VITE_WOMPI_PUBLIC_KEY || ''
  const isSandbox = publicKey?.startsWith('pub_test_')
  const plan = storePlan || localPlan
  const initialAmount = plan?.precio_inicial ?? 0

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    if (!plan && tenant?.plan_id) {
      supabase.from('plans').select('*').eq('id', tenant.plan_id).maybeSingle().then(({ data }) => {
        if (data && mounted.current) { const p = data as unknown as Plan; setLocalPlan(p); useAuthStore.setState({ plan: p }) }
      })
    }
  }, [])

  const resolvedStep: Step = step === 'loading' && plan ? 'checkout' : step

  const stopPolling = useCallback(() => { if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null } }, [])
  useEffect(() => stopPolling, [stopPolling])

  const doCheckPaymentRef = useRef<(attempt: number) => Promise<void>>(null!)

  const doCheckPayment = useCallback(async (attempt: number) => {
    if (!tenant || !mounted.current) return
    if (!session) { setStep('session_expired'); return }
    setPollCount(attempt)
    if (attempt >= MAX_POLLS) { setStep('expired'); return }

    try {
      const { data: cpData, error: cpError } = await supabase.functions.invoke('check-payment', {
        body: { tenantId: tenant.id },
      })
      if (cpError) throw cpError
      if (cpData?.status === 'error') {
        setErrorMsg('Error al verificar el pago. Reintentando...')
      }
    } catch {
      setErrorMsg('Error de conexion al verificar pago')
    }

    const { data: payment } = await supabase
      .from('payments').select('status').eq('tenant_id', tenant.id).eq('tipo', 'initial')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (payment?.status === 'approved') {
      await refreshTenant()
      setStep('approved')
      setTimeout(() => { if (mounted.current) navigate('/dashboard', { replace: true }) }, 2500)
      return
    }
    if (payment?.status === 'declined') { setStep('declined'); setErrorMsg('El pago fue rechazado.'); return }

    pollTimer.current = setTimeout(() => doCheckPaymentRef.current?.(attempt + 1), POLL_INTERVAL)
  }, [tenant, session, refreshTenant, navigate])

  useEffect(() => { doCheckPaymentRef.current = doCheckPayment }, [doCheckPayment])

  const startPolling = useCallback(() => { stopPolling(); doCheckPayment(0) }, [doCheckPayment, stopPolling])

  const handlePay = useCallback(async () => {
    if (!plan || !tenant || !session) return
    setLoading(true)
    setErrorMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { planId: plan.id, tenantId: tenant.id, customerEmail: tenant.email_propietario, amountInCents: initialAmount * 100 },
      })
      if (error) { setErrorMsg(error.message || 'Error'); setLoading(false); return }

      if (data?.paymentLinkId) {
        // El payment link ya fue creado por la Edge Function via API
        // Redirigir directamente al link de pago
        const url = `https://checkout.wompi.co/l/${data.paymentLinkId}`
        setPaymentUrl(url)
        setStep('waiting')
        window.open(url, '_blank')
        startPolling()
      } else if (data?.integritySignature && data?.reference) {
        // Fallback: Web Checkout con form
        const form = document.createElement('form')
        form.method = 'GET'
        form.action = 'https://checkout.wompi.co/p/'
        form.target = '_blank'

        const fields: Record<string, string> = {
          'public-key': publicKey,
          'currency': 'COP',
          'amount-in-cents': String(data.amountInCents),
          'reference': data.reference,
          'signature:integrity': data.integritySignature,
        }

        for (const [name, value] of Object.entries(fields)) {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = name
          input.value = value
          form.appendChild(input)
        }

        document.body.appendChild(form)
        setPaymentUrl(`https://checkout.wompi.co/p/?public-key=${publicKey}&amount-in-cents=${data.amountInCents}&reference=${data.reference}`)
        setStep('waiting')
        startPolling()
        form.submit()
        document.body.removeChild(form)
      } else {
        setErrorMsg(data?.error || 'No se pudo preparar el pago')
      }
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Error') }
    setLoading(false)
  }, [plan, tenant, session, initialAmount, publicKey])

  useEffect(() => {
    if (resolvedStep === 'checkout' && tenant && tenant.estado === 'pending_payment') {
      const id = setTimeout(() => startPolling(), 0)
      return () => clearTimeout(id)
    }
  }, [resolvedStep, tenant, startPolling])

  const handleManualCheck = useCallback(async () => {
    if (!tenant) return
    setErrorMsg('')
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('check-payment', {
        body: { tenantId: tenant.id },
      })
      if (error) {
        setErrorMsg(`Error al verificar: ${error.message}`)
        setLoading(false)
        return
      }
      if (data?.status === 'approved') {
        await refreshTenant()
        setStep('approved')
        setTimeout(() => { if (mounted.current) navigate('/dashboard', { replace: true }) }, 2500)
      } else if (data?.status === 'declined') {
        setStep('declined'); setErrorMsg('El pago fue rechazado.')
      } else if (data?.status === 'not_found') {
        setErrorMsg('No se encontró pago pendiente. Tu cuenta ya podría estar activa.')
        await refreshTenant()
        if (mounted.current) {
          const { tenant: t } = useAuthStore.getState()
          if (t?.estado === 'active') { setStep('approved'); setTimeout(() => { navigate('/dashboard', { replace: true }) }, 2500) }
        }
      } else {
        setErrorMsg(`Pago pendiente (${data?.status || 'sin respuesta'}). Si ya pagaste, espera unos segundos.`)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? `Error: ${err.message}` : 'Error al verificar pago')
    }
    if (mounted.current) setLoading(false)
  }, [tenant, refreshTenant, navigate])

  const handleSimulate = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    try {
      await supabase.functions.invoke('simulate-payment', { body: { tenantId: tenant.id, planId: plan?.id, amount: initialAmount } })
      await refreshTenant()
      setStep('approved')
      setTimeout(() => { if (mounted.current) navigate('/dashboard', { replace: true }) }, 2500)
    } catch (err) { setErrorMsg('Error: ' + (err instanceof Error ? err.message : '')) }
    if (mounted.current) setLoading(false)
  }, [tenant, plan, initialAmount, refreshTenant, navigate])

  if (!session) return <Navigate to="/login" replace />
  if (tenant?.estado === 'active') return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-sm font-black">V</span>
          </div>
          <span className="text-sm font-semibold text-slate-800">VenxPOS</span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {resolvedStep === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              <p className="text-sm text-slate-500">Cargando...</p>
            </div>
          )}

          {resolvedStep === 'approved' && (
            <div className="bg-white border border-green-200 rounded-xl p-8 text-center animate-scale-in">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-800">Cuenta activada</h2>
              <p className="text-sm text-slate-500 mt-1">Redirigiendo al panel...</p>
            </div>
          )}

          {resolvedStep === 'waiting' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white border border-brand-200 rounded-xl p-8 text-center space-y-4">
                <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto" />
                <h2 className="text-lg font-semibold text-slate-800">Esperando pago</h2>
                <p className="text-sm text-slate-500">
                  Fuiste redirigido al checkout de Wompi. Completa el pago y vuelve a esta página.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Esperando confirmación de Wompi (máx. 5 min) · {Math.floor(pollCount * 3 / 60)}m {pollCount * 3 % 60}s</span>
                </div>
                {paymentUrl && (
                  <a href={paymentUrl}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
                    Ir al checkout de Wompi <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={handleManualCheck}
                  className="block w-full text-sm text-brand-600 hover:text-brand-700 underline">
                  Ya pagué, verificar ahora
                </button>
              </div>
            </div>
          )}

          {resolvedStep === 'declined' && (
            <div className="bg-white border border-red-200 rounded-xl p-8 text-center animate-fade-in space-y-4">
              <XCircle className="w-14 h-14 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-800">Pago rechazado</h2>
              <p className="text-sm text-slate-500">{errorMsg || 'El pago fue rechazado.'}</p>
              <button onClick={() => setStep('checkout')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
                <RefreshCw className="w-4 h-4" />Intentar de nuevo
              </button>
            </div>
          )}

          {resolvedStep === 'expired' && (
            <div className="bg-white border border-amber-200 rounded-xl p-8 text-center animate-fade-in space-y-4">
              <Clock className="w-14 h-14 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-800">Tiempo agotado</h2>
              <p className="text-sm text-slate-500">Si ya pagaste, puedes verificar manualmente.</p>
              <button onClick={handleManualCheck}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
                Verificar ahora
              </button>
            </div>
          )}

          {resolvedStep === 'session_expired' && (
            <div className="bg-white border border-amber-200 rounded-xl p-8 text-center animate-fade-in space-y-4">
              <Clock className="w-14 h-14 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-800">Sesión expirada</h2>
              <p className="text-sm text-slate-500">Inicia sesión nuevamente para continuar.</p>
              <button onClick={() => navigate('/login', { replace: true })}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
                Ir al login
              </button>
            </div>
          )}

          {tenant && plan && step === 'checkout' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <h1 className="text-lg font-bold text-slate-900">Configurar pago</h1>
                <p className="text-sm text-slate-500 mt-1">Completa el pago inicial para activar tu cuenta</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800">Resumen del plan</h2>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Plan</span><span className="text-sm font-semibold text-slate-900">{plan.nombre}</span></div>
                  <hr className="border-slate-100" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Store className="w-4 h-4 text-slate-400" /><span>Hasta {plan.max_sucursales} sucursales</span></div>
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Users className="w-4 h-4 text-slate-400" /><span>Hasta {plan.max_administradores} administradores</span></div>
                  </div>
                  <hr className="border-slate-100" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Pago inicial</span><span className="text-sm font-bold text-slate-900">{formatCurrency(initialAmount)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Precio mensual</span><span className="text-sm text-slate-500">{formatCurrency(plan.precio_mensual)}/mes</span></div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-1"><Shield className="w-3.5 h-3.5" /><span>Pago seguro procesado por Wompi</span></div>
                </div>
              </div>

              {errorMsg && <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-center"><p className="text-sm font-medium text-red-800">{errorMsg}</p></div>}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs text-amber-700 text-center">
                  Serás redirigido al checkout seguro de Wompi para completar tu pago.
                </p>
              </div>

              <button onClick={handlePay} disabled={loading || !publicKey}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-colors ${loading || !publicKey ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
                {!publicKey ? 'Clave Wompi no configurada' : loading ? 'Preparando pago...' : `Pagar ${formatCurrency(initialAmount)}`}
              </button>

              {isSandbox && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-1">Modo sandbox — prueba rápida</p>
                  <button onClick={handleSimulate} disabled={loading}
                    className="text-xs text-amber-600 hover:text-amber-800 underline">
                    Simular pago aprobado
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
