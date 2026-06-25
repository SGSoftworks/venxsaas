import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort, classNames } from '@/lib/utils'
import { exportToExcel } from '@/lib/export'
import type { AuditLog } from '@/types'
import {
  TrendingUp,
  Users,
  Store,
  DollarSign,
  FileText,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Activity,
  PieChart as PieChartIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface GlobalKPIs {
  activeClients: number
  suspendedClients: number
  pastDueClients: number
  totalBranches: number
  totalInvoices: number
  totalRevenue: number
}

interface MonthlyData {
  mes: string
  total: number
}

interface StatusItem {
  name: string
  value: number
  color: string
}

interface ActivityRow {
  id: string
  fecha: string
  usuario: string
  accion: string
  entidad: string
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const STATUS_PIE_COLORS: Record<string, string> = {
  active: '#10b981',
  suspended: '#ef4444',
  pending_payment: '#f59e0b',
  pending: '#f59e0b',
  cancelled: '#6b7280',
}

const STATUS_PIE_LABELS: Record<string, string> = {
  active: 'Activos',
  suspended: 'Suspendidos',
  pending_payment: 'Pendientes',
  pending: 'Pendientes',
  cancelled: 'Cancelados',
}

const KPI_CONFIG = [
  { key: 'activeClients' as const, label: 'Clientes Activos', icon: Users },
  { key: 'suspendedClients' as const, label: 'Clientes Suspendidos', icon: AlertCircle },
  { key: 'pastDueClients' as const, label: 'Clientes Vencidos', icon: AlertCircle },
  { key: 'totalBranches' as const, label: 'Sucursales Activas', icon: Store },
  { key: 'totalInvoices' as const, label: 'Facturas Emitidas', icon: FileText },
  { key: 'totalRevenue' as const, label: 'Ingresos Totales', icon: DollarSign },
]

const CARD_BG_COLORS = [
  'bg-brand-50 text-brand-600',
  'bg-amber-50 text-amber-600',
  'bg-red-50 text-red-600',
  'bg-brand-50 text-brand-600',
  'bg-brand-50 text-brand-600',
  'bg-success-50 text-success-500',
]

type DateRange = '30d' | '90d' | '12m' | 'year'

function groupByMonth<T extends { created_at: string }>(
  data: T[],
  valueKey: keyof T,
  since: Date
): MonthlyData[] {
  const map = new Map<string, number>()
  const now = new Date()
  const cursor = new Date(since.getFullYear(), since.getMonth(), 1)

  while (cursor.getTime() <= now.getTime()) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    map.set(key, 0)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const item of data) {
    const d = new Date(item.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const val = item[valueKey]
    if (map.has(key) && typeof val === 'number') {
      map.set(key, map.get(key)! + val)
    }
  }

  return Array.from(map.entries()).map(([key, total]) => {
    const [y, m] = key.split('-')
    return { mes: `${MESES[parseInt(m) - 1]} ${y}`, total }
  })
}

function formatRevenueTooltip(value: unknown) {
  return formatCurrency(Number(value))
}

const DATE_RANGE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: '12m', label: '12 meses' },
  { key: 'year', label: 'Año actual' },
]

