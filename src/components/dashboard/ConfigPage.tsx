import { useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { supabase } from '@/lib/supabase/client'
import { useUIStore } from '@/store/useUIStore'
import { APP_CONFIG, buildWhatsAppUrl } from '@/lib/appConfig'
import { Loader2, Building2, MapPin, Phone, Hash, CreditCard, MessageCircle } from 'lucide-react'

export function ConfigPage() {
  const { tenant, plan, refreshTenant } = useAuthStore()
  const { addToast } = useUIStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre_negocio: tenant?.nombre_negocio || '',
    telefono: tenant?.telefono || '',
    nit: tenant?.nit || '',
  })

  if (!tenant) return null

  const handleSave = async () => {
    if (!form.nombre_negocio.trim()) {
      addToast('error', 'El nombre del negocio es requerido')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          nombre_negocio: form.nombre_negocio.trim(),
          telefono: form.telefono.trim() || null,
          nit: form.nit.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id)

      if (error) throw error
      await refreshTenant()
      addToast('success', 'Datos actualizados correctamente')
    } catch {
      addToast('error', 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Configuracion</h1>
        <p className="text-sm text-slate-500 mt-0.5">Actualiza los datos de tu negocio</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Informacion del negocio</h2>
            {tenant.client_id && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full border border-brand-200">
                <Hash className="w-3 h-3" />
                ID: {tenant.client_id}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Nombre del negocio
            </label>
            <input value={form.nombre_negocio} onChange={e => setForm({ ...form, nombre_negocio: e.target.value })}
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-brand-500" placeholder="Mi Negocio" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400" />Telefono
            </label>
            <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-brand-500" placeholder="300 123 4567" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />NIT
            </label>
            <input value={form.nit} onChange={e => setForm({ ...form, nit: e.target.value })}
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-brand-500" placeholder="123456789-0" />
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-400">
            El correo electronico y la contrasena no se pueden modificar desde aqui. Contacta a soporte si necesitas cambiarlos.
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
              <CreditCard className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-800">Plan actual</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Plan</span>
                <span className="font-semibold text-slate-800">{plan?.nombre || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Sucursales</span>
                <span className="font-semibold text-slate-800">{plan?.max_sucursales || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Mensualidad</span>
                <span className="font-semibold text-slate-800">{plan?.precio_mensual ? `$${plan.precio_mensual.toLocaleString()}` : '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <h2 className="text-sm font-semibold text-slate-800">Ayuda</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Para renovar o cambiar tu plan, contactanos directamente.</p>
            <a href={buildWhatsAppUrl(`Hola, soy el cliente ${tenant.nombre_negocio}. ID Cliente: ${tenant.client_id || 'N/A'}. Necesito ayuda con mi cuenta.`)}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
              <MessageCircle className="w-4 h-4" />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
