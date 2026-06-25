import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
  DollarSign,
  TrendingUp,
  Users2,
  ShoppingBag,
  CreditCard,
  ChevronDown,
  MoreHorizontal,
  BarChart3,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: ShoppingCart, label: 'POS' },
  { icon: Package, label: 'Productos' },
  { icon: Users, label: 'Clientes' },
  { icon: CreditCard, label: 'Pagos' },
  { icon: BarChart3, label: 'Analítica' },
  { icon: Settings, label: 'Config' },
]

const KPI_CARDS = [
  { icon: DollarSign, label: 'Ventas hoy', value: '$2,847.50', trend: '+12.5%', color: 'bg-brand-50 text-brand-600' },
  { icon: ShoppingBag, label: 'Órdenes', value: '47', trend: '+8.2%', color: 'bg-accent-50 text-accent-600' },
  { icon: Users2, label: 'Clientes', value: '128', trend: '+3.1%', color: 'bg-success-50 text-success-500' },
  { icon: TrendingUp, label: 'Ticket prom.', value: '$60.58', trend: '+5.7%', color: 'bg-warning-50 text-warning-500' },
]

const TABLE_ROWS = [
  { id: '#ORD-1042', cliente: 'María Gómez', monto: '$185.00', estado: 'Completada' },
  { id: '#ORD-1041', cliente: 'Carlos Ruiz', monto: '$94.50', estado: 'Completada' },
  { id: '#ORD-1040', cliente: 'Ana Torres', monto: '$230.00', estado: 'Pendiente' },
  { id: '#ORD-1039', cliente: 'Luis Díaz', monto: '$72.80', estado: 'Completada' },
  { id: '#ORD-1038', cliente: 'Sofía León', monto: '$156.20', estado: 'Cancelada' },
]

export function DashboardMockup() {
  return (
    <div className="rounded-2xl border border-slate-200 shadow-xl bg-white overflow-hidden animate-[float_6s_ease-in-out_infinite]">
      <div className="flex h-[420px]">
        <div className="w-[180px] bg-slate-900 shrink-0 flex flex-col">
          <div className="px-4 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-600" />
              <span className="text-sm font-bold text-white">VenxPOS</span>
            </div>
          </div>

          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                {label}
              </div>
            ))}
          </nav>

          <div className="px-4 py-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-700" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 truncate">Admin</p>
              </div>
              <ChevronDown size={12} className="text-slate-500" />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Dashboard</h2>
            <span className="text-[10px] text-slate-400 tabular-nums">Jun 2026</span>
          </div>

          <div className="flex-1 p-5 space-y-4 overflow-hidden">
            <div className="grid grid-cols-4 gap-3">
              {KPI_CARDS.map(({ icon: Icon, label, value, trend, color }) => (
                <div
                  key={label}
                  className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-sm transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
                      <Icon size={13} />
                    </div>
                    <span className="text-[10px] font-semibold text-success-500">{trend}</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 tabular-nums">{value}</p>
                  <p className="text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-700">Ventas diarias</h4>
                  <MoreHorizontal size={14} className="text-slate-400" />
                </div>
                <div className="flex items-end gap-2 h-[100px]">
                  {[40, 65, 45, 80, 55, 90, 70, 50, 75, 60, 85, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-brand-200 hover:bg-brand-400 transition-colors cursor-pointer"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D', 'L', 'M', 'M', 'J', 'V'].map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-xs font-semibold text-slate-700 mb-3">Actividad</h4>
                <div className="space-y-3">
                  {[
                    { icon: ShoppingBag, text: 'Nueva orden #1042', time: '2m', color: 'bg-brand-50 text-brand-600' },
                    { icon: Users2, text: 'Cliente registrado', time: '15m', color: 'bg-accent-50 text-accent-600' },
                    { icon: DollarSign, text: 'Pago recibido $185', time: '32m', color: 'bg-success-50 text-success-500' },
                    { icon: Package, text: 'Stock actualizado', time: '1h', color: 'bg-warning-50 text-warning-500' },
                  ].map(({ icon: Icon, text, time, color }) => (
                    <div key={text} className="flex items-start gap-2.5">
                      <div className={`w-6 h-6 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                        <Icon size={11} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-700 truncate">{text}</p>
                        <p className="text-[10px] text-slate-400">{time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase">Orden</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase">Cliente</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase">Monto</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2 text-[11px] font-medium text-slate-900 tabular-nums">{row.id}</td>
                      <td className="px-4 py-2 text-[11px] text-slate-600">{row.cliente}</td>
                      <td className="px-4 py-2 text-[11px] font-medium text-slate-900 tabular-nums">{row.monto}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            row.estado === 'Completada'
                              ? 'bg-success-50 text-success-600'
                              : row.estado === 'Pendiente'
                                ? 'bg-warning-50 text-warning-600'
                                : 'bg-danger-50 text-danger-500'
                          }`}
                        >
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
