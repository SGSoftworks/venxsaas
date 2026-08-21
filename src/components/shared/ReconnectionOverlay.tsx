import { useUIStore } from '@/store/useUIStore'
import { Loader2, WifiOff } from 'lucide-react'

export function ReconnectionOverlay() {
  const { isOffline } = useUIStore()
  if (!isOffline) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-2xl border border-slate-200/20 bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <WifiOff size={28} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Sin conexión
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Hemos perdido la conexión con el servidor. Tus datos están seguros
          en este equipo. Estamos intentando reconectarte automáticamente.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          <span>Reconectando...</span>
        </div>
      </div>
    </div>
  )
}
