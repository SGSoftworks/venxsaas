import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { Loader2 } from 'lucide-react'
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

export function GerenteGuard({ children }: { children: ReactNode }) {
  const { session, isSuperadmin, loading, initialized } = useAuthStore()

  if (!initialized || loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!isSuperadmin) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
