import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { classNames, getStatusColor, isSubscriptionExpiringSoon, daysUntil } from '@/lib/utils'
import { buildWhatsAppUrl } from '@/lib/appConfig'
import iconApp from '@/assets/branding/icon-app.png'
import {
  LayoutDashboard,
  CreditCard,
  Store,
  FileText,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Loader2,
  MessageCircle,
  AlertCircle,
  SlidersHorizontal,
  Package,
} from 'lucide-react'

interface NavItem { to: string; icon: React.ComponentType<{ className?: string }>; label: string; end?: boolean }

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/facturas', icon: FileText, label: 'Facturas' },
  { to: '/dashboard/analitica', icon: TrendingUp, label: 'Analitica' },
  { to: '/dashboard/suscripcion', icon: CreditCard, label: 'Mi Suscripcion' },
  { to: '/dashboard/sucursales', icon: Store, label: 'Sucursales' },
  { to: '/dashboard/inventario', icon: Package, label: 'Inventario' },
] satisfies NavItem[]

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    session,
    user,
    tenant,
    plan,
    subscription,
    loading,
    initialized,
    logout,
  } = useAuthStore()
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()

  useEffect(() => {
    if (!initialized) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    if (tenant?.estado === 'pending_payment') {
      navigate('/pago', { replace: true })
    }
    if (tenant?.estado === 'pending_approval') {
      navigate('/login', { replace: true })
    }
  }, [initialized, session, tenant, navigate, location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  if (!initialized || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img src={iconApp} alt="" className="w-12 h-12" />
          <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={classNames(
          'fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100">
          <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
            <img src={iconApp} alt="" className="w-8 h-8 flex-shrink-0" />
            <span className="font-bold text-slate-800 text-lg">VenxPOS</span>
          </NavLink>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Divider + User Info */}
        <div className="border-t border-slate-200 px-3 py-3 space-y-2">
          <div className="px-2 space-y-1">
            {tenant?.nombre_negocio && (
              <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight" title={tenant.nombre_negocio}>
                {tenant.nombre_negocio}
              </p>
            )}
            <p className="text-[11px] text-slate-400 truncate leading-tight" title={user?.email}>
              {user?.email}
            </p>
            {plan && (
              <span
                className={classNames(
                  'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border mt-1',
                  getStatusColor(plan.activo ? 'active' : 'cancelled')
                )}
              >
                {plan.nombre}
              </span>
            )}
          </div>
          <NavLink
            to="/dashboard/configuracion"
            className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Configuracion
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesion
          </button>
          <div className="flex items-center gap-1.5 px-2 pt-0.5">
            <MessageCircle className="w-3 h-3 text-slate-300" />
            <span className="text-[10px] text-slate-400">573228372341</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top header */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <Breadcrumbs />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {subscription && tenant?.estado === 'active' && isSubscriptionExpiringSoon(subscription) && (
            <div className={`mb-4 p-4 rounded-xl flex items-start gap-3 ${
              daysUntil(subscription.proximo_cobro) <= 3 ? 'bg-red-50 border border-red-200' :
              daysUntil(subscription.proximo_cobro) <= 5 ? 'bg-amber-50 border border-amber-200' :
              'bg-warning-50 border border-warning-200'
            }`}>
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                daysUntil(subscription.proximo_cobro) <= 3 ? 'text-red-500' : 'text-amber-500'
              }`} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {daysUntil(subscription.proximo_cobro) === 0
                    ? 'Tu suscripcion vence hoy'
                    : daysUntil(subscription.proximo_cobro) < 0
                    ? 'Tu suscripcion ha vencido'
                    : `Tu suscripcion vence en ${daysUntil(subscription.proximo_cobro)} dia${daysUntil(subscription.proximo_cobro) !== 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {daysUntil(subscription.proximo_cobro) < 0
                    ? 'Renueva para recuperar el acceso completo.'
                    : 'Realiza el pago para evitar la suspension de tu cuenta.'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Link to="/dashboard/suscripcion" className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline">
                    Ir a Mi Suscripcion
                  </Link>
                  <a href={buildWhatsAppUrl('Hola, solicito renovar mi suscripcion VenxPOS.')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Solicitar renovacion
                  </a>
                </div>
              </div>
            </div>
          )}
          {subscription && tenant?.estado === 'active' && daysUntil(subscription.proximo_cobro) < 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">Suscripcion vencida</p>
                <p className="text-xs text-red-600 mt-1">Tu suscripcion ha vencido. Renueva para recuperar el acceso a todas las funciones.</p>
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
