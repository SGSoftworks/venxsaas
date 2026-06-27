import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { Clock, MessageCircle, Mail } from 'lucide-react'
import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'

export function PendingApprovalPage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md mx-auto text-center animate-scale-in">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
            <Clock className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Cuenta en revision</h2>
            <p className="text-sm text-slate-500 mt-2">
              Tu pago ha sido confirmado exitosamente. Un administrador esta revisando tu cuenta y la activara en breve.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            Cerrar sesion
          </button>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
            <a
              href={buildWhatsAppUrl('Hola. Mi cuenta esta en revision. Podrian agilizar el proceso?')}
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
        </div>
      </div>
    </div>
  )
}
