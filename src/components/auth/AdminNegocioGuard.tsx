import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Loader2, ShieldAlert } from 'lucide-react'

export function AdminNegocioGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.rpc('es_admin_negocio').then(({ data, error }) => {
      if (error || !data) {
        navigate('/dashboard', { replace: true })
        return
      }
      setIsAdmin(true)
      setChecking(false)
    })
  }, [navigate])

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="w-12 h-12 text-slate-300" />
        <p className="text-sm text-slate-500">No tienes permisos para acceder a esta seccion</p>
      </div>
    )
  }

  return <>{children}</>
}