export function AdminAnalyticsPage() {
  const [kpis, setKpis] = useState<GlobalKPIs | null>(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyData[]>([])
  const [monthlyFacturas, setMonthlyFacturas] = useState<MonthlyData[]>([])
  const [statusDistribution, setStatusDistribution] = useState<StatusItem[]>([])
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('12m')

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setRefreshKey((k) => k + 1)
  }, [dateRange])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        let since: Date
        switch (dateRange) {
          case '30d':
            since = new Date(now)
            since.setDate(since.getDate() - 30)
            break
          case '90d':
            since = new Date(now)
            since.setDate(since.getDate() - 90)
            break
          case '12m':
            since = new Date(now)
            since.setMonth(since.getMonth() - 12)
            break
          case 'year':
            since = new Date(now.getFullYear(), 0, 1)
            break
        }
        const sinceISO = since.toISOString()

        const results = await Promise.allSettled([
          supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('estado', 'active'),
          supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('estado', 'suspended'),
          supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('estado', 'past_due'),
          supabase.from('branch_accounts').select('*', { count: 'exact', head: true }),
          supabase.from('facturas_saas').select('*', { count: 'exact', head: true }),
          supabase.from('payments').select('amount, created_at').eq('status', 'approved').gte('created_at', sinceISO).order('created_at'),
          supabase.from('facturas_saas').select('total, created_at').gte('created_at', sinceISO).order('created_at'),
          supabase.from('tenants').select('estado'),
          supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        ])

        const getCount = (result: PromiseSettledResult<{ count: number | null }>, fallback = 0) =>
          result.status === 'fulfilled' ? (result.value.count ?? fallback) : fallback

        const activeCount = getCount(results[0])
        const suspendedCount = getCount(results[1])
        const pastDueCount = getCount(results[2])
        const branchCount = getCount(results[3])
        const invoiceCount = getCount(results[4])

        let totalRevenue = 0
        if (results[5].status === 'fulfilled') {
          const payments = results[5].value.data || []
          for (const p of payments) {
            totalRevenue += (p as { amount: number }).amount || 0
          }
          const paymentMonthlyData = groupByMonth(payments as { created_at: string; amount: number }[], 'amount', since)
          if (!cancelled) setMonthlyRevenue(paymentMonthlyData)
        }

        if (results[6].status === 'fulfilled') {
          const facturas = results[6].value.data || []
          const facturasMonthlyData = groupByMonth(facturas as { created_at: string; total: number }[], 'total', since)
          if (!cancelled) setMonthlyFacturas(facturasMonthlyData)
        }

        let statusItems: StatusItem[] = []
        if (results[7].status === 'fulfilled') {
          const tenantsData = results[7].value.data || []
          const statusCount = new Map<string, number>()
          for (const t of tenantsData) {
            const estado = (t as { estado: string }).estado
            statusCount.set(estado, (statusCount.get(estado) || 0) + 1)
          }
          statusItems = Array.from(statusCount.entries())
            .filter(([_, count]) => count > 0)
            .map(([estado, count]) => ({
              name: STATUS_PIE_LABELS[estado] || estado,
              value: count,
              color: STATUS_PIE_COLORS[estado] || '#9ca3af',
            }))
          if (!cancelled) setStatusDistribution(statusItems)
        }

        let activity: ActivityRow[] = []
        if (results[8].status === 'fulfilled') {
          const logs = results[8].value.data || []
          activity = (logs as AuditLog[]).map(l => ({
            id: l.id,
            fecha: l.created_at,
            usuario: l.user_id?.slice(0, 8) ?? '—',
            accion: l.accion,
            entidad: l.entidad,
          }))
          if (!cancelled) setActivityRows(activity)
        }

        if (!cancelled) {
          setKpis({
            activeClients: activeCount,
            suspendedClients: suspendedCount,
            pastDueClients: pastDueCount,
            totalBranches: branchCount,
            totalInvoices: invoiceCount,
            totalRevenue,
          })
        }
      } catch {
        if (!cancelled) setError('Error al cargar analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleExport = () => {
    if (!kpis) return
    setExporting(true)
    try {
      const kpiRows = KPI_CONFIG.map(cfg => ({
        tipo: 'KPI',
        metrica: cfg.label,
        valor: cfg.key === 'totalRevenue' ? formatCurrency(kpis[cfg.key]) : String(kpis[cfg.key]),
      }))

      const revenueRows = monthlyRevenue.map(m => ({
        tipo: 'Ingreso Mensual',
        metrica: m.mes,
        valor: formatCurrency(m.total),
      }))

      const facturaRows = monthlyFacturas.map(m => ({
        tipo: 'Factura Mensual',
        metrica: m.mes,
        valor: formatCurrency(m.total),
      }))

      const statusRows = statusDistribution.map(s => ({
        tipo: 'Distribución',
        metrica: s.name,
        valor: String(s.value),
      }))

      const actRows = activityRows.map(a => ({
        tipo: 'Actividad',
        metrica: a.accion,
        valor: `${formatDateShort(a.fecha)} | ${a.usuario} | ${a.entidad}`,
      }))

      const allData = [...kpiRows, ...revenueRows, ...facturaRows, ...statusRows, ...actRows]
      exportToExcel(
        allData,
        [
          { key: 'tipo', header: 'Tipo', width: 18 },
          { key: 'metrica', header: 'Métrica / Detalle', width: 30 },
          { key: 'valor', header: 'Valor', width: 40 },
        ],
        'analytics-global'
      )
    } finally {
      setExporting(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
        <p className="text-sm">{error}</p>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <h1 className="text-lg font-bold text-slate-900">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={loading || exporting || !kpis}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Exportar
          </button>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={classNames('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Período:</span>
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDateRange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                dateRange === opt.key
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading && !kpis
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse-soft">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-slate-100 rounded" />
                    <div className="h-5 w-24 bg-slate-100 rounded" />
                  </div>
                  <div className="w-8 h-8 rounded-md bg-slate-100" />
                </div>
              </div>
            ))
          : kpis && KPI_CONFIG.map((cfg, i) => (
              <div key={cfg.key} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{cfg.label}</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">
                      {cfg.key === 'totalRevenue' ? formatCurrency(kpis[cfg.key]) : String(kpis[cfg.key])}
                    </p>
                  </div>
                  <div className={classNames('w-8 h-8 rounded-md flex items-center justify-center shrink-0', CARD_BG_COLORS[i])}>
                    <cfg.icon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Ingresos Mensuales</h2>
          </div>
          {loading && monthlyRevenue.length === 0 ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : monthlyRevenue.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-slate-400">Sin datos de ingresos</p>
            </div>
          ) : (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: unknown) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={formatRevenueTooltip} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Line type="monotone" dataKey="total" stroke="#6D3CF5" strokeWidth={2} dot={{ r: 3, fill: '#6D3CF5' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Facturas por Mes</h2>
          </div>
          {loading && monthlyFacturas.length === 0 ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : monthlyFacturas.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-slate-400">Sin datos de facturas</p>
            </div>
          ) : (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyFacturas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: unknown) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={formatRevenueTooltip} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="total" fill="#6D3CF5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-lg lg:col-span-1">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Estado de Clientes</h2>
          </div>
          {loading && statusDistribution.length === 0 ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : statusDistribution.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-slate-400">Sin clientes registrados</p>
            </div>
          ) : (
            <div className="p-2">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={(entry: unknown) => `${(entry as Record<string, unknown>).name} ${(Number((entry as Record<string, unknown>).percent) * 100).toFixed(0)}%`} labelLine={false}>
                    {statusDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [`${v}`, 'Clientes']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 px-2 pb-2">
                {statusDistribution.map(s => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[11px] text-slate-500">{s.name}: {s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg lg:col-span-2">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Actividad Reciente</h2>
          </div>
          {loading && activityRows.length === 0 ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded animate-pulse-soft w-full" />
              ))}
            </div>
          ) : activityRows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-slate-400">Sin actividad registrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Fecha</th>
                    <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Usuario</th>
                    <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Acción</th>
                    <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Entidad</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map(a => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2 text-[12px] text-slate-500 whitespace-nowrap font-mono">{formatDateShort(a.fecha)}</td>
                      <td className="px-4 py-2 text-[12px] text-slate-600 font-mono">{a.usuario}</td>
                      <td className="px-4 py-2 text-[12px] text-slate-700">{a.accion}</td>
                      <td className="px-4 py-2 text-[12px] text-slate-500">{a.entidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
