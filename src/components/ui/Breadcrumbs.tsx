import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  admin: 'Gerencia',
  suscripcion: 'Mi Suscripción',
  sucursales: 'Sucursales',
  facturas: 'Facturas',
  analitica: 'Analítica',
  clientes: 'Clientes',
  pagos: 'Pagos',
  facturacion: 'Facturación',
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    const isLast = index === segments.length - 1
    return { path, label, isLast }
  })

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-xs text-slate-400">
        <li>
          <Link to="/" className="hover:text-slate-600 transition-colors">
            <Home size={14} />
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.path} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-slate-300" />
            {crumb.isLast ? (
              <span className="text-slate-600 font-medium">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="hover:text-slate-600 transition-colors">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
