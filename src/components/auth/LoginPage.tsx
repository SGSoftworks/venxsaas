import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { loginSchema, type LoginForm } from '@/lib/validators'
import { Eye, EyeOff, Loader2, ExternalLink } from 'lucide-react'
import { APP_CONFIG } from '@/lib/appConfig'
import iconApp from '@/assets/branding/icon-app.png'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { addToast } = useUIStore()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    const result = await login(data.email, data.password)
    if (result.error) {
      setServerError(result.error)
      return
    }

    const { tenant, isSuperadmin } = useAuthStore.getState()

    if (result.mustChangePassword) {
      navigate('/cambiar-contrasena', { replace: true })
    } else if (result.needsApproval || tenant?.estado === 'pending_approval') {
      navigate('/esperando-aprobacion', { replace: true })
    } else if (result.needsPayment || tenant?.estado === 'pending_payment') {
      navigate('/pago', { replace: true })
    } else if (isSuperadmin) {
      navigate('/admin', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
    addToast('success', 'Inicio de sesión exitoso')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center gap-4 mb-8">
            <img src={iconApp} alt="" className="w-12 h-12" />
            <div className="text-center">
              <h1 className="text-lg font-bold text-slate-900">Iniciar sesión</h1>
              <p className="text-sm text-slate-500 mt-0.5">VenxPOS</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {serverError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                placeholder="tu@correo.com"
                {...register('email')}
              />
              {errors.email && (
                <span className="text-xs text-red-600">{errors.email.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  placeholder="Tu contraseña"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs text-red-600">{errors.password.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors mt-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              Contacta a Gerencia para solicitar acceso.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center mb-2">¿Buscas el Sistema POS?</p>
              <a
                href={APP_CONFIG.POS_WEB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 w-full text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                Acceder al POS
                <ExternalLink size={14} />
              </a>
            </div>
        </div>
      </div>
    </div>
  )
}
