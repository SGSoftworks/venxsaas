import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort, getStatusColor, daysUntil } from '@/lib/utils'
import type { Payment } from '@/types'

interface LowStockItem {
  producto_id: string
  codigo_barras: string
  descripcion: string
  stock_actual: number
  stock_minimo: number
  sucursal_id: string
  sucursal_nombre: string
}
import {
  Store,
  Plus,
  Calendar,
  CreditCard,
  TrendingUp,
  Loader2,
  AlertCircle,
  Clock,
  Download,
  DollarSign,
  ShoppingCart,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react'
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent'
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  BILLETERA: 'Billetera',
  MIXTO: 'Mixto',
}

const PIE_COLORS = ['#10B981', '#6D3CF5', '#8B5CF6', '#64748B']

function fmt(value: ValueType | undefined): string {
  return formatCurrency(Number(value ?? 0))
}

function tickCompact(value: ValueType | undefined): string {
  const v = Number(value ?? 0)
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : `${v}`
}

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface SalesKpi {
  total_ventas: number
  cantidad_transacciones: number
  ticket_promedio: number
  ganancia: number
}

interface DailySale {
  dia: string
  fecha: Date
  total: number
}

interface MonthlySale {
  mes: string
  mesNum: number
  total: number
}

interface TopProduct {
  descripcion: string
  cantidad: number
  total: number
}

interface PaymentMethod {
  metodo: string
  total: number
  count: number
}

interface DashboardData {
  branchCount: number
  recentPayments: Payment[]
  ventasHoy: SalesKpi | null
  ventasMes: SalesKpi | null
  dailySales: DailySale[]
  monthlySales: MonthlySale[]
  topProducts: TopProduct[]
  paymentMethods: PaymentMethod[]
}

function getDayLabel(date: Date): string {
  const today = new Date()
  const diff = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return DAY_NAMES[date.getDay()]
}

function getMonthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear() % 100}`
}

function startOfDay(d: Date): Date {
  const result = new Date(d)
  result.setHours(0, 0, 0, 0)
  return result
}

function startOfMonth(d: Date): Date {
  const result = new Date(d)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

type DateRange = 'today' | 'week' | 'month' | 'year'

interface BranchOption {
  sucursal_id: string | null
  nombre_sucursal: string
}

export function DashboardHome() {
  const { tenant, plan, subscription } = useAuthStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [lowStockOpen, setLowStockOpen] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [sucursales, setSucursales] = useState<BranchOption[]>([])

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setRefreshKey((k) => k + 1)
  }, [selectedBranch, dateRange])

  useEffect(() => {
    if (!tenant) return

    let cancelled = false

    const t = tenant

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const now = new Date()
        const todayStart = startOfDay(now)
        const monthStartDt = startOfMonth(now)

        let fechaInicio: Date
        switch (dateRange) {
          case 'today':
            fechaInicio = todayStart
            break
          case 'week':
            fechaInicio = new Date(todayStart)
            fechaInicio.setDate(fechaInicio.getDate() - 6)
            break
          case 'month':
            fechaInicio = monthStartDt
            break
          case 'year':
            fechaInicio = new Date(monthStartDt)
            fechaInicio.setMonth(fechaInicio.getMonth() - 11)
            break
        }

        const [{ count }, { data: payments }, { data: branchData }] = await Promise.all([
          supabase
            .from('branch_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', t.id)
            .eq('activo', true),
          supabase
            .from('payments')
            .select('*')
            .eq('tenant_id', t.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('branch_accounts')
            .select('sucursal_id, nombre_sucursal')
            .eq('tenant_id', t.id)
            .eq('activo', true),
        ])

        const branchRows = (branchData || []) as unknown as BranchOption[]

        if (!cancelled) {
          setSucursales(branchRows)
        }

        const sucursalIds = selectedBranch
          ? [selectedBranch]
          : branchRows
              .filter((b): b is { sucursal_id: string; nombre_sucursal: string } => b.sucursal_id !== null)
              .map((b) => b.sucursal_id)

        const hasBranches = sucursalIds.length > 0

        const ventasHoyPromise = hasBranches
          ? supabase
              .from('ventas')
              .select('total, id')
              .in('sucursal_id', sucursalIds)
              .gte('fecha_hora', todayStart.toISOString())
          : Promise.resolve({ data: [], error: null })

        const ventasMesPromise = hasBranches
          ? supabase
              .from('ventas')
              .select('total, id')
              .in('sucursal_id', sucursalIds)
              .gte('fecha_hora', monthStartDt.toISOString())
          : Promise.resolve({ data: [], error: null })

        const ventasRawPromise = hasBranches
          ? supabase
              .from('ventas')
              .select('fecha_hora, total, metodo_pago')
              .in('sucursal_id', sucursalIds)
              .gte('fecha_hora', fechaInicio.toISOString())
              .order('fecha_hora', { ascending: true })
              .limit(5000)
          : Promise.resolve({ data: [], error: null })

        const [{ data: ventasHoyRaw }, { data: ventasMesRaw }, { data: ventasRaw }] = await Promise.all([
          ventasHoyPromise,
          ventasMesPromise,
          ventasRawPromise,
        ])

        const { data: lowStockRaw } = await supabase.rpc('get_low_stock_products', {
          p_tenant_id: t.id,
          p_limit: 20,
        })

        if (cancelled) return

        const ventasHoyArr = (ventasHoyRaw || []) as { total: number; id: string }[]
        const ventasMesArr = (ventasMesRaw || []) as { total: number; id: string }[]
        const ventasHoyTotal = ventasHoyArr.reduce((s, v) => s + Number(v.total || 0), 0)
        const ventasHoyCount = ventasHoyArr.length
        const ventasMesTotal = ventasMesArr.reduce((s, v) => s + Number(v.total || 0), 0)
        const ventasMesCount = ventasMesArr.length
        const ticketPromedioCalc = ventasMesCount > 0 ? ventasMesTotal / ventasMesCount : 0

        let topProducts: TopProduct[] = []
        let paymentMethods: PaymentMethod[] = []
        let gananciaMes = 0
        let gananciaHoy = 0

        if (hasBranches && ventasRaw && ventasRaw.length > 0) {
          const ventasHoyIds = (ventasHoyRaw as { id?: string }[] || [])
            .map((v) => (v as { id: string }).id)
            .filter(Boolean)
          const periodVentasIds = (ventasRaw as { id?: string; fecha_hora: string }[])
            .filter((v) => new Date(v.fecha_hora) >= fechaInicio)
            .map((v) => (v as { id: string }).id)
            .filter(Boolean)

          if (periodVentasIds.length > 0 || ventasHoyIds.length > 0) {
            const [{ data: detallesPeriodo }, { data: detallesHoy }] = await Promise.all([
              periodVentasIds.length > 0
                ? supabase
                    .from('venta_detalles')
                    .select('producto_id, cantidad_o_peso, subtotal, costo_aplicado, productos!inner(descripcion)')
                    .in('venta_id', periodVentasIds)
                    .limit(5000)
                : Promise.resolve({ data: [] }),
              ventasHoyIds.length > 0
                ? supabase
                    .from('venta_detalles')
                    .select('subtotal, costo_aplicado')
                    .in('venta_id', ventasHoyIds)
                    .limit(5000)
                : Promise.resolve({ data: [] }),
            ])

            if (detallesPeriodo && detallesPeriodo.length > 0) {
              const grouped = new Map<string, { descripcion: string; cantidad: number; total: number }>()
              for (const d of (detallesPeriodo as unknown) as { producto_id: string; cantidad_o_peso: number; subtotal: number; costo_aplicado?: number | null; productos: { descripcion: string } }[]) {
                const pid = d.producto_id
                const existing = grouped.get(pid)
                if (existing) {
                  existing.cantidad += Number(d.cantidad_o_peso)
                  existing.total += Number(d.subtotal)
                } else {
                  grouped.set(pid, {
                    descripcion: d.productos?.descripcion ?? 'Sin nombre',
                    cantidad: Number(d.cantidad_o_peso),
                    total: Number(d.subtotal),
                  })
                }
                gananciaMes += Number(d.subtotal ?? 0) - Number(d.costo_aplicado ?? 0)
              }
              topProducts = Array.from(grouped.values())
                .sort((a, b) => b.total - a.total)
                .slice(0, 5)
            }

            if (detallesHoy && detallesHoy.length > 0) {
              for (const d of (detallesHoy as unknown) as { subtotal: number; costo_aplicado?: number | null }[]) {
                gananciaHoy += Number(d.subtotal ?? 0) - Number(d.costo_aplicado ?? 0)
              }
            }
          }

          const pmGrouped = new Map<string, { total: number; count: number }>()
          for (const v of ventasRaw as { metodo_pago: string; total: number }[]) {
            const mp = v.metodo_pago ?? 'OTRO'
            const existing = pmGrouped.get(mp)
            if (existing) {
              existing.total += Number(v.total)
              existing.count++
            } else {
              pmGrouped.set(mp, { total: Number(v.total), count: 1 })
            }
          }
          paymentMethods = Array.from(pmGrouped.entries()).map(([metodo, vals]) => ({
            metodo,
            total: vals.total,
            count: vals.count,
          }))
        }

        const dailySalesMap = new Map<string, number>()
        const filteredVentas = hasBranches && ventasRaw
          ? (ventasRaw as { fecha_hora: string; total: number }[])
              .filter((v) => new Date(v.fecha_hora) >= fechaInicio)
          : []

        for (const v of filteredVentas) {
          const diaKey = startOfDay(new Date(v.fecha_hora)).toISOString()
          dailySalesMap.set(diaKey, (dailySalesMap.get(diaKey) ?? 0) + Number(v.total))
        }

        const barChartData: DailySale[] = []

        if (dateRange === 'year') {
          const monthBarMap = new Map<string, number>()
          for (const v of filteredVentas) {
            const d = new Date(v.fecha_hora)
            const key = `${d.getFullYear()}-${d.getMonth()}`
            monthBarMap.set(key, (monthBarMap.get(key) ?? 0) + Number(v.total))
          }
          for (let i = 11; i >= 0; i--) {
            const d = new Date(monthStartDt)
            d.setMonth(d.getMonth() - i)
            const key = `${d.getFullYear()}-${d.getMonth()}`
            barChartData.push({
              dia: getMonthLabel(d),
              fecha: d,
              total: monthBarMap.get(key) ?? 0,
            })
          }
        } else {
          const numDays = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : now.getDate()
          for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date(todayStart)
            d.setDate(d.getDate() - i)
            const key = d.toISOString()
            barChartData.push({
              dia: getDayLabel(d),
              fecha: d,
              total: dailySalesMap.get(key) ?? 0,
            })
          }
        }

        const monthlySalesMap = new Map<string, number>()
        if (hasBranches && ventasRaw) {
          for (const v of ventasRaw as { fecha_hora: string; total: number }[]) {
            const d = new Date(v.fecha_hora)
            const mesKey = `${d.getFullYear()}-${d.getMonth()}`
            monthlySalesMap.set(mesKey, (monthlySalesMap.get(mesKey) ?? 0) + Number(v.total))
          }
        }

        const numMeses = dateRange === 'year' ? 12 : dateRange === 'month' ? 6 : 2
        const monthlySales: MonthlySale[] = []
        for (let i = numMeses - 1; i >= 0; i--) {
          const d = new Date(monthStartDt)
          d.setMonth(d.getMonth() - i)
          const mesKey = `${d.getFullYear()}-${d.getMonth()}`
          monthlySales.push({
            mes: getMonthLabel(d),
            mesNum: d.getMonth(),
            total: monthlySalesMap.get(mesKey) ?? 0,
          })
        }

        if (!cancelled) {
          const ventasHoy: SalesKpi = {
            total_ventas: ventasHoyTotal,
            cantidad_transacciones: ventasHoyCount,
            ticket_promedio: ticketPromedioCalc,
            ganancia: gananciaHoy,
          }
          const ventasMes: SalesKpi = {
            total_ventas: ventasMesTotal,
            cantidad_transacciones: ventasMesCount,
            ticket_promedio: ticketPromedioCalc,
            ganancia: gananciaMes,
          }
          setLowStock((lowStockRaw ?? []) as LowStockItem[])
          setData({
            branchCount: count ?? 0,
            recentPayments: (payments ?? []) as Payment[],
            ventasHoy,
            ventasMes,
            dailySales: barChartData,
            monthlySales,
            topProducts,
            paymentMethods,
          })
        }
      } catch {
        if (!cancelled) setError('No se pudieron cargar los datos del dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [tenant, refreshKey])

  const handleRetry = () => setRefreshKey((k) => k + 1)

  const exportData = () => {
    if (!data) return

    const exportPayload = {
      tenant: tenant?.nombre_negocio,
      exportado: new Date().toISOString(),
      sucursales_activas: data.branchCount,
      ventas_hoy: data.ventasHoy,
      ventas_mes: data.ventasMes,
      tendencia_diaria: data.dailySales,
      tendencia_mensual: data.monthlySales,
      top_productos: data.topProducts,
      metodos_pago: data.paymentMethods,
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-${tenant?.nombre_negocio ?? 'export'}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const ventasHoyTotal = data?.ventasHoy?.total_ventas ?? 0
  const ventasHoyCount = data?.ventasHoy?.cantidad_transacciones ?? 0
  const ventasMesTotal = data?.ventasMes?.total_ventas ?? 0
  const ventasMesCount = data?.ventasMes?.cantidad_transacciones ?? 0
  const ticketPromedio = data?.ventasMes?.ticket_promedio ?? 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{error}</p>
        <button
          onClick={handleRetry}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium underline underline-offset-2"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const maxSucursales = plan?.max_sucursales ?? 0
  const branchCount = data?.branchCount ?? 0
  const nextPayment = subscription?.proximo_cobro
  const daysLeft = daysUntil(nextPayment ?? null)

  const sucursalUsage = maxSucursales > 0 ? (branchCount / maxSucursales) * 100 : 0
  const usageColor = sucursalUsage >= 90 ? 'bg-red-500' : sucursalUsage >= 70 ? 'bg-amber-500' : 'bg-success-500'
  const daysLeftColor = daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-slate-500'

  const DATE_RANGE_OPTIONS: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'year', label: 'Año' },
  ]

  const chartDailyTitle =
    dateRange === 'today' ? 'Ventas Hoy'
    : dateRange === 'week' ? 'Ventas diarias (7 días)'
    : dateRange === 'month' ? 'Ventas diarias (Mes)'
    : 'Ventas mensuales (12 meses)'

  const chartMonthlyTitle =
    dateRange === 'year' ? 'Ventas mensuales (12 meses)'
    : dateRange === 'month' ? 'Ventas mensuales (6 meses)'
    : 'Ventas mensuales'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome + Export */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Bienvenido, {tenant?.nombre_negocio || 'VenxPOS'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestiona tu negocio desde un solo lugar
          </p>
          {tenant?.client_id && (
            <p className="text-xs text-slate-400 font-mono mt-1">ID Cliente: {tenant.client_id}</p>
          )}
        </div>
        <button
          onClick={exportData}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedBranch ?? ''}
          onChange={(e) => setSelectedBranch(e.target.value || null)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 min-w-[200px]"
        >
          <option value="">Todas las sucursales</option>
          {sucursales.map((b) => (
            <option key={b.sucursal_id ?? b.nombre_sucursal} value={b.sucursal_id ?? ''}>
              {b.nombre_sucursal}
            </option>
          ))}
        </select>

        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDateRange(opt.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Plan actual */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-lg">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500 truncate">Plan actual</p>
            <p className="text-sm font-semibold text-slate-800 truncate">
              {plan?.nombre || 'Sin plan'}
            </p>
          </div>
        </div>

        {/* Sucursales activas */}
        <div className="px-4 py-3.5 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-success-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-500">Sucursales</p>
              <p className="text-sm font-semibold text-slate-800">
                {branchCount}{maxSucursales > 0 ? ` / ${maxSucursales}` : ''}
              </p>
            </div>
          </div>
          {maxSucursales > 0 && (
            <div className="mt-2.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usageColor}`}
                style={{ width: `${Math.min(sucursalUsage, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Próximo cobro */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-lg">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">Próximo cobro</p>
            <p className="text-sm font-semibold text-slate-800">
              {nextPayment ? formatDateShort(nextPayment) : '—'}
            </p>
            {nextPayment && daysLeft >= 0 && (
              <p className={`text-[11px] font-medium ${daysLeftColor}`}>
                en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
              </p>
            )}
            {nextPayment && daysLeft < 0 && (
              <p className="text-[11px] font-medium text-red-600">
                vencido hace {Math.abs(daysLeft)} día{Math.abs(daysLeft) !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Ventas Hoy */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-lg">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">Ventas Hoy</p>
            <p className="text-sm font-semibold text-slate-800">
              {formatCurrency(ventasHoyTotal)}
            </p>
            <p className="text-[11px] text-slate-400">
              {ventasHoyCount} transacción{ventasHoyCount !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>

        {/* Ventas Mes */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-lg">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">Ventas del Mes</p>
            <p className="text-sm font-semibold text-slate-800">
              {formatCurrency(ventasMesTotal)}
            </p>
            <p className="text-[11px] text-slate-400">
              {ventasMesCount} transacción{ventasMesCount !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>

        {/* Ticket Promedio */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-lg">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">Ticket Promedio</p>
            <p className="text-sm font-semibold text-slate-800">
              {formatCurrency(ticketPromedio)}
            </p>
            <p className="text-[11px] text-slate-400">este mes</p>
          </div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setLowStockOpen(!lowStockOpen)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-red-50/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-red-800">
                  {lowStock.length} producto{lowStock.length !== 1 ? 's' : ''} con stock bajo
                </p>
                <p className="text-[11px] text-red-500">
                  {lowStock.length > 1 ? 'Revisa el inventario para evitar desabastecimiento' : ''}
                </p>
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-red-400 transition-transform ${lowStockOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {lowStockOpen && (
            <div className="border-t border-red-100 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/50">
                    <th className="text-left px-5 py-2 text-[11px] font-medium text-red-600">Producto</th>
                    <th className="text-left px-5 py-2 text-[11px] font-medium text-red-600">Código</th>
                    <th className="text-left px-5 py-2 text-[11px] font-medium text-red-600">Sucursal</th>
                    <th className="text-right px-5 py-2 text-[11px] font-medium text-red-600">Stock</th>
                    <th className="text-right px-5 py-2 text-[11px] font-medium text-red-600">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((item) => (
                    <tr key={item.producto_id} className="border-t border-red-50 hover:bg-red-50/30">
                      <td className="px-5 py-2.5 text-slate-700 font-medium truncate max-w-[200px]">
                        {item.descripcion}
                      </td>
                      <td className="px-5 py-2.5 text-slate-500 font-mono text-xs">{item.codigo_barras}</td>
                      <td className="px-5 py-2.5 text-slate-500">{item.sucursal_nombre}</td>
                      <td className={`px-5 py-2.5 text-right font-semibold ${Number(item.stock_actual) <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {Number(item.stock_actual).toFixed(1)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-500">{Number(item.stock_minimo).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Chart — BarChart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">{chartDailyTitle}</h3>
          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : data?.dailySales.length === 0 || data?.dailySales.every((d) => d.total === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin datos de ventas</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.dailySales} barCategoryGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={tickCompact}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={fmt}
                />
                <Bar dataKey="total" fill="#6D3CF5" radius={[4, 4, 0, 0]} />
              </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Sales — LineChart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">{chartMonthlyTitle}</h3>
          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : data?.monthlySales.length === 0 || data?.monthlySales.every((m) => m.total === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <TrendingUp className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin datos de ventas</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={tickCompact}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={fmt}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#6D3CF5"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#6D3CF5', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products — Horizontal BarChart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Top 5 Productos</h3>
          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : !data?.topProducts || data.topProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <ShoppingCart className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin ventas este período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                data={data.topProducts}
                layout="vertical"
                barCategoryGap={6}
                margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={tickCompact}
                />
                <YAxis
                  type="category"
                  dataKey="descripcion"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={fmt}
                />
                <Bar dataKey="total" fill="#6D3CF5" radius={[0, 4, 4, 0]} />
              </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods — PieChart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Métodos de pago</h3>
          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : !data?.paymentMethods || data.paymentMethods.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <PieChartIcon className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin datos este período</p>
              </div>
            ) : (
              <div className="flex items-center gap-4 h-full">
                <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie
                    data={data.paymentMethods.map((pm) => ({
                      name: PAYMENT_METHOD_LABELS[pm.metodo] ?? pm.metodo,
                      value: pm.total,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.paymentMethods.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={fmt}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {data.paymentMethods.map((pm, i) => {
                  const periodTotal = data.paymentMethods.reduce((s, p) => s + p.total, 0)
                  const pct = periodTotal > 0 ? (pm.total / periodTotal) * 100 : 0
                  return (
                    <div key={pm.metodo} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-slate-600 truncate">
                          {PAYMENT_METHOD_LABELS[pm.metodo] ?? pm.metodo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-medium text-slate-800">
                        <span>{formatCurrency(pm.total)}</span>
                        <span className="text-slate-400 w-8 text-right">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="max-w-xs">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Acciones rapidas
          </h2>
          <div className="space-y-2">
            <Link
              to="/dashboard/sucursales"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-slate-200 hover:border-brand-200 hover:bg-brand-50/50 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              Nueva sucursal
            </Link>
            <Link
              to="/dashboard/suscripcion"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-slate-200 hover:border-brand-200 hover:bg-brand-50/50 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
            >
              <CreditCard className="w-4 h-4 flex-shrink-0" />
              Gestionar suscripcion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
