import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort, classNames } from '@/lib/utils'
import { useUIStore } from '@/store/useUIStore'
import type { Payment } from '@/types'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Calendar,
  X,
  DollarSign,
  Clock,
  CreditCard,
  BarChart3,
  MoreHorizontal,
  FileText,
  Receipt,
} from 'lucide-react'

interface PaymentRow extends Payment {
  tenant_nombre?: string
  tenant_email?: string | null
  factura_numero?: string | null
  factura_pdf_url?: string | null
  plan_nombre?: string | null
  fecha_inicio?: string | null
}

interface SummaryData {
  totalApproved: number
  approvedCount: number
  totalPending: number
  totalTransactions: number
  avgAmount: number
}

const PAGE_SIZE = 20

const STATUS_BADGES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  pending: 'bg-amber-50 text-amber-600 border-amber-200',
  declined: 'bg-red-50 text-red-600 border-red-200',
  voided: 'bg-red-50 text-red-600 border-red-200',
  error: 'bg-red-50 text-red-600 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  declined: 'Rechazado',
  voided: 'Anulado',
  error: 'Error',
}

const TYPE_LABELS: Record<string, string> = {
  initial: 'Inicial',
  recurring: 'Recurrente',
  manual: 'Manual',
  retry: 'Reintento',
  plan_change: 'Cambio plan',
}

const METHOD_LABELS: Record<string, string> = {
  CARD: 'Tarjeta',
  NEQUI: 'Nequi',
  PSE: 'PSE',
  BANCOLOMBIA_TRANSFER: 'Bancolombia',
  DAVIPLATA: 'Daviplata',
  PAYMENT_LINK: 'Link de pago',
  card: 'Tarjeta',
  nequi: 'Nequi',
  pse: 'PSE',
  bancolombia: 'Bancolombia',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'declined', label: 'Rechazados' },
  { value: 'voided', label: 'Anulados' },
  { value: 'error', label: 'Error' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'initial', label: 'Inicial' },
  { value: 'recurring', label: 'Recurrente' },
  { value: 'manual', label: 'Manual' },
  { value: 'retry', label: 'Reintento' },
  { value: 'plan_change', label: 'Cambio plan' },
]

const SUMMARY_CARDS = [
  {
    key: 'totalApproved' as const,
    label: 'Aprobado este mes',
    icon: DollarSign,
    borderColor: 'border-t-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600',
    format: true,
  },
  {
    key: 'totalPending' as const,
    label: 'Pendiente',
    icon: Clock,
    borderColor: 'border-t-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
    format: true,
  },
  {
    key: 'totalTransactions' as const,
    label: 'Transacciones',
    icon: CreditCard,
    borderColor: 'border-t-brand-500',
    iconBg: 'bg-brand-50 text-brand-600',
    format: false,
  },
  {
    key: 'avgAmount' as const,
    label: 'Monto promedio',
    icon: BarChart3,
    borderColor: 'border-t-red-500',
    iconBg: 'bg-red-50 text-red-600',
    format: true,
  },
]

