import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'
import { formatCurrency, formatDateShort, classNames } from '@/lib/utils'
import { exportToExcel } from '@/lib/export'
import { TrendingUp, DollarSign, ShoppingCart, Package, Store, Calendar, Download, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'

interface BranchOption { sucursal_id: string; nombre_sucursal: string }

const COLORS = ['#6D3CF5', '#8B5CF6', '#16D6C1', '#10B981', '#F59E0B', '#5B2EE0', '#94A3B8']

export function AnalyticsPage() {
  const { tenant } = useAuthStore()
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ventasHoy, setVentasHoy] = useState(0)
  const [ventasMes, setVentasMes] = useState(0)
  const [ventasAno, setVentasAno] = useState(0)
  const [ticketPromedio, setTicketPromedio] = useState(0)
  const [productosVendidos, setProductosVendidos] = useState(0)
  const [ganancia, setGanancia] = useState(0)
  const [ivaRecaudado, setIvaRecaudado] = useState(0)
  const [dailySales, setDailySales] = useState<{ date: string; total: number }[]>([])
  const [monthlySales, setMonthlySales] = useState<{ mes: string; total: number }[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([])
  const [paymentMethods, setPaymentMethods] = useState<{ name: string; value: number }[]>([])

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    setError(null)
    const cancelled = { current: false }
    try {
      let sucursalIds: string[] = []

      const { data: branchData } = await supabase
        .from('branch_accounts')
        .select('sucursal_id, nombre_sucursal')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)

      if (branchData) {
        setBranches(branchData.filter(b => b.sucursal_id))
        sucursalIds = selectedBranch
          ? [selectedBranch]
          : branchData.filter(b => b.sucursal_id).map(b => b.sucursal_id!)
      }

      if (sucursalIds.length === 0) {
        setLoading(false)
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()

      const [{ data: ventasHoyData }, { data: ventasMesData }, { data: ventasAnoData }, { data: mesVentasIds }] =
        await Promise.all([
          supabase.from('ventas').select('total, metodo_pago').in('sucursal_id', sucursalIds).gte('fecha_hora', today).lte('fecha_hora', today + 'T23:59:59'),
          supabase.from('ventas').select('total, metodo_pago').in('sucursal_id', sucursalIds).gte('fecha_hora', monthStart).lte('fecha_hora', new Date().toISOString()),
          supabase.from('ventas').select('total, metodo_pago').in('sucursal_id', sucursalIds).gte('fecha_hora', yearStart).lte('fecha_hora', new Date().toISOString()),
          supabase.from('ventas').select('id, metodo_pago').in('sucursal_id', sucursalIds).gte('fecha_hora', monthStart),
        ])

      if (cancelled.current) return

      const hoyTotal = (ventasHoyData || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.total || 0), 0)
      const mesTotal = (ventasMesData || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.total || 0), 0)
      const anoTotal = (ventasAnoData || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.total || 0), 0)
      const mesCount = (ventasMesData || []).length

      setVentasHoy(hoyTotal)
      setVentasMes(mesTotal)
      setVentasAno(anoTotal)
      setTicketPromedio(mesCount > 0 ? mesTotal / mesCount : 0)

      const pmGrouped = new Map<string, number>()
      for (const v of (ventasMesData || []) as { total: number; metodo_pago: string }[]) {
        const mp = v.metodo_pago ?? 'OTRO'
        pmGrouped.set(mp, (pmGrouped.get(mp) || 0) + Number(v.total || 0))
      }
      setPaymentMethods(
        Array.from(pmGrouped.entries()).map(([name, value]) => ({ name, value }))
      )

      const ventasIds = ((mesVentasIds || []) as { id: string }[]).map(v => v.id)
      if (ventasIds.length > 0) {
        const { data: detallesData } = await supabase
          .from('venta_detalles')
          .select('cantidad_o_peso, subtotal, costo_aplicado, tarifa_iva_aplicada')
          .in('venta_id', ventasIds)
        const detalles = (detallesData || []) as { cantidad_o_peso: number; subtotal: number; costo_aplicado: number; tarifa_iva_aplicada: number }[]
        setProductosVendidos(detalles.reduce((s, d) => s + Number(d.cantidad_o_peso || 0), 0))
        setGanancia(detalles.reduce((s, d) => s + (Number(d.subtotal || 0) - Number(d.costo_aplicado || 0)), 0))
        setIvaRecaudado(detalles.reduce((s, d) => s + (Number(d.subtotal || 0) * Number(d.tarifa_iva_aplicada || 0)), 0))
      }

      if (cancelled.current) return

      const { data: dailyRaw } = await supabase
        .from('ventas')
        .select('fecha_hora, total, metodo_pago')
        .in('sucursal_id', sucursalIds)
        .gte('fecha_hora', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('fecha_hora', { ascending: true })

      const dailyMap = new Map<string, number>()
      for (const v of (dailyRaw || []) as { fecha_hora: string; total: number }[]) {
        const d = v.fecha_hora.split('T')[0]
        dailyMap.set(d, (dailyMap.get(d) || 0) + Number(v.total || 0))
      }
      setDailySales(Array.from(dailyMap.entries()).map(([date, total]) => ({ date, total })))

      if (cancelled.current) return

      const { data: monthlyRaw } = await supabase
        .from('ventas')
        .select('fecha_hora, total, metodo_pago')
        .in('sucursal_id', sucursalIds)
        .gte('fecha_hora', yearStart)
        .order('fecha_hora', { ascending: true })

      const monthlyMap = new Map<string, number>()
      for (const v of (monthlyRaw || []) as { fecha_hora: string; total: number }[]) {
        const m = v.fecha_hora.substring(0, 7)
        monthlyMap.set(m, (monthlyMap.get(m) || 0) + Number(v.total || 0))
      }
      setMonthlySales(
        Array.from(monthlyMap.entries()).map(([mes, total]) => {
          const [y, m] = mes.split('-')
          const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
          return { mes: `${months[parseInt(m, 10) - 1]} ${y}`, total }
        })
      )

      if (cancelled.current) return

      if (ventasIds.length > 0) {
        const { data: topRaw } = await supabase
          .from('venta_detalles')
          .select('producto_id, cantidad_o_peso, productos!inner(descripcion)')
          .in('venta_id', ventasIds)
          .limit(100)

        const productMap = new Map<string, number>()
        for (const d of (topRaw || []) as unknown as { producto_id: string; cantidad_o_peso: number; productos: { descripcion: string } }[]) {
          const name = d.productos?.descripcion || d.producto_id
          productMap.set(name, (productMap.get(name) || 0) + Number(d.cantidad_o_peso || 0))
        }
        setTopProducts(
          Array.from(productMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, qty]) => ({ name, qty }))
        )
      }

      if (cancelled.current) return
    } catch {
      setError('Error al cargar datos de analítica')
    } finally {
      if (!cancelled.current) setLoading(false)
    }
    return () => { cancelled.current = true }
  }, [tenant?.id, selectedBranch])

  useEffect(() => { fetchData() }, [fetchData])

  if (!tenant) return null

  const handleExport = () => {
    const exportData = [
      ...dailySales.map(d => ({ Indicador: 'Ventas Diarias', Fecha: d.date, Valor: d.total })),
      ...monthlySales.map(m => ({ Indicador: 'Ventas Mensuales', Mes: m.mes, Valor: m.total })),
      ...topProducts.map(p => ({ Indicador: 'Top Productos', Producto: p.name, Cantidad: p.qty })),
    ]
    exportToExcel(exportData as Record<string, unknown>[], [
      { key: 'Indicador', header: 'Indicador' },
      { key: 'Fecha', header: 'Fecha' },
      { key: 'Valor', header: 'Valor' },
    ], 'analitica')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Analítica</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Datos de ventas y rendimiento</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            >
              <option value="">Todas las sucursales</option>
              {branches.map(b => (
                <option key={b.sucursal_id} value={b.sucursal_id!}>{b.nombre_sucursal}</option>
              ))}
            </select>
          </div>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={fetchData} className="ml-auto flex items-center gap-1 text-red-600 hover:underline"><RefreshCw className="w-3.5 h-3.5" /> Reintentar</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse-soft" />
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse-soft" />
              </div>
            ))
          : (
            <>
              <StatCard icon={DollarSign} label="Ventas Hoy" value={formatCurrency(ventasHoy)} color="text-brand-600" bg="bg-brand-50" />
              <StatCard icon={TrendingUp} label="Ventas Mes" value={formatCurrency(ventasMes)} color="text-brand-600" bg="bg-brand-50" />
              <StatCard icon={Calendar} label="Ventas Año" value={formatCurrency(ventasAno)} color="text-success-500" bg="bg-success-50" />
              <StatCard icon={ShoppingCart} label="Ticket Promedio" value={formatCurrency(ticketPromedio)} color="text-amber-600" bg="bg-amber-50" />
            </>
          )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse-soft" />
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse-soft" />
              </div>
            ))
          : (
            <>
              <StatCard icon={Package} label="Productos Vendidos" value={productosVendidos.toLocaleString()} color="text-brand-600" bg="bg-brand-50" />
              <StatCard icon={TrendingUp} label="Ganancia" value={formatCurrency(ganancia)} color="text-green-600" bg="bg-green-50" />
              <StatCard icon={DollarSign} label="IVA Recaudado" value={formatCurrency(ivaRecaudado)} color="text-brand-600" bg="bg-brand-50" />
            </>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Ventas Diarias (7 días)</h2>
          </div>
          <div className="p-4 h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : dailySales.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px] text-slate-400">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="total" fill="#6D3CF5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Ventas Mensuales</h2>
          </div>
          <div className="p-4 h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : monthlySales.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px] text-slate-400">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Line type="monotone" dataKey="total" stroke="#6D3CF5" strokeWidth={2} dot={{ r: 3, fill: '#6D3CF5' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Top Productos</h2>
          </div>
          <div className="p-4 h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : topProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px] text-slate-400">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={75} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="qty" fill="#64748b" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Métodos de Pago</h2>
          </div>
          <div className="p-4 h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px] text-slate-400">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentMethods} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={(entry: unknown) => `${(entry as Record<string, unknown>).name} ${(Number((entry as Record<string, unknown>).percent) * 100).toFixed(0)}%`}>
                    {paymentMethods.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-slate-800 mt-0.5 font-mono">{value}</p>
      </div>
    </div>
  )
}
