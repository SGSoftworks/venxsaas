import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort, classNames } from '@/lib/utils'
import { exportToExcel, FACTURAS_COLUMNS } from '@/lib/export'
import { useBillingStore } from '@/store/useBillingStore'
import type { FacturaSaas, MonthlyRevenue, PendingPayment } from '@/types'
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileText,
  Calendar,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  Eye,
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
} from 'recharts'

interface SummaryData {
  mrr: number
  arr: number
  totalFacturas: number
  facturacionMes: number
  facturacionAnio: number
}

type FacturaRow = FacturaSaas & { tenant_nombre?: string; tenant_nit?: string }

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const PAGE_SIZE = 15
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: MONTHS[i] }))
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

export function AdminBillingPage() {
  const { fetchMonthlyRevenue } = useBillingStore()

  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [facturasTotal, setFacturasTotal] = useState(0)
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [quickStats, setQuickStats] = useState({ todayCount: 0, avgValue: 0 })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [page, setPage] = useState(0)

  const [chartView, setChartView] = useState<'line' | 'bar'>('line')

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const currentYear = new Date().getFullYear()
        const todayStr = new Date().toISOString().slice(0, 10)

        const from = page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        const [
          { data: mrrData },
          { data: facturacionMes },
          { data: facturacionAnio },
          { data: pendingData },
          { data: facturasData, count: facturasCount },
          { count: todayCount },
        ] = await Promise.all([
          supabase.rpc('get_mrr'),
          supabase.rpc('get_facturacion_mensual'),
          supabase.rpc('get_facturacion_anual', { p_anio: currentYear }),
          supabase.rpc('get_pagos_pendientes'),
          supabase
            .from('facturas_saas')
            .select('*, tenants!inner(nombre_negocio, nit)', { count: 'exact' })
            .order('created_at', { ascending: false }),
          supabase
            .from('facturas_saas')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStr + 'T00:00:00')
            .lte('created_at', todayStr + 'T23:59:59'),
        ])

        if (cancelled) return

        const mrr = (mrrData as unknown as number) || 0
        const factMes = (facturacionMes as { total: number } | null)?.total || 0
        const anioData = (facturacionAnio as MonthlyRevenue[]) || []
        const anioTotal = anioData.reduce((sum, r) => sum + r.total, 0)

        setSummary({
          mrr,
          arr: mrr * 12,
          totalFacturas: facturasCount ?? 0,
          facturacionMes: factMes,
          facturacionAnio: anioTotal,
        })

        setMonthlyData(anioData)

        const rawData = (facturasData || []) as unknown as Record<string, unknown>[]
        let filtered: FacturaRow[] = rawData.map((d) => ({
          id: d.id as string,
          tenant_id: d.tenant_id as string,
          payment_id: d.payment_id as string | null,
          numero_factura: d.numero_factura as string,
          concepto: d.concepto as string,
          subtotal: d.subtotal as number,
          total: d.total as number,
          moneda: d.moneda as string,
           pdf_url: d.pdf_url as string | null,
          created_at: d.created_at as string,
          updated_at: d.updated_at as string,
          estado: (d.estado as FacturaSaas['estado']) || 'pagada',
          tenant_nombre: ((d.tenants as Record<string, unknown>)?.nombre_negocio as string) || '',
          tenant_nit: ((d.tenants as Record<string, unknown>)?.nit as string) || '',
        }))

        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(
            f =>
              f.numero_factura.toLowerCase().includes(q) ||
              (f.tenant_nombre?.toLowerCase() || '').includes(q)
          )
        }

        if (monthFilter !== 'all') {
          const m = parseInt(monthFilter)
          filtered = filtered.filter(f => new Date(f.created_at).getMonth() + 1 === m)
        }

        filtered = filtered.filter(f => new Date(f.created_at).getFullYear() === yearFilter)

        setFacturasTotal(filtered.length)
        setFacturas(filtered.slice(from, to + 1))
        setPendingPayments((pendingData as PendingPayment[]) || [])

        const totalAvg = filtered.reduce((s, f) => s + f.total, 0)
        setQuickStats({
          todayCount: todayCount ?? 0,
          avgValue: filtered.length > 0 ? totalAvg / filtered.length : 0,
        })
      } catch {
        if (!cancelled) setError('Error al cargar datos financieros')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [search, monthFilter, yearFilter, page, refreshKey])

  useEffect(() => {
    fetchMonthlyRevenue(new Date().getFullYear())
  }, [fetchMonthlyRevenue])

  const formatTick = (v: unknown) => {
    const n = Number(v)
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(0) + 'k'
    return String(n)
  }

  const chartData = useMemo(() => {
    const map = new Map<number, number>()
    monthlyData.forEach(r => { map.set(r.mes, r.total) })
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      return { mes, label: MONTHS[i], total: map.get(mes) || 0 }
    })
  }, [monthlyData])

  const totalPages = Math.ceil(facturasTotal / PAGE_SIZE)

  const handleExport = () => {
    if (facturas.length === 0) return
    const enriched = facturas.map(f => ({
      ...f,
      tenant_nombre: f.tenant_nombre || '',
      tenant_nit: f.tenant_nit || '',
    }))
    exportToExcel(
      enriched as unknown as Record<string, unknown>[],
      FACTURAS_COLUMNS,
      'facturas'
    )
  }

  if (error) {
    return (
      <div className="p-5 space-y-6 animate-fade-in">
        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500 py-20">
          <AlertCircle className="w-8 h-8 text-slate-300" />
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Facturación</h1>
        <button
          onClick={() => { setRefreshKey(k => k + 1); setPage(0) }}
          disabled={loading}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={classNames('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {loading && !summary
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse-soft">
                <div className="h-3 w-16 bg-slate-100 rounded mb-2" />
                <div className="h-6 w-28 bg-slate-100 rounded" />
              </div>
            ))
          : [
              { label: 'MRR', value: formatCurrency(summary?.mrr ?? 0), icon: DollarSign, color: 'bg-brand-50 text-brand-600' },
              { label: 'ARR', value: formatCurrency(summary?.arr ?? 0), icon: TrendingUp, color: 'bg-success-50 text-success-500' },
              { label: 'Facturas emitidas', value: String(summary?.totalFacturas ?? 0), icon: FileText, color: 'bg-amber-50 text-amber-600' },
              { label: 'Facturación del mes', value: formatCurrency(summary?.facturacionMes ?? 0), icon: BarChart3, color: 'bg-brand-50 text-brand-600' },
              { label: 'Facturación del año', value: formatCurrency(summary?.facturacionAnio ?? 0), icon: Calendar, color: 'bg-brand-50 text-brand-600' },
            ].map((card, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{card.label}</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">{card.value}</p>
                  </div>
                  <div className={classNames('w-8 h-8 rounded-md flex items-center justify-center shrink-0', card.color)}>
                    <card.icon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Chart + Quick Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Facturación mensual {new Date().getFullYear()}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartView('bar')}
                className={classNames(
                  'p-1.5 rounded text-[11px] font-medium transition-colors',
                  chartView === 'bar' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartView('line')}
                className={classNames(
                  'p-1.5 rounded text-[11px] font-medium transition-colors',
                  chartView === 'line' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {loading && monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : chartData.every(d => d.total === 0) ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-[13px] text-slate-400">Sin datos de facturación este año</p>
            </div>
          ) : (
            <div className="p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={formatTick} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      formatter={(value: unknown) => [formatCurrency(Number(value)), 'Total']}
                    />
                    <Bar dataKey="total" fill="#6D3CF5" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={formatTick} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      formatter={(value: unknown) => [formatCurrency(Number(value)), 'Total']}
                    />
                    <Line type="monotone" dataKey="total" stroke="#6D3CF5" strokeWidth={2} dot={{ fill: '#6D3CF5', r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Estadísticas rápidas</h2>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse-soft" />
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Facturas hoy</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{quickStats.todayCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Valor promedio</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(quickStats.avgValue)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700">Pagos pendientes</h2>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
              {pendingPayments.length} vencidos
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Cliente</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Plan</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Total adeudado</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Días vencido</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p, i) => (
                  <tr key={p.tenant_id + '-' + i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="text-[13px] font-medium text-slate-800">{p.nombre_negocio}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600">—</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-red-600">{formatCurrency(p.total)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                        {p.dias_vencido} días
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Facturas</h2>
            <span className="text-[12px] text-slate-400">({facturasTotal} registros)</span>
          </div>
          <button
            onClick={handleExport}
            disabled={facturas.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por número o cliente..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="w-full pl-3 pr-3 py-2 border border-slate-200 rounded-md text-[13px] placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 bg-white"
            />
          </div>
          <select
            value={monthFilter}
            onChange={e => { setMonthFilter(e.target.value); setPage(0) }}
            className="px-2.5 py-2 border border-slate-200 rounded-md text-[13px] text-slate-700 bg-white focus:outline-none focus:border-brand-400"
          >
            <option value="all">Todos los meses</option>
            {MONTH_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={e => { setYearFilter(Number(e.target.value)); setPage(0) }}
            className="px-2.5 py-2 border border-slate-200 rounded-md text-[13px] text-slate-700 bg-white focus:outline-none focus:border-brand-400"
          >
            {YEAR_OPTIONS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Fecha</th>
                <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Número</th>
                <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Cliente</th>
                <th className="text-left text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Concepto</th>
                <th className="text-right text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">Total</th>
                <th className="text-center text-[11px] font-medium text-slate-400 uppercase px-4 py-2.5">PDF</th>
              </tr>
            </thead>
            <tbody>
              {loading && facturas.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-4 py-3" colSpan={6}>
                      <div className="h-4 bg-slate-100 rounded animate-pulse-soft w-full max-w-lg" />
                    </td>
                  </tr>
                ))
              ) : facturas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-[13px] text-slate-400">
                      {search || monthFilter !== 'all'
                        ? 'No se encontraron facturas con los filtros actuales'
                        : 'No hay facturas emitidas aún'}
                    </p>
                  </td>
                </tr>
              ) : (
                facturas.map(f => (
                  <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-[12px] text-slate-500">{formatDateShort(f.created_at)}</td>
                    <td className="px-4 py-2.5 text-[13px] font-mono font-medium text-slate-800">{f.numero_factura}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-[13px] font-medium text-slate-800">{f.tenant_nombre || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600 max-w-[200px] truncate">{f.concepto}</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-800 text-right">{formatCurrency(f.total)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {f.pdf_url ? (
                        <a
                          href={f.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                          title="Ver PDF"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
            <span className="text-[12px] text-slate-400">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