export function AdminPayments() {
  const { addToast } = useUIStore()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [techDetailsOpen, setTechDetailsOpen] = useState<Record<string, boolean>>({})
  const [summary, setSummary] = useState<SummaryData>({
    totalApproved: 0,
    approvedCount: 0,
    totalPending: 0,
    totalTransactions: 0,
    avgAmount: 0,
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchPayments = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: plans } = await supabase.from('plans').select('id, nombre')
        const pm = new Map<string, string>()
        if (plans) plans.forEach(p => pm.set(p.id, p.nombre))

        const from = page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        let query = supabase
          .from('payments')
          .select(
            '*, tenants!inner(nombre_negocio, email_propietario, plan_id), facturas_saas!left(numero_factura, pdf_url), subscriptions!left(plan_id, estado, fecha_inicio)',
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })

        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (typeFilter !== 'all') query = query.eq('tipo', typeFilter)
        if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString())
        if (dateTo) query = query.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString())

        const { data, count, error: qError } = await query.range(from, to)
        if (qError) throw qError
        if (cancelled) return

        const rows = (data || []).map((d: Record<string, unknown>) => {
          const facturaData = d.facturas_saas as Record<string, unknown> | null
          const subData = d.subscriptions as Record<string, unknown> | null
          const tenantData = d.tenants as { nombre_negocio: string; email_propietario: string; plan_id: string } | null
          const planId = (subData?.plan_id as string) || tenantData?.plan_id
          const planName = planId ? pm.get(planId) || null : null

          return {
            id: d.id as string,
            tenant_id: d.tenant_id as string,
            subscription_id: d.subscription_id as string | null,
            gateway_transaction_id: d.gateway_transaction_id as string | null,
            gateway_reference: d.gateway_reference as string | null,
            amount: d.amount as number,
            currency: d.currency as string,
            status: d.status as Payment['status'],
            payment_method_type: d.payment_method_type as string | null,
            tipo: d.tipo as Payment['tipo'],
            metadata: d.metadata as Record<string, unknown>,
            created_at: d.created_at as string,
            updated_at: d.updated_at as string,
            tenant_nombre: tenantData?.nombre_negocio,
            tenant_email: tenantData?.email_propietario || null,
            factura_numero: (facturaData?.numero_factura as string) || null,
            factura_pdf_url: (facturaData?.pdf_url as string) || null,
            plan_nombre: planName || null,
            fecha_inicio: (subData?.fecha_inicio as string) || null,
          }
        })

        if (cancelled) return
        setPayments(rows)
        setTotal(count ?? 0)

        let sumQuery = supabase
          .from('payments')
          .select('amount, status')

        if (typeFilter !== 'all') sumQuery = sumQuery.eq('tipo', typeFilter)
        if (dateFrom) sumQuery = sumQuery.gte('created_at', new Date(dateFrom).toISOString())
        if (dateTo) sumQuery = sumQuery.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString())

        const { data: sumData } = await sumQuery
        if (cancelled) return
        const allPayments = (sumData || []) as { amount: number; status: string }[]

        const approvedPayments = allPayments.filter(p => p.status === 'approved')
        const pendingPayments = allPayments.filter(p => p.status === 'pending')
        const totalSum = allPayments.reduce((s, p) => s + p.amount, 0)

        setSummary({
          totalApproved: approvedPayments.reduce((s, p) => s + p.amount, 0),
          approvedCount: approvedPayments.length,
          totalPending: pendingPayments.reduce((s, p) => s + p.amount, 0),
          totalTransactions: allPayments.length,
          avgAmount: allPayments.length > 0 ? totalSum / allPayments.length : 0,
        })
      } catch {
        if (!cancelled) setError('Error al cargar pagos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPayments()
    return () => { cancelled = true }
  }, [statusFilter, typeFilter, dateFrom, dateTo, page, refreshKey])

  const handleExportCSV = () => {
    if (payments.length === 0) return
    const headers = ['ID Transaccion', 'Cliente', 'Estado', 'Monto', 'Metodo', 'Tipo', 'Plan', 'Referencia', 'Factura', 'Fecha']
    const rows = payments.map(p => [
      p.gateway_transaction_id || p.id,
      p.tenant_nombre || '',
      STATUS_LABELS[p.status] || p.status,
      String(p.amount),
      METHOD_LABELS[p.payment_method_type || ''] || p.payment_method_type || '',
      TYPE_LABELS[p.tipo] || p.tipo,
      p.plan_nombre || '',
      p.gateway_reference || '',
      p.factura_numero || '',
      formatDateShort(p.created_at),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleGenerateInvoice = async (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await supabase.rpc('generar_factura_desde_pago', { p_payment_id: paymentId })
      addToast('success', 'Factura generada exitosamente')
      setRefreshKey(k => k + 1)
      setOpenMenuId(null)
    } catch {
      addToast('error', 'Error al generar factura')
    }
  }

  const toggleTechDetail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTechDetailsOpen(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const badgeClass = (status: string) => STATUS_BADGES[status] || 'bg-slate-50 text-slate-600 border-slate-200'

  const summaryCards = SUMMARY_CARDS.map(card => {
    let value: string
    if (card.key === 'totalApproved') {
      value = formatCurrency(summary.totalApproved)
    } else if (card.key === 'totalPending') {
      value = formatCurrency(summary.totalPending)
    } else if (card.key === 'totalTransactions') {
      value = String(summary.totalTransactions)
    } else {
      value = formatCurrency(summary.avgAmount)
    }
    return { ...card, value }
  })

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Centro de Pagos</h1>
            <p className="text-[11px] text-slate-400">Gestiona transacciones y facturacion</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={payments.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button
            onClick={() => { setRefreshKey(k => k + 1); setOpenMenuId(null) }}
            disabled={loading}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 border border-transparent hover:border-slate-200"
          >
            <RefreshCw className={classNames('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map(card => (
          <div
            key={card.key}
            className={classNames(
              'relative overflow-hidden bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm border-t-2 transition-shadow duration-200 hover:shadow-md',
              card.borderColor
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
            <div className="relative px-4 py-3.5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 tracking-tight tabular-nums">
                    {card.value}
                  </p>
                </div>
                <div className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', card.iconBg)}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="flex flex-col items-center py-16 gap-4 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">{error}</p>
          <button onClick={() => setRefreshKey(k => k + 1)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : (
        <div className="bg-white border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setPage(0) }}
                  className={classNames(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                    statusFilter === opt.value
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-1 flex-wrap">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setTypeFilter(opt.value); setPage(0) }}
                  className={classNames(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                    typeFilter === opt.value
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-1.5 bg-slate-50 rounded-full border border-slate-200 px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(0) }}
                className="px-1 py-0.5 text-[12px] text-slate-700 bg-transparent focus:outline-none w-[110px] font-medium"
              />
              <span className="text-slate-300 text-xs font-medium">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(0) }}
                className="px-1 py-0.5 text-[12px] text-slate-700 bg-transparent focus:outline-none w-[110px] font-medium"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
                  className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 w-8" />
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5">Estado</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5">Cliente</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 hidden md:table-cell">Plan</th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5">Monto</th>
                  <th className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5">Factura</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 hidden sm:table-cell">Fecha</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 hidden lg:table-cell">Metodo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && payments.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3.5" colSpan={8}>
                        <div className="h-4 bg-slate-100 rounded-full animate-pulse-soft w-full max-w-lg" />
                      </td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <CreditCard className="w-8 h-8 text-slate-200" />
                        <p className="text-[13px] text-slate-400 font-medium">
                          {statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo
                            ? 'No se encontraron pagos con los filtros actuales'
                            : 'No hay pagos registrados aun'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {payments.map((p) => (
                      <tr
                        key={p.id}
                        className={classNames(
                          'transition-colors cursor-pointer',
                          expandedId === p.id ? 'bg-brand-50/30' : 'hover:bg-slate-50/50'
                        )}
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      >
                        <td className="px-5 py-3.5">
                          {expandedId === p.id ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={classNames('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', badgeClass(p.status))}>
                            {p.status === 'approved' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                            {p.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-soft" />}
                            {(p.status === 'declined' || p.status === 'voided' || p.status === 'error') && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            )}
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[13px] font-medium text-slate-700">
                            {p.tenant_nombre || '\u2014'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-600 hidden md:table-cell">
                          {p.plan_nombre || '\u2014'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-[13px] font-bold text-slate-800 tabular-nums">
                            {formatCurrency(p.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {p.factura_numero ? (
                            <span className="text-[12px] font-mono text-slate-600 font-medium">{p.factura_numero}</span>
                          ) : (
                            <button
                              onClick={(e) => handleGenerateInvoice(p.id, e)}
                              className="text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200 hover:border-brand-300 transition-colors"
                            >
                              Generar
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-500 whitespace-nowrap hidden sm:table-cell tabular-nums">
                          {formatDateShort(p.created_at)}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-600 hidden lg:table-cell">
                          {METHOD_LABELS[p.payment_method_type || ''] || p.payment_method_type || '\u2014'}
                        </td>
                      </tr>
                    ))}

                    {payments.map((p) =>
                      expandedId === p.id ? (
                        <tr key={`expanded-${p.id}`} className="bg-slate-50/30">
                      <td colSpan={8} className="px-5 py-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Informacion comercial</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-slate-400 mb-0.5">Cliente</p>
                            <p className="text-slate-800 font-medium">{p.tenant_nombre || '\u2014'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-0.5">Correo</p>
                            <p className="text-slate-800 font-medium truncate">{p.tenant_email || '\u2014'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-0.5">Plan</p>
                            <p className="text-slate-800 font-medium">{p.plan_nombre || '\u2014'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-0.5">Fecha activacion</p>
                            <p className="text-slate-800 font-medium tabular-nums">{p.fecha_inicio ? formatDateShort(p.fecha_inicio) : formatDateShort(p.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-0.5">Metodo pago</p>
                            <p className="text-slate-800 font-medium">{METHOD_LABELS[p.payment_method_type || ''] || p.payment_method_type || '\u2014'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-0.5">Valor</p>
                            <p className="text-slate-800 font-semibold tabular-nums">{formatCurrency(p.amount)}</p>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 mt-3 pt-3">
                          <button
                            onClick={(e) => toggleTechDetail(p.id, e)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
                          >
                            Detalle interno
                            <ChevronDown className={classNames('w-3 h-3 transition-transform', techDetailsOpen[p.id] && 'rotate-180')} />
                          </button>
                          {techDetailsOpen[p.id] && (
                            <div className="grid grid-cols-2 gap-4 mt-2 text-[11px]">
                              <div>
                                <p className="text-slate-400 mb-0.5">ID Transaccion</p>
                                <p className="text-slate-500 font-mono break-all">{p.gateway_transaction_id || '\u2014'}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5">Referencia</p>
                                <p className="text-slate-500 font-mono break-all">{p.gateway_reference || '\u2014'}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null
                )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <span className="text-[12px] font-medium text-slate-400">
                Pagina {page + 1} de {totalPages} &middot; {total} pagos
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const startPage = Math.max(0, Math.min(page - 2, totalPages - 5))
                  const pageNum = startPage + i
                  if (pageNum >= totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={classNames(
                        'w-8 h-8 rounded-lg text-[12px] font-medium transition-colors',
                        pageNum === page
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      {pageNum + 1}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
