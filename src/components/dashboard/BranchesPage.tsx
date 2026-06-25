import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { supabase } from '@/lib/supabase/client'
import { formatDateShort, getStatusColor, getStatusLabel } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { BranchAccount } from '@/types'
import { AppModal } from '@/components/ui/AppModal'
import {
  Plus,
  Loader2,
  AlertCircle,
  Store,
  Trash2,
  Power,
  PowerOff,
  Mail,
  PenLine,
  Hash,
  MapPin,
  Phone,
  User,
  ChevronLeft,
  CalendarDays,
  Eye,
  EyeOff,
  RefreshCw,
  Key,
} from 'lucide-react'

const step1Schema = z.object({
  nombre_sucursal: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  direccion: z.string().min(2, 'Mínimo 2 caracteres'),
  nit: z.string().optional(),
  telefono: z.string().optional(),
})

const step2Schema = z.object({
  email: z.string().email('Email inválido'),
  admin_nombre: z.string().min(2, 'Mínimo 2 caracteres'),
})

type CreateBranchForm = {
  nombre_sucursal: string
  email: string
  password: string
}

function CreateBranchModal({
  open,
  onClose,
  onCreate,
  loading,
  atLimit,
  maxSucursales,
}: {
  open: boolean
  onClose: () => void
  onCreate: (data: CreateBranchForm) => Promise<void>
  loading: boolean
  atLimit: boolean
  maxSucursales: number
}) {
  const [step, setStep] = useState(1)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPass] = useState(false)

  const genPass = () => setPassword(Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6) + 'A1!')

  useEffect(() => {
    if (open && step === 2 && !password) genPass()
  }, [open, step])

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { nombre_sucursal: '', direccion: '', nit: '', telefono: '' },
  })

  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: { email: '', admin_nombre: '' },
  })

  if (!open) return null

  const handleStep1 = () => {
    step1Form.handleSubmit(() => {
      setStep(2)
    })()
  }

  const handleStep2 = () => {
    step2Form.handleSubmit(() => {
      setStep(3)
    })()
  }

  const handleFinalSubmit = async () => {
    const s1 = step1Form.getValues()
    const s2 = step2Form.getValues()
    await onCreate({
      nombre_sucursal: s1.nombre_sucursal,
      email: s2.email,
      password,
    })
    setStep(1)
    step1Form.reset()
    step2Form.reset()
    setPassword('')
  }

  const handleClose = () => {
    setStep(1)
    step1Form.reset()
    step2Form.reset()
    onClose()
  }

  return (
    <AppModal open={open} onClose={handleClose} title="Nueva sucursal" size="default">
      <div className="px-5 pt-3 pb-4 flex items-center gap-3">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Paso {step}/3</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {atLimit && (
        <div className="mx-5 mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Has alcanzado el límite de {maxSucursales} sucursal{maxSucursales !== 1 ? 'es' : ''} de tu plan. Mejora tu plan para crear más sucursales.
          </p>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); handleStep1() }} className="px-5 pb-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Nombre de la sucursal
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                {...step1Form.register('nombre_sucursal')}
                disabled={atLimit}
                placeholder="Ej: Sucursal Centro"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400"
              />
            </div>
            {step1Form.formState.errors.nombre_sucursal && (
              <p className="text-xs text-red-500 mt-1">{step1Form.formState.errors.nombre_sucursal.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Dirección
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                {...step1Form.register('direccion')}
                disabled={atLimit}
                placeholder="Ej: Calle 123 #45-67"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400"
              />
            </div>
            {step1Form.formState.errors.direccion && (
              <p className="text-xs text-red-500 mt-1">{step1Form.formState.errors.direccion.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              NIT <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                {...step1Form.register('nit')}
                disabled={atLimit}
                placeholder="NIT de la sucursal"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                {...step1Form.register('telefono')}
                disabled={atLimit}
                placeholder="Teléfono de la sucursal"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={atLimit}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              Continuar
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); handleStep2() }} className="px-5 pb-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Email del administrador
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                {...step2Form.register('email')}
                disabled={atLimit}
                placeholder="admin@ejemplo.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400"
              />
            </div>
            {step2Form.formState.errors.email && (
              <p className="text-xs text-red-500 mt-1">{step2Form.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Nombre del administrador
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                {...step2Form.register('admin_nombre')}
                disabled={atLimit}
                placeholder="Ej: Juan Pérez"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400"
              />
            </div>
            {step2Form.formState.errors.admin_nombre && (
              <p className="text-xs text-red-500 mt-1">{step2Form.formState.errors.admin_nombre.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Contrasena para el POS
            </label>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={atLimit}
                  className="w-full pl-9 pr-9 py-2.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:bg-slate-50 placeholder:text-slate-400"
                />
                <button type="button" onClick={() => setShowPass(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button type="button" onClick={genPass} disabled={atLimit} className="px-3 py-2.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
            <button
              type="submit"
              disabled={atLimit}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              Continuar
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="px-5 pb-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Sucursal</h3>
              <div className="space-y-1.5 text-sm">
                <p className="flex items-baseline gap-1.5">
                  <span className="text-slate-500 text-xs w-16 flex-shrink-0">Nombre:</span>
                  <span className="font-medium text-slate-800">{step1Form.getValues('nombre_sucursal')}</span>
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-slate-500 text-xs w-16 flex-shrink-0">Dirección:</span>
                  <span className="font-medium text-slate-800">{step1Form.getValues('direccion')}</span>
                </p>
                {step1Form.getValues('nit') && (
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-slate-500 text-xs w-16 flex-shrink-0">NIT:</span>
                    <span className="font-medium text-slate-800">{step1Form.getValues('nit')}</span>
                  </p>
                )}
                {step1Form.getValues('telefono') && (
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-slate-500 text-xs w-16 flex-shrink-0">Teléfono:</span>
                    <span className="font-medium text-slate-800">{step1Form.getValues('telefono')}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Administrador</h3>
              <div className="space-y-1.5 text-sm">
                <p className="flex items-baseline gap-1.5">
                  <span className="text-slate-500 text-xs w-16 flex-shrink-0">Email:</span>
                  <span className="font-medium text-slate-800">{step2Form.getValues('email')}</span>
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-slate-500 text-xs w-16 flex-shrink-0">Nombre:</span>
                  <span className="font-medium text-slate-800">{step2Form.getValues('admin_nombre')}</span>
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-slate-500 text-xs w-16 flex-shrink-0">Contrasena:</span>
                  <span className="font-mono font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{password}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={atLimit || loading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear sucursal
            </button>
          </div>
        </div>
      )}
    </AppModal>
  )
}

function DeactivateModal({
  open,
  onClose,
  onConfirm,
  loading,
  branchName,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  loading: boolean
  branchName: string
}) {
  return (
    <AppModal open={open} onClose={onClose} title="Desactivar sucursal" size="default">
      <div className="px-5 py-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
          <PowerOff className="w-5 h-5 text-amber-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800 mb-1">{branchName}</p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Al desactivar esta sucursal, sus usuarios no podran acceder al sistema POS ni realizar operaciones hasta que un administrador la reactive.
        </p>
      </div>
      <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2.5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
        <button disabled={loading} onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Desactivando...' : 'Si, desactivar'}
        </button>
      </div>
    </AppModal>
  )
}

function DeleteBranchModal({
  open,
  onClose,
  onConfirm,
  loading,
  branchName,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  loading: boolean
  branchName: string
}) {
  return (
    <AppModal open={open} onClose={onClose} title="Eliminar sucursal" size="default">
      <div className="px-5 py-4">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-3">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800 mb-1">{branchName}</p>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Esta accion eliminara permanentemente la sucursal y todos sus datos asociados. No podra recuperarse.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
          <p className="font-semibold">Se eliminara:</p>
          <ul className="list-disc pl-3 space-y-0.5">
            <li>El acceso al sistema POS para esta sucursal</li>
            <li>Los usuarios administradores asociados</li>
            <li>El historial de ventas de esta sucursal</li>
          </ul>
        </div>
      </div>
      <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2.5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
        <button disabled={loading} onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Eliminando...' : 'Si, eliminar'}
        </button>
      </div>
    </AppModal>
  )
}

function EditBranchModal({
  open,
  onClose,
  onSave,
  loading,
  branch,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: { nombre_sucursal: string; nit: string; direccion: string; telefono: string }) => Promise<void>
  loading: boolean
  branch: BranchAccount & { sucursal_nit?: string; sucursal_direccion?: string; sucursal_telefono?: string } | null
}) {
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!open || !branch) return
    let cancelled = false
    const fetchData = async () => {
      setFetching(true)
      try {
        const { data, error } = await supabase.functions.invoke('update-branch', {
          body: { branchAccountId: branch.id },
        })
        if (!cancelled && !error && data?.data) {
          setNombre(data.data.nombre_sucursal || branch.nombre_sucursal)
          setNit(data.data.nit || '')
          setDireccion(data.data.direccion || '')
          setTelefono(data.data.telefono || '')
        }
      } catch {
        if (!cancelled) setNombre(branch.nombre_sucursal)
      } finally {
        if (!cancelled) setFetching(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [open, branch])

  if (!open) return null

  const canSave = nombre.trim().length >= 2

  return (
    <AppModal open={open} onClose={onClose} title="Editar sucursal" size="default">
      {fetching ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Nombre de la sucursal</label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Sucursal Centro"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">NIT</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={nit}
                onChange={e => setNit(e.target.value)}
                placeholder="NIT de la sucursal"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Dirección</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Dirección de la sucursal"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Teléfono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Teléfono de la sucursal"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSave || loading}
              onClick={() => onSave({ nombre_sucursal: nombre.trim(), nit: nit.trim(), direccion: direccion.trim(), telefono: telefono.trim() })}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar cambios
            </button>
          </div>
        </div>
      )}
    </AppModal>
  )
}

export function BranchesPage() {
  const { tenant, plan } = useAuthStore()
  const { addToast } = useUIStore()
  const [branches, setBranches] = useState<BranchAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [editTarget, setEditTarget] = useState<BranchAccount | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<BranchAccount | null>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BranchAccount | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!tenant) return
    let cancelled = false
    const fetchBranches = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data, error: fetchError } = await supabase
          .from('branch_accounts')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        if (!cancelled) setBranches((data as BranchAccount[]) ?? [])
      } catch {
        if (!cancelled) setError('No se pudieron cargar las sucursales.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchBranches()
    return () => { cancelled = true }
  }, [tenant, refreshKey])

  const activeCount = branches.filter((b) => b.activo).length
  const maxSucursales = plan?.max_sucursales ?? 0
  const atLimit = maxSucursales > 0 && activeCount >= maxSucursales

  const handleCreate = async (form: CreateBranchForm) => {
    if (!tenant || atLimit) return
    try {
      setCreateLoading(true)

      const { data, error: fnError } = await supabase.functions.invoke('create-branch', {
        body: {
          tenantId: tenant.id,
          nombreSucursal: form.nombre_sucursal,
          email: form.email,
          password: form.password,
        },
      })

      if (fnError || data?.error) throw fnError || new Error(data?.error || 'Error desconocido')

      setShowCreate(false)
      addToast('success', 'Sucursal creada exitosamente')
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo crear la sucursal')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEdit = async (form: { nombre_sucursal: string; nit: string; direccion: string; telefono: string }) => {
    if (!editTarget) return
    try {
      setEditLoading(true)
      const { error: fnError } = await supabase.functions.invoke('update-branch', {
        body: {
          branchAccountId: editTarget.id,
          nombre_sucursal: form.nombre_sucursal,
          nit: form.nit,
          direccion: form.direccion,
          telefono: form.telefono,
        },
      })
      if (fnError) throw fnError
      setEditTarget(null)
      addToast('success', `Sucursal "${form.nombre_sucursal}" actualizada`)
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo actualizar la sucursal')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    try {
      setDeactivateLoading(true)
      const { error: updateError } = await supabase
        .from('branch_accounts')
        .update({ activo: false })
        .eq('id', deactivateTarget.id)

      if (updateError) throw updateError

      setDeactivateTarget(null)
      addToast('success', `Sucursal "${deactivateTarget.nombre_sucursal}" desactivada`)
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo desactivar la sucursal')
    } finally {
      setDeactivateLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleteLoading(true)
      const { error } = await supabase
        .from('branch_accounts')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error

      setDeleteTarget(null)
      addToast('success', `Sucursal "${deleteTarget.nombre_sucursal}" eliminada`)
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo eliminar la sucursal')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleActive = async (branch: BranchAccount) => {
    try {
      const newState = !branch.activo
      const { error: updateError } = await supabase
        .from('branch_accounts')
        .update({ activo: newState })
        .eq('id', branch.id)

      if (updateError) throw updateError

      addToast('success', newState ? `Sucursal "${branch.nombre_sucursal}" activada` : `Sucursal "${branch.nombre_sucursal}" desactivada`)
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo cambiar el estado de la sucursal')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sucursales</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} de {maxSucursales > 0 ? maxSucursales : '∞'} sucursales activas
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={atLimit}
          title={atLimit ? `Límite de ${maxSucursales} sucursales alcanzado` : 'Nueva sucursal'}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva sucursal
        </button>
      </div>

      {/* Empty state */}
      {branches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Store className="w-7 h-7 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">No hay sucursales</p>
            <p className="text-xs text-slate-500 mt-1">
              Crea tu primera sucursal para empezar a usar VenxPOS
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={atLimit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear sucursal
          </button>
        </div>
      ) : (
        /* Branches card grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Store className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{branch.nombre_sucursal}</h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{branch.email}</p>
                  </div>
                </div>
                <span
                  className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${getStatusColor(branch.activo ? 'active' : 'cancelled')}`}
                >
                  {getStatusLabel(branch.activo ? 'active' : 'cancelled')}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-500 mb-4">
                <div className="flex items-center gap-1.5">
                  <Mail size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">{branch.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={12} className="text-slate-400 shrink-0" />
                  <span className="font-mono text-[10px]">{branch.sucursal_id || 'Sin asignar'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={12} className="text-slate-400 shrink-0" />
                  <span>{formatDateShort(branch.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setEditTarget(branch)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Editar"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleToggleActive(branch)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  title={branch.activo ? 'Desactivar' : 'Activar'}
                >
                  {branch.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => setDeleteTarget(branch)}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateBranchModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        loading={createLoading}
        atLimit={atLimit}
        maxSucursales={maxSucursales}
      />

      <EditBranchModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEdit}
        loading={editLoading}
        branch={editTarget}
      />

      <DeactivateModal
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        loading={deactivateLoading}
        branchName={deactivateTarget?.nombre_sucursal ?? ''}
      />

      <DeleteBranchModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        branchName={deleteTarget?.nombre_sucursal ?? ''}
      />
    </div>
  )
}
