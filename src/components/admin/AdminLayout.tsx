import { Navigate, Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  BarChart3,
  ClipboardList,
  Menu,
  X,
  LogOut,
  FileCheck,
} from 'lucide-react'
import iconApp from '@/assets/branding/icon-app.png'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/clientes', icon: Users, label: 'Clientes' },
  { to: '/admin/pagos', icon: CreditCard, label: 'Pagos' },
  { to: '/admin/facturacion', icon: DollarSign, label: 'Facturación' },
  { to: '/admin/analitica', icon: BarChart3, label: 'Analítica' },
  { to: '/admin/solicitudes', icon: ClipboardList, label: 'Solicitudes' },
]

export function AdminLayout() {
  const { isSuperadmin, loading, user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <img src={iconApp} alt="" className="w-10 h-10" />
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!isSuperadmin) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 w-60 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-200 shrink-0">
          <img src={iconApp} alt="" className="w-8 h-8 shrink-0" />
          <div className="overflow-hidden whitespace-nowrap">
            <p className="text-sm font-bold text-slate-900 leading-tight">VenxPOS</p>
            <p className="text-[10px] text-slate-400 leading-tight">Panel de Gerencia</p>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-2.5 shrink-0">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-slate-500">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-700 truncate">{user?.email}</p>
              <p className="text-[10px] text-slate-400">Gerencia</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center gap-3 px-4 border-b border-slate-200 bg-white lg:hidden shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
          >
            {sidebarOpen ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
          </button>
          <span className="text-sm font-bold text-slate-800">VenxPOS</span>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 xl:p-8">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
