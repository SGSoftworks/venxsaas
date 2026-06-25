import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { tenant, session } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 8) { setError('La contrasena debe tener al menos 8 caracteres'); return }
    if (form.newPassword !== form.confirmPassword) { setError('Las contrasenas no coinciden'); return }

    setLoading(true)
    try {
      const { error: updError } = await supabase.auth.updateUser({ password: form.newPassword })
      if (updError) throw updError

      await supabase.from('tenants').update({ must_change_password: false, temp_password: null }).eq('id', tenant?.id)

      await useAuthStore.getState().refreshTenant()
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar la contrasena')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    navigate('/login', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-brand-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 text-center mb-1">Cambiar contrasena</h1>
          <p className="text-sm text-slate-500 text-center mb-6">Por seguridad, debes cambiar tu contrasena antes de continuar.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nueva contrasena</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })}
                  className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-brand-500" placeholder="Minimo 8 caracteres" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirmar contrasena</label>
              <input type={show ? 'text' : 'password'} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-brand-500" placeholder="Repite tu contrasena" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Cambiando...' : 'Cambiar contrasena'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
