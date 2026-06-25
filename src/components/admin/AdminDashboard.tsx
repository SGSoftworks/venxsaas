import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort, classNames } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import type { AdminKPI, Tenant, Payment } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  Store,
  Percent,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CreditCard,
  Building2,
  Receipt,
  ArrowRight,
  Calendar,
  Ban,
  Clock,
} from 'lucide-react'

interface KPIEntry {
  key: keyof AdminKPI
  label: string
  value: string
  icon: typeof DollarSign
  trend: { direction: 'up' | 'down' | 'flat'; label: string }
  topBorder: string
  iconBg: string
  iconColor: string
}

type ClientRow = Pick<Tenant, 'id' | 'nombre_negocio' | 'email_propietario' | 'estado' | 'created_at'> & { plan_nombre?: string }

const KPI_SKELETON_COLORS = [
  'bg-brand-50 text-brand-600', 'bg-brand-50 text-brand-600',
  'bg-success-50 text-success-500', 'bg-amber-50 text-amber-600',
  'bg-brand-50 text-brand-600', 'bg-brand-50 text-brand-600',
  'bg-success-50 text-success-500', 'bg-brand-50 text-brand-600',
  'bg-danger-50 text-danger-500', 'bg-warning-50 text-warning-600',
  'bg-success-50 text-success-500',
  'bg-amber-50 text-amber-600',
]

