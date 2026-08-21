import { type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { Loader2, AlertCircle, Ban, Clock, MessageCircle, Mail, ExternalLink, ArrowLeft, Monitor } from 'lucide-react'
import iconApp from '@/assets/branding/icon-app.png'

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <img src={iconApp} alt="" className="w-12 h-12" />
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
      </div>
    </div>
  )
}

function StatusMessage({ estado }: { estado: string }) {
  const config: Record<string, { icon: typeof Clock; color: string; title: string; message: string }> = {
    suspended: {
      icon: Ban, color: 'text-red-600 bg-red-100',
      title: 'Cuenta suspendida',
      message: 'Tu cuenta ha sido suspendida temporalmente. Ponte en contacto con soporte para mas informacion.',
    },
    cancelled: {
      icon: AlertCircle, color: 'text-gray-500 bg-gray-100',
      title: 'Cuenta cancelada',
      message: 'Tu cuenta ha sido cancelada. Si crees que esto es un error, contacta a soporte.',
    },
    pending_approval: {
      icon: Clock, color: 'text-amber-600 bg-amber-100',
      title: 'Cuenta en revision',
      message: 'Tu pago ha sido confirmado. Un administrador esta revisando tu cuenta y la activara pronto.',
    },
  }

  const c = config[estado] || { icon: AlertCircle, color: 'text-gray-500 bg-gray-100', title: 'Estado desconocido', message: 'Contacta a soporte.' }
  const Icon = c.icon

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center animate-scale-in">
        <div className="flex flex-col items-center gap-4">
          <div className={`w-14 h-14 ${c.color.split(' ')[1]} rounded-2xl flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${c.color.split(' ')[0]}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{c.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{c.message}</p>
          </div>

          {estado === 'pending_approval' && (
            <div className="flex items-center gap-3 mt-1">
              <a
                href={buildWhatsAppUrl('Hola. Mi cuenta esta en revision en VenxPOS. Podrian agilizar el proceso?')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
              <a
                href={`mailto:${APP_CONFIG.email}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NoAccessMessage({ isPOSUser }: { isPOSUser: boolean }) {
  const { logout } = useAuthStore()

  const goToPOS = () => {
    logout()
    window.open(APP_CONFIG.POS_WEB_URL, '_blank', 'noopener,noreferrer')
  }

  if (isPOSUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center animate-scale-in">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center">
              <Monitor className="w-7 h-7 text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Esta cuenta pertenece al Sistema POS</h2>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                La cuenta con la que intentas iniciar sesión está registrada para utilizar el Sistema POS de VenxPOS.
              </p>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                El Panel Administrativo (SaaS) y el Sistema POS son plataformas diferentes, aunque comparten la misma información del negocio.
              </p>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                Si deseas registrar ventas, administrar caja, inventario y operar tu punto de venta, ingresa directamente al Sistema POS.
              </p>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                Si crees que se trata de un error, comunícate con la Gerencia de VenxPOS.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2 mt-2">
              <button
                onClick={goToPOS}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg font-semibold text-sm hover:bg-brand-700 transition-colors"
              >
                <Monitor className="w-4 h-4" />
                Ir al Sistema POS
                <ExternalLink className="w-4 h-4" />
              </button>
              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center animate-scale-in">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sin acceso</h2>
            <p className="text-sm text-slate-500 mt-2">
              No tienes acceso al panel SaaS. Si crees que esto es un error, contacta a soporte.
            </p>
          </div>
          <button
            onClick={logout}
            className="mt-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, tenant, subscription, isSuperadmin, loading, initialized } = useAuthStore()
  const location = useLocation()

  if (!initialized || loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!tenant && !isSuperadmin) return <NoAccessMessage isPOSUser={!tenant && !!session} />
  if (tenant?.estado === 'suspended') return <StatusMessage estado="suspended" />
  if (tenant?.estado === 'cancelled') return <StatusMessage estado="cancelled" />
  if (tenant?.estado === 'pending_approval') return <StatusMessage estado="pending_approval" />

  if (subscription?.estado === 'expired') return <StatusMessage estado="suspended" />

  return <>{children}</>
}
