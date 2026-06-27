import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatDateShort, getStatusLabel, daysUntil } from '@/lib/utils'
import type { Tenant, Payment, Plan, FacturaSaas, Subscription } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { AppModal } from '@/components/ui/AppModal'
import {
  Loader2,
  AlertCircle,
  X,
  Building2,
  Users,
  Receipt,
  FileText,
  Calendar,
  Shield,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Printer,
  MessageCircle,
  RefreshCw,
  Clock,
  Send,
  ArrowRightLeft,
} from 'lucide-react'
import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'

interface SubscriptionData {
  branchCount: number
  adminCount: number
  payments: Payment[]
  allPlans: Plan[]
  facturas: FacturaSaas[]
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success-50 text-success-600 border-success-200',
  approved: 'bg-success-50 text-success-600 border-success-200',
  pending_payment: 'bg-warning-50 text-warning-600 border-warning-200',
  pending: 'bg-warning-50 text-warning-600 border-warning-200',
  suspended: 'bg-danger-50 text-danger-500 border-danger-200',
  cancelled: 'bg-danger-50 text-danger-500 border-danger-200',
  past_due: 'bg-danger-50 text-danger-500 border-danger-200',
  expired: 'bg-danger-50 text-danger-500 border-danger-200',
  declined: 'bg-danger-50 text-danger-500 border-danger-200',
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-success-400',
  approved: 'bg-success-400',
  pending_payment: 'bg-warning-400',
  pending: 'bg-warning-400',
  suspended: 'bg-danger-400',
  cancelled: 'bg-slate-300',
  past_due: 'bg-danger-400',
  expired: 'bg-slate-300',
  declined: 'bg-danger-400',
}

function StatusBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUS_BADGE[estado] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[estado] || 'bg-slate-300'}`} />
      {getStatusLabel(estado)}
    </span>
  )
}

function CountdownBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft > 7) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
        <Calendar className="w-3 h-3" />
        {daysLeft} dias restantes
      </span>
    )
  }
  if (daysLeft >= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-warning-50 text-warning-600 border border-warning-200">
        <AlertCircle className="w-3 h-3" />
        {daysLeft} dias restantes
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-danger-50 text-danger-500 border border-danger-200">
      <AlertCircle className="w-3 h-3" />
      Vencido hace {Math.abs(daysLeft)} dias
    </span>
  )
}

function SubscriptionMetrics({
  branchCount,
  adminCount,
  maxSucursales,
  maxAdministradores,
  payments,
  nextPayment,
  lastPayment,
}: {
  branchCount: number
  adminCount: number
  maxSucursales: number
  maxAdministradores: number
  payments: Payment[]
  nextPayment: string | null | undefined
  lastPayment: Payment | undefined
}) {
  const branchPct = maxSucursales > 0 ? Math.min((branchCount / maxSucursales) * 100, 100) : 0
  const adminPct = maxAdministradores > 0 ? Math.min((adminCount / maxAdministradores) * 100, 100) : 0
  const totalApproved = payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)

  const metrics = [
    {
      icon: Building2,
      label: 'Sucursales',
      value: `${branchCount}/${maxSucursales}`,
      sub: `${Math.round(branchPct)}% utilizado`,
      color: branchPct >= 90 ? 'warning' : 'brand',
    },
    {
      icon: Users,
      label: 'Administradores',
      value: `${adminCount}/${maxAdministradores}`,
      sub: `${Math.round(adminPct)}% utilizado`,
      color: adminPct >= 90 ? 'warning' : 'brand',
    },
    {
      icon: DollarSign,
      label: 'Total pagado',
      value: formatCurrency(totalApproved),
      sub: lastPayment ? `Ultimo: ${formatDateShort(lastPayment.created_at)}` : 'Sin pagos',
      color: 'success',
    },
    {
      icon: Calendar,
      label: 'Proxima factura',
      value: nextPayment ? formatDateShort(nextPayment) : '—',
      sub: nextPayment ? `${daysUntil(nextPayment)} dias` : 'Sin fecha',
      color: 'brand',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
      {metrics.map((m) => {
        const Icon = m.icon
        const colorMap: Record<string, string> = {
          brand: 'bg-brand-50 text-brand-600 border-brand-100',
          success: 'bg-success-50 text-success-500 border-success-100',
          warning: 'bg-warning-50 text-warning-500 border-warning-100',
        }
        return (
          <div key={m.label} className="bg-white rounded-xl border border-slate-100 p-3.5 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[m.color]}`}>
                <Icon size={14} />
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{m.label}</span>
            </div>
            <p className="text-sm font-bold text-slate-900 tabular-nums">{m.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{m.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

function PlanHeaderCard({
  plan,
  subscription,
  tenant,
  nextPayment,
  daysLeft,
  branchCount,
  adminCount,
  maxSucursales,
  maxAdministradores,
  payments,
}: {
  plan: Plan | null
  subscription: Subscription | null
  tenant: Tenant | null
  nextPayment: string | null | undefined
  daysLeft: number
  branchCount: number
  adminCount: number
  maxSucursales: number
  maxAdministradores: number
  payments: Payment[]
}) {
  const lastApproved = payments.filter(p => p.status === 'approved')[0]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.15),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {plan?.nombre || 'Sin plan'}
                    </h2>
                    {subscription && <StatusBadge estado={subscription.estado} />}
                  </div>
                  {tenant?.client_id && (
                    <p className="text-xs text-slate-400 font-mono mt-0.5">ID Cliente: {tenant.client_id}</p>
                  )}
                  {subscription && subscription.proximo_cobro && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Proximo cobro: {formatDate(subscription.proximo_cobro)} — Renovacion: {formatDateShort(subscription.fecha_renovacion ?? null)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[36px] font-bold text-white tabular-nums leading-none tracking-tight">
                {plan ? formatCurrency(plan.precio_mensual) : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1.5">COP / mes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <CountdownBadge daysLeft={daysLeft} />
          {subscription && subscription.estado === 'active' && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
              Activa
            </span>
          )}
          {subscription && subscription.estado !== 'active' && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUS_BADGE[subscription.estado] || ''}`}>
              {getStatusLabel(subscription.estado)}
            </span>
          )}
        </div>

        {daysLeft >= 0 && daysLeft <= 7 && (
          <div className="mt-3 px-4 py-2.5 bg-warning-50 border border-warning-200 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-warning-500 shrink-0 mt-px" />
            <p className="text-xs text-warning-600 leading-relaxed">
              {daysLeft === 0
                ? 'Tu suscripcion vence hoy. Renueva para evitar interrupcion del servicio.'
                : `Tu suscripcion vence en ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Renueva para evitar interrupciones.`}
            </p>
          </div>
        )}

        {daysLeft < 0 && (
          <div className="mt-3 px-4 py-2.5 bg-danger-50 border border-danger-200 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-danger-500 shrink-0 mt-px" />
            <p className="text-xs text-danger-500 leading-relaxed">
              El pago del {formatDate(nextPayment ?? null)} esta pendiente. Renueva para seguir usando VenxPOS.
            </p>
          </div>
        )}

        <SubscriptionMetrics
          branchCount={branchCount}
          adminCount={adminCount}
          maxSucursales={maxSucursales}
          maxAdministradores={maxAdministradores}
          payments={payments}
          nextPayment={nextPayment}
          lastPayment={lastApproved}
        />
      </div>
    </div>
  )
}

function QuickActions({
  tenant,
  tenantId,
  plan,
  subscription,
  clientId,
  allPlans,
  onCancel,
  onRefresh,
  actionLoading,
}: {
  tenant: { nombre_negocio?: string; email_propietario?: string } | null
  tenantId: string | null
  plan: { nombre?: string; id?: string } | null
  subscription: { proximo_cobro?: string | null; estado?: string } | null
  clientId?: string | null
  allPlans: Plan[]
  onCancel: () => void
  onRefresh: () => void
  actionLoading: boolean
}) {
  const { addToast } = useUIStore()
  const [showRenewal, setShowRenewal] = useState(false)
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [selectedNewPlanId, setSelectedNewPlanId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingRenewalReq, setPendingRenewalReq] = useState<boolean>(false)
  const [pendingChangeReq, setPendingChangeReq] = useState<boolean>(false)

  useEffect(() => {
    if (!tenantId) return
    supabase.from('subscription_requests')
      .select('id, estado, tipo')
      .eq('tenant_id', tenantId)
      .eq('estado', 'pendiente')
      .then(({ data }) => {
        if (!data) return
        setPendingRenewalReq(data.some(r => r.tipo === 'RENOVACION'))
        setPendingChangeReq(data.some(r => r.tipo === 'CAMBIO_PLAN'))
      })
  }, [tenantId])

  const daysLeft = daysUntil(subscription?.proximo_cobro ?? null)
  const isExpired = daysLeft < 0
  const canRenew = isExpired || (daysLeft >= 0 && daysLeft <= 5)

  const handleRenewalSubmit = async () => {
    if (!tenantId || !tenant) return
    setSubmitting(true)
    try {
      const { error: insErr } = await supabase
        .from('subscription_requests')
        .insert({
          tenant_id: tenantId,
          tipo: 'RENOVACION',
          plan_actual_id: plan?.id || null,
        })
      if (insErr) throw insErr

      window.open(buildWhatsAppUrl(
        `Hola. Deseo renovar mi suscripcion de VenxPOS.\n\nEmpresa: ${tenant?.nombre_negocio || ''}\nPlan actual: ${plan?.nombre || ''}\nID Cliente: ${clientId || 'N/A'}\n\nHe creado una solicitud de renovacion en la plataforma.\n\nQuedo atento a la validacion.\nGracias.`
      ), '_blank')
      setShowRenewal(false)
      onRefresh()
      addToast('success', 'Solicitud de renovacion creada. Te contactaremos pronto.')
    } catch {
      addToast('error', 'No se pudo crear la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangePlanSubmit = async () => {
    if (!tenantId || !tenant || !selectedNewPlanId) return
    setSubmitting(true)
    try {
      const { error: insErr } = await supabase
        .from('subscription_requests')
        .insert({
          tenant_id: tenantId,
          tipo: 'CAMBIO_PLAN',
          plan_actual_id: plan?.id || null,
          plan_nuevo_id: selectedNewPlanId,
        })
      if (insErr) throw insErr

      const newPlan = allPlans.find(p => p.id === selectedNewPlanId)
      window.open(buildWhatsAppUrl(
        `Hola. Soy cliente de VenxPOS. Solicito cambio de plan.\n\nEmpresa: ${tenant?.nombre_negocio || ''}\nPlan actual: ${plan?.nombre || ''}\nNuevo plan: ${newPlan?.nombre || ''}\nID Cliente: ${clientId || 'N/A'}\n\nHe creado una solicitud de cambio de plan en la plataforma.\n\nQuedo atento a la aprobacion.\nGracias.`
      ), '_blank')
      setShowChangePlan(false)
      setSelectedNewPlanId('')
      onRefresh()
      addToast('success', 'Solicitud de cambio de plan creada. Te contactaremos pronto.')
    } catch {
      addToast('error', 'No se pudo crear la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={() => setShowRenewal(true)}
          disabled={!canRenew || pendingRenewalReq}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98] ${
            !canRenew
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : pendingRenewalReq
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : isExpired
              ? 'bg-danger-500 text-white hover:bg-danger-600'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
          title={
            pendingRenewalReq
              ? 'Ya tienes una solicitud de renovacion pendiente'
              : !canRenew && daysLeft > 5
              ? 'La renovacion estara disponible faltando 5 dias para el vencimiento'
              : undefined
          }
        >
          <RefreshCw className="w-4 h-4" />
          {pendingRenewalReq
            ? 'Renovacion solicitada'
            : !canRenew
            ? `Renovacion en ${daysLeft - 5} dias`
            : 'Solicitar Renovacion'}
        </button>
        <button
          onClick={() => setShowChangePlan(true)}
          disabled={pendingChangeReq}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98] ${
            pendingChangeReq
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
          title={pendingChangeReq ? 'Ya tienes una solicitud de cambio pendiente' : undefined}
        >
          <ArrowRightLeft className="w-4 h-4" />
          {pendingChangeReq ? 'Cambio solicitado' : 'Solicitar Cambio de Plan'}
        </button>
        <button
          onClick={onCancel}
          disabled={actionLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-danger-500 hover:bg-danger-50 transition-all active:scale-[0.98]"
        >
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          Cancelar suscripcion
        </button>
      </div>

      <AppModal open={showRenewal} onClose={() => !submitting && setShowRenewal(false)} title="Solicitar Renovacion" size="default">
        <div className="p-6 space-y-4">
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm text-slate-600">
            <p>Al crear esta solicitud, nuestro equipo revisara y aprobara la renovacion de tu suscripcion.</p>
            <p className="mt-2 text-xs text-slate-400">Tiempo maximo de respuesta: {APP_CONFIG.responseTime}.</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Plan actual</span>
              <span className="font-semibold text-slate-700">{plan?.nombre || '\u2014'}</span>
            </div>
            {clientId && (
              <div className="flex justify-between text-slate-500">
                <span>ID Cliente</span>
                <span className="font-mono text-slate-700">{clientId}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button onClick={() => setShowRenewal(false)} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleRenewalSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar solicitud
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal open={showChangePlan} onClose={() => !submitting && setShowChangePlan(false)} title="Solicitar Cambio de Plan" size="default">
        <div className="p-6 space-y-4">
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-slate-600">
            <p>Selecciona el plan al que deseas cambiarte. Nuestro equipo revisara y aprobara la solicitud.</p>
            <p className="mt-2 text-xs text-slate-400">Tiempo maximo de respuesta: {APP_CONFIG.responseTime}.</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs mb-3">
            <div className="flex justify-between text-slate-500">
              <span>Plan actual</span>
              <span className="font-semibold text-slate-700">{plan?.nombre || '\u2014'}</span>
            </div>
            {clientId && (
              <div className="flex justify-between text-slate-500">
                <span>ID Cliente</span>
                <span className="font-mono text-slate-700">{clientId}</span>
              </div>
            )}
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {allPlans
              .filter(p => p.id !== plan?.id)
              .map(newPlan => (
                <label
                  key={newPlan.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedNewPlanId === newPlan.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="newPlan"
                      value={newPlan.id}
                      checked={selectedNewPlanId === newPlan.id}
                      onChange={e => setSelectedNewPlanId(e.target.value)}
                      className="accent-brand-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{newPlan.nombre}</p>
                      <p className="text-xs text-slate-400">
                        {newPlan.max_sucursales} sucursales · {newPlan.max_administradores} administradores
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">
                    {formatCurrency(newPlan.precio_mensual)}/mes
                  </span>
                </label>
              ))}
            {allPlans.filter(p => p.id !== plan?.id).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No hay planes disponibles</p>
            )}
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button onClick={() => setShowChangePlan(false)} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleChangePlanSubmit} disabled={submitting || !selectedNewPlanId} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Enviar solicitud
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}

function PaymentHistory({ payments, facturas, plan }: { payments: Payment[]; facturas: FacturaSaas[]; plan: Plan | null }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [methodFilter, setMethodFilter] = useState('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  const facturaMap = new Map<string, FacturaSaas>()
  for (const f of facturas) {
    if (f.payment_id) facturaMap.set(f.payment_id, f)
  }

  let filtered = payments
  if (statusFilter !== 'todos') filtered = filtered.filter(p => p.status === statusFilter)
  if (methodFilter !== 'todos') filtered = filtered.filter(p => p.payment_method_type === methodFilter)
  if (dateFrom) filtered = filtered.filter(p => new Date(p.created_at) >= new Date(dateFrom))
  if (dateTo) filtered = filtered.filter(p => new Date(p.created_at) <= new Date(dateTo + 'T23:59:59'))
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(p => {
      const factura = p.id ? facturaMap.get(p.id) : undefined
      return (
        (factura?.numero_factura?.toLowerCase().includes(q)) ||
        (p.wompi_reference?.toLowerCase().includes(q)) ||
        (p.amount.toString().includes(q))
      )
    })
  }

  const totalApproved = payments.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const lastApproved = payments.filter(p => p.status === 'approved')[0]
  const nextBilling = plan ? formatCurrency(plan.precio_mensual) : '—'

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const statusOptions = ['todos', 'approved', 'pending', 'declined', 'voided', 'error']
  const methodOptions = ['todos', ...new Set(payments.map(p => p.payment_method_type).filter((m): m is string => !!m))]

  const handleExportCSV = () => {
    const rows = [['Fecha', 'Monto', 'Metodo', 'Estado', 'Referencia', 'Factura']]
    for (const p of filtered) {
      const f = p.id ? facturaMap.get(p.id) : undefined
      rows.push([p.created_at, String(p.amount), p.payment_method_type || '', p.status, p.wompi_reference || '', f?.numero_factura || ''])
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'historial-pagos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Receipt className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-800">Historial de pagos</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
          {filtered.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-3 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-50 bg-slate-50/30">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total pagado</p>
          <p className="text-base font-bold text-success-600 tabular-nums">{formatCurrency(totalApproved)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Pendiente</p>
          <p className={`text-base font-bold tabular-nums ${totalPending > 0 ? 'text-warning-600' : 'text-slate-500'}`}>
            {formatCurrency(totalPending)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Proximo cobro</p>
          <p className="text-base font-bold text-slate-800 tabular-nums">{nextBilling}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Ultimo pago</p>
          <p className="text-base font-bold text-slate-800 tabular-nums">
            {lastApproved ? formatCurrency(lastApproved.amount) : '—'}
          </p>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="px-6 py-3 border-b border-slate-100 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por factura, referencia o monto..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/15 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 bg-white focus:outline-none focus:border-brand-500"
            >
              {statusOptions.map(s => (
                <option key={s} value={s}>{s === 'todos' ? 'Todos los estados' : getStatusLabel(s)}</option>
              ))}
            </select>
            <select
              value={methodFilter}
              onChange={e => { setMethodFilter(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 bg-white focus:outline-none focus:border-brand-500"
            >
              <option value="todos">Todos los metodos</option>
              {methodOptions.slice(1).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 bg-white focus:outline-none focus:border-brand-500"
              title="Fecha inicial"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 bg-white focus:outline-none focus:border-brand-500"
              title="Fecha final"
            />
            {(search || statusFilter !== 'todos' || methodFilter !== 'todos' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('todos'); setMethodFilter('todos'); setDateFrom(''); setDateTo(''); setPage(0) }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="px-6">
          <EmptyState
            icon={Receipt}
            title={payments.length === 0 ? 'Sin pagos registrados' : 'Sin resultados'}
            description={payments.length === 0 ? 'Los pagos apareceran aqui cuando realices tu primera transaccion' : 'No se encontraron pagos con los filtros seleccionados'}
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Factura</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Monto</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Metodo</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paged.map((payment) => {
                  const factura = payment.id ? facturaMap.get(payment.id) : undefined
                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-6 py-3.5 text-slate-600 text-xs font-mono whitespace-nowrap">
                        {factura?.numero_factura || '—'}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                        {formatDateShort(payment.created_at)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-900 text-xs tabular-nums">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 text-xs capitalize">
                        {payment.payment_method_type || '—'}
                      </td>
                      <td className="px-6 py-3.5">
                        <StatusBadge estado={payment.status} />
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {factura?.pdf_url ? (
                            <>
                              <a
                                href={factura.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                Factura
                              </a>
                              <a
                                href={factura.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Imprimir"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </a>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-300 px-2.5 py-1.5">Sin factura</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Pagina {page + 1} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5))
                  const p = start + i
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-[11px] font-medium transition-colors ${
                        p === page ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {p + 1}
                    </button>
                  )
                })}
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function SubscriptionPage() {
  const { tenant, plan, subscription, refreshTenant } = useAuthStore()
  const { addToast } = useUIStore()
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!tenant) return
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [{ count: branchCount }, { count: adminCount }, { data: payments }, { data: plans }, { data: facturas }] = await Promise.all([
          supabase
            .from('branch_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('activo', true),
          supabase
            .from('branch_accounts')
            .select('user_id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .not('user_id', 'is', null),
          supabase
            .from('payments')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('plans')
            .select('*')
            .eq('activo', true)
            .order('precio_mensual', { ascending: true }),
          supabase
            .from('facturas_saas')
            .select('*')
            .eq('tenant_id', tenant.id),
        ])
        if (!cancelled) {
          setData({
            branchCount: branchCount ?? 0,
            adminCount: adminCount ?? 0,
            payments: (payments as Payment[]) ?? [],
            allPlans: (plans as Plan[]) ?? [],
            facturas: (facturas as FacturaSaas[]) ?? [],
          })
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar la informacion de suscripcion.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [tenant, refreshKey])

  const handleCancel = async () => {
    if (!window.confirm('Al cancelar tu suscripcion, todas las sucursales quedaran inactivas y perderas acceso a VenxPOS al finalizar el periodo de facturacion actual. Esta accion no se puede deshacer.')) return
    if (!subscription || !tenant) return
    try {
      setActionLoading(true)
      const { error: rpcError } = await supabase.rpc('cancel_subscription', {
        p_tenant_id: tenant.id,
      })
      if (rpcError) throw rpcError
      await refreshTenant()
      setRefreshKey(k => k + 1)
      addToast('success', 'Suscripcion cancelada')
    } catch {
      addToast('error', 'No se pudo cancelar la suscripcion')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
          <p className="text-sm text-slate-500">Cargando suscripcion...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-danger-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-danger-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">Error</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  const branchCount = data?.branchCount ?? 0
  const adminCount = data?.adminCount ?? 0
  const maxSucursales = plan?.max_sucursales ?? 0
  const maxAdministradores = plan?.max_administradores ?? 0
  const nextPayment = subscription?.proximo_cobro
  const daysLeft = daysUntil(nextPayment ?? null)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mi suscripcion</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administra tu plan y metodo de pago
          </p>
        </div>
      </div>

      <PlanHeaderCard
        plan={plan}
        subscription={subscription}
        tenant={tenant}
        nextPayment={nextPayment}
        daysLeft={daysLeft}
        branchCount={branchCount}
        adminCount={adminCount}
        maxSucursales={maxSucursales}
        maxAdministradores={maxAdministradores}
        payments={data?.payments ?? []}
      />

      <QuickActions
        tenant={tenant as { nombre_negocio?: string; email_propietario?: string } | null}
        tenantId={tenant?.id || null}
        plan={plan as { nombre?: string; id?: string } | null}
        subscription={subscription as { proximo_cobro?: string | null } | null}
        clientId={tenant?.client_id}
        allPlans={data?.allPlans ?? []}
        onCancel={handleCancel}
        onRefresh={() => setRefreshKey(k => k + 1)}
        actionLoading={actionLoading}
      />

      <PaymentHistory payments={data?.payments ?? []} facturas={data?.facturas ?? []} plan={plan} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <MessageCircle className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-800">Necesitas ayuda?</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Contactanos directamente y te asistiremos con tu solicitud.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <a
            href={buildWhatsAppUrl('Hola. Necesito ayuda con mi suscripcion de VenxPOS.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>

        </div>
      </div>
    </div>
  )
}