export function AdminDashboard() {
  const { user } = useAuthStore()
  const [kpis, setKpis] = useState<AdminKPI | null>(null)
  const [recentClients, setRecentClients] = useState<ClientRow[]>([])
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const [
          { data: activeSubs },
          { count: activeCount },
          { count: pastDueCount },
          { data: currentPayments },
          { count: branchCount },
          { count: totalTenants },
          { data: clients },
          { data: payments },
          { count: invoiceCount },
          { count: suspendedCount },
          { count: expiringCount },
          { count: renewalCount },
          { count: pendingApprovalCount },
        ] = await Promise.all([
          supabase.from('subscriptions').select('plan_id, plans!inner(precio_mensual)').eq('estado', 'active'),
          supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('estado', 'active'),
          supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('estado', 'active').lt('proximo_cobro', new Date().toISOString()),
          supabase.from('payments').select('amount').eq('status', 'approved').gte('created_at', thirtyDaysAgo),
          supabase.from('branch_accounts').select('*', { count: 'exact', head: true }),
          supabase.from('tenants').select('*', { count: 'exact', head: true }),
          supabase.from('tenants').select('id, nombre_negocio, email_propietario, estado, created_at, plans!left(nombre, max_sucursales)').order('created_at', { ascending: false }).limit(5),
          supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('facturas_saas').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
          supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('estado', 'suspended'),
          supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('estado', 'active').gte('proximo_cobro', today).lte('proximo_cobro', sevenDaysFromNow),
          supabase.from('payments').select('*', { count: 'exact', head: true }).eq('tipo', 'recurring').eq('status', 'approved').gte('created_at', monthStart),
          supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('estado', 'pending_approval'),
        ])

        const mrr = (activeSubs || []).reduce((sum: number, s: Record<string, unknown>) => {
          const plans = s.plans as { precio_mensual: number } | null
          return sum + (plans?.precio_mensual ?? 0)
        }, 0)

        const monthlyRevenue = (currentPayments || []).reduce((sum: number, p: Record<string, unknown>) => sum + (p.amount as number || 0), 0)

        const active = activeCount ?? 0
        const total = totalTenants ?? 0

        if (!cancelled) {
          setKpis({
            mrr,
            arr: mrr * 12,
            activeClients: active,
            pastDueClients: pastDueCount ?? 0,
            monthlyRevenue,
            totalBranches: branchCount ?? 0,
            conversionRate: total > 0 ? Math.round((active / total) * 100) : 0,
            totalInvoices: invoiceCount ?? 0,
            suspendedClients: suspendedCount ?? 0,
            expiringSoon: expiringCount ?? 0,
            monthlyRenewals: renewalCount ?? 0,
            pendingApprovalClients: pendingApprovalCount ?? 0,
          })
        }

        const clientRows = (clients || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          nombre_negocio: c.nombre_negocio as string,
          email_propietario: c.email_propietario as string,
          estado: (c.estado as Tenant['estado']) || 'active',
          created_at: c.created_at as string,
          plan_nombre: (c.plans as { nombre: string } | null)?.nombre,
        }))
        if (!cancelled) {
          setRecentClients(clientRows)
          setRecentPayments(payments as unknown as Payment[] || [])
        }
      } catch {
        if (!cancelled) setError('Error al cargar los datos del dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [refreshKey])

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
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Bienvenido, {user?.email?.split('@')[0] || 'Administrador'}
          </p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={classNames('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading && !kpis
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-pulse-soft">
                <div className="h-1 w-full bg-slate-100" />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-slate-100 rounded" />
                      <div className="h-6 w-28 bg-slate-100 rounded" />
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-100" />
                  </div>
                  <div className="mt-3 h-3 w-14 bg-slate-50 rounded" />
                </div>
              </div>
            ))
          : kpis ? buildKPIEntries(kpis).map((kpi) => (
              <div
                key={kpi.key}
                className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 overflow-hidden group"
              >
                <div className={classNames('h-1 w-full', kpi.topBorder)} />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{kpi.value}</p>
                    </div>
                    <div className={classNames('w-10 h-10 rounded-full flex items-center justify-center shrink-0', kpi.iconBg, 'group-hover:scale-110 transition-transform duration-200')}>
                      <kpi.icon className={classNames('w-5 h-5', kpi.iconColor)} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    {kpi.trend.direction === 'up' ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-success-500" />
                    ) : kpi.trend.direction === 'down' ? (
                      <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <Minus className="w-3.5 h-3.5 text-slate-300" />
                    )}
                    <span className={classNames(
                      'text-xs font-medium',
                      kpi.trend.direction === 'up' ? 'text-success-500' : kpi.trend.direction === 'down' ? 'text-red-500' : 'text-slate-400'
                    )}>{kpi.trend.label}</span>
                  </div>
                </div>
              </div>
            )) : null}
      </div>

      {/* Recent Clients & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Clientes recientes</h2>
              <p className="text-[11px] text-slate-400">Últimos registros</p>
            </div>
          </div>
          {loading && recentClients.length === 0 ? (
            <TableSkeleton rows={3} cols={4} />
          ) : recentClients.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Users} title="No hay clientes registrados aún" description="Los nuevos clientes aparecerán aquí automáticamente" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Negocio</th>
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Plan</th>
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Estado</th>
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClients.slice(0, 3).map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-b-0">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-800">{c.nombre_negocio}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{c.email_propietario}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-600">{c.plan_nombre || '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={c.estado} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDateShort(c.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Pagos recientes</h2>
              <p className="text-[11px] text-slate-400">Últimas transacciones</p>
            </div>
          </div>
          {loading && recentPayments.length === 0 ? (
            <TableSkeleton rows={3} cols={4} />
          ) : recentPayments.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={CreditCard} title="No hay pagos registrados aún" description="Los pagos aparecerán aquí automáticamente" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Monto</th>
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Método</th>
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Estado</th>
                    <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.slice(0, 3).map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-b-0">
                      <td className="px-5 py-3">
                        <span className="text-sm font-semibold text-slate-800">{formatCurrency(p.amount)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-600 capitalize">{p.payment_method_type || '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDateShort(p.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Acciones rápidas</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/clientes"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow"
          >
            <Users className="w-4 h-4 text-brand-600" />
            Ver clientes
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 ml-1" />
          </Link>
          <Link
            to="/admin/pagos"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow"
          >
            <CreditCard className="w-4 h-4 text-brand-600" />
            Ver pagos
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 ml-1" />
          </Link>
          <Link
            to="/admin/facturacion"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow"
          >
            <Receipt className="w-4 h-4 text-brand-600" />
            Ver facturación
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-success-50 text-success-600 border-success-200',
    pending_payment: 'bg-warning-50 text-warning-600 border-warning-200',
    pending: 'bg-warning-50 text-warning-600 border-warning-200',
    suspended: 'bg-danger-50 text-danger-500 border-danger-200',
    cancelled: 'bg-danger-50 text-danger-500 border-danger-200',
    approved: 'bg-success-50 text-success-600 border-success-200',
    declined: 'bg-danger-50 text-danger-500 border-danger-200',
    voided: 'bg-slate-50 text-slate-500 border-slate-200',
    error: 'bg-danger-50 text-danger-500 border-danger-200',
    pending_approval: 'bg-amber-50 text-amber-600 border-amber-200',
  }
  const labels: Record<string, string> = {
    active: 'Activo',
    pending_payment: 'Pendiente',
    pending: 'Pendiente',
    suspended: 'Suspendido',
    cancelled: 'Cancelado',
    approved: 'Aprobado',
    declined: 'Rechazado',
    voided: 'Anulado',
    error: 'Error',
    pending_approval: 'Pendiente aprobacion',
  }

  return (
    <span className={classNames('inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', colors[status] || 'bg-slate-50 text-slate-500 border-slate-200')}>
      {labels[status] || status}
    </span>
  )
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="p-5 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse-soft">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-slate-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function buildKPIEntries(kpis: AdminKPI): KPIEntry[] {
  return [
    {
      key: 'mrr',
      label: 'MRR',
      value: formatCurrency(kpis.mrr),
      icon: DollarSign,
      trend: { direction: kpis.mrr > 0 ? 'up' : 'flat', label: 'Actual' },
      topBorder: 'bg-brand-600',
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
    },
    {
      key: 'arr',
      label: 'ARR',
      value: formatCurrency(kpis.arr),
      icon: TrendingUp,
      trend: { direction: kpis.arr > 0 ? 'up' : 'flat', label: 'Proyectado' },
      topBorder: 'bg-brand-600',
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
    },
    {
      key: 'activeClients',
      label: 'Clientes activos',
      value: String(kpis.activeClients),
      icon: Users,
      trend: { direction: 'up', label: 'Activos' },
      topBorder: 'bg-success-500',
      iconBg: 'bg-success-50',
      iconColor: 'text-success-500',
    },
    {
      key: 'pastDueClients',
      label: 'Pagos vencidos',
      value: String(kpis.pastDueClients),
      icon: AlertTriangle,
      trend: { direction: kpis.pastDueClients > 0 ? 'down' : 'flat', label: kpis.pastDueClients > 0 ? 'Requieren atención' : 'Al día' },
      topBorder: 'bg-amber-500',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      key: 'monthlyRevenue',
      label: 'Ingreso mensual',
      value: formatCurrency(kpis.monthlyRevenue),
      icon: DollarSign,
      trend: { direction: kpis.monthlyRevenue > 0 ? 'up' : 'flat', label: 'Últimos 30 días' },
      topBorder: 'bg-brand-600',
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
    },
    {
      key: 'totalBranches',
      label: 'Sucursales',
      value: String(kpis.totalBranches),
      icon: Building2,
      trend: { direction: kpis.totalBranches > 0 ? 'up' : 'flat', label: 'Total' },
      topBorder: 'bg-brand-600',
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
    },
    {
      key: 'conversionRate',
      label: 'Conversión',
      value: `${kpis.conversionRate}%`,
      icon: Percent,
      trend: { direction: kpis.conversionRate >= 50 ? 'up' : kpis.conversionRate > 0 ? 'down' : 'flat', label: `${kpis.conversionRate}%` },
      topBorder: 'bg-success-500',
      iconBg: 'bg-success-50',
      iconColor: 'text-success-500',
    },
    {
      key: 'totalInvoices',
      label: 'Facturas',
      value: String(kpis.totalInvoices),
      icon: Receipt,
      trend: { direction: 'flat', label: 'Total' },
      topBorder: 'bg-brand-600',
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
    },
    {
      key: 'suspendedClients',
      label: 'Suspendidos',
      value: String(kpis.suspendedClients),
      icon: Ban,
      trend: { direction: kpis.suspendedClients > 0 ? 'down' : 'flat', label: kpis.suspendedClients > 0 ? 'Requieren acción' : 'Ninguno' },
      topBorder: 'bg-danger-500',
      iconBg: 'bg-danger-50',
      iconColor: 'text-danger-500',
    },
    {
      key: 'expiringSoon',
      label: 'Próximos a vencer',
      value: String(kpis.expiringSoon),
      icon: Clock,
      trend: { direction: kpis.expiringSoon > 0 ? 'down' : 'flat', label: '7 días' },
      topBorder: 'bg-warning-500',
      iconBg: 'bg-warning-50',
      iconColor: 'text-warning-600',
    },
    {
      key: 'monthlyRenewals',
      label: 'Renovaciones del mes',
      value: String(kpis.monthlyRenewals),
      icon: RefreshCw,
      trend: { direction: kpis.monthlyRenewals > 0 ? 'up' : 'flat', label: 'Este mes' },
      topBorder: 'bg-success-500',
      iconBg: 'bg-success-50',
      iconColor: 'text-success-500',
    },
    {
      key: 'pendingApprovalClients',
      label: 'Pendientes aprobacion',
      value: String(kpis.pendingApprovalClients),
      icon: Clock,
      trend: { direction: kpis.pendingApprovalClients > 0 ? 'down' : 'flat', label: kpis.pendingApprovalClients > 0 ? 'Requieren accion' : 'Ninguno' },
      topBorder: 'bg-amber-500',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ]
}
