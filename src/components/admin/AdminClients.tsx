import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatDateShort, getStatusColor as _gsc, getStatusLabel, classNames, isSubscriptionPastDue } from '@/lib/utils'
import { useUIStore } from '@/store/useUIStore'
import type { Tenant, Plan, Subscription, Payment, BranchAccount } from '@/types'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  Building2,
  Calendar,
  Mail,
  Phone,
  Hash,
  CreditCard,
  KeyRound,
  PenLine,
  Store,
  Activity,
  Plus,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { AppModal } from '@/components/ui/AppModal'
import { zIndex } from '@/lib/zIndex'

type ClientRow = Tenant & { plan_nombre?: string; branch_count?: number; branch_max?: number }

interface ClientDetail {
  tenant: Tenant
  plan: Plan | null
  subscription: Subscription | null
  payments: Payment[]
  branches: BranchAccount[]
}

const PAGE_SIZE = 15

function statusBadgeColor(estado: string): string {
  const map: Record<string, string> = {
    active: 'bg-success-100 text-success-600 border-success-200',
    pending_payment: 'bg-warning-100 text-warning-600 border-warning-200',
    pending: 'bg-warning-100 text-warning-600 border-warning-200',
    suspended: 'bg-danger-100 text-danger-500 border-danger-200',
    cancelled: 'bg-danger-100 text-danger-500 border-danger-200',
    past_due: 'bg-danger-100 text-danger-500 border-danger-200',
    expired: 'bg-slate-100 text-slate-500 border-slate-200',
    approved: 'bg-success-100 text-success-600 border-success-200',
    declined: 'bg-danger-100 text-danger-500 border-danger-200',
    pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  }
  return map[estado] || 'bg-slate-100 text-slate-600 border-slate-200'
}

type TabKey = 'general' | 'sucursales' | 'pagos' | 'facturas' | 'actividad'

export function AdminClients() {
  const { addToast } = useUIStore()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [detailOpen, setDetailOpen] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [resetPwdTarget, setResetPwdTarget] = useState<{ userId: string; label: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [pwdSubmitting, setPwdSubmitting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editBranchTarget, setEditBranchTarget] = useState<{ branch: BranchAccount; sucursalId: string | null } | null>(null)
  const [editBranchForm, setEditBranchForm] = useState({ nombre_sucursal: '', nit: '', direccion: '', telefono: '' })
  const [editBranchLoading, setEditBranchLoading] = useState(false)
  const [editBranchFetching, setEditBranchFetching] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [createClientPlans, setCreateClientPlans] = useState<Plan[]>([])
  const [createForm, setCreateForm] = useState({ nombreNegocio: '', nit: '', email: '', telefono: '', planId: '', fechaInicio: new Date().toISOString().split('T')[0] })
  const [invoiceForm, setInvoiceForm] = useState({ metodo: '', factura: '', monto: '', motivo: 'recurring' })
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchClients = async () => {
      setLoading(true)
      setError(null)
      try {
        const from = page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        let query = supabase
          .from('tenants')
          .select('*, plans!left(nombre, max_sucursales)', { count: 'exact' })
          .order('created_at', { ascending: false })

        if (search) query = query.or(`nombre_negocio.ilike.%${search}%,email_propietario.ilike.%${search}%,nit.ilike.%${search}%,client_id.ilike.%${search}%`)
        if (statusFilter !== 'all') query = query.eq('estado', statusFilter)

        const { data, count, error: qError } = await query.range(from, to)

        if (qError) throw qError

        if (cancelled || !data || data.length === 0) {
          if (!cancelled) { setClients([]); setTotal(count ?? 0) }
          return
        }

        const branchCounts = await supabase
          .from('branch_accounts')
          .select('tenant_id')
          .in('tenant_id', (data || []).map((d: Record<string, unknown>) => d.id as string))

        if (cancelled) return

        const countMap = new Map<string, number>()
        ;(branchCounts.data || []).forEach((bc: Record<string, unknown>) => {
          const tid = bc.tenant_id as string
          countMap.set(tid, (countMap.get(tid) || 0) + 1)
        })

          const rows = (data || []).map((d: Record<string, unknown>) => {
          const planData = d.plans as { nombre: string; max_sucursales: number } | null
          return {
            id: d.id as string,
            client_id: d.client_id as string | null,
            nombre_negocio: d.nombre_negocio as string,
            nit: d.nit as string,
            email_propietario: d.email_propietario as string,
            telefono: d.telefono as string,
            estado: d.estado as Tenant['estado'],
            auth_user_id: d.auth_user_id as string | null,
            plan_id: d.plan_id as string | null,
            created_at: d.created_at as string,
            updated_at: d.updated_at as string,
            temp_password: d.temp_password as string | null,
            plan_nombre: planData?.nombre,
            branch_max: planData?.max_sucursales,
            branch_count: countMap.get(d.id as string) || 0,
          } as ClientRow
        })

        setClients(rows)
        setTotal(count ?? 0)
      } catch {
        if (!cancelled) setError('Error al cargar clientes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchClients()
    return () => { cancelled = true }
  }, [search, statusFilter, page, refreshKey])

  useEffect(() => {
    if (detailOpen) setActiveTab('general')
  }, [detailOpen])

  const openDetail = async (client: Tenant) => {
    setDetailLoading(true)
    try {
      const [
        { data: plan },
        { data: subscription },
        { data: payments },
        { data: branches },
      ] = await Promise.all([
        client.plan_id ? supabase.from('plans').select('*').eq('id', client.plan_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('subscriptions').select('*').eq('tenant_id', client.id).maybeSingle(),
        supabase.from('payments').select('*').eq('tenant_id', client.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('branch_accounts').select('*').eq('tenant_id', client.id).order('created_at', { ascending: false }).limit(50),
      ])
      const precioDefault = (plan as Plan | null)?.precio_mensual
      setDetailOpen({
        tenant: client,
        plan: plan as Plan | null,
        subscription: subscription as Subscription | null,
        payments: (payments || []) as Payment[],
        branches: (branches || []) as BranchAccount[],
      })
      setInvoiceForm({ metodo: '', factura: '', monto: precioDefault ? String(precioDefault) : '', motivo: 'recurring' })
    } catch {
      addToast('error', 'Error al cargar detalle')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleGenerateInvoice = async () => {
    if (!detailOpen || !invoiceForm.monto) return
    setInvoiceLoading(true)
    try {
      const amount = Number(invoiceForm.monto)
      const { data: payment, error: payErr } = await supabase
        .from('payments')
        .insert({
          tenant_id: detailOpen.tenant.id,
          amount,
          currency: 'COP',
          status: 'approved',
          payment_method_type: invoiceForm.metodo || 'MANUAL',
          tipo: invoiceForm.motivo,
        })
        .select('id')
        .single()

      if (payErr) throw payErr

      if (!payment) throw new Error('No se pudo crear el pago')

      const { data: invoiceId, error: invErr } = await supabase
        .rpc('generar_factura_desde_pago', { p_payment_id: payment.id })
      if (invErr) throw invErr

      if (invoiceForm.motivo === 'recurring') {
        const { error: subErr } = await supabase
          .from('subscriptions')
          .update({
            fecha_renovacion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            proximo_cobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            estado: 'active',
          })
          .eq('tenant_id', detailOpen.tenant.id)
        if (subErr) throw subErr
      }


      if (invoiceId) {
        try {
          const pdfRes = await supabase.functions.invoke('generate-pdf', { body: { invoiceId } })
          if (pdfRes.error) throw new Error(pdfRes.error.message || 'Error al generar PDF')
        } catch (pdfErr) {
          addToast('warning', `Factura creada pero no se pudo generar el PDF: ${pdfErr instanceof Error ? pdfErr.message : 'Error desconocido'}`)
        }
      }

      addToast('success', `Factura generada exitosamente`)
      const precioDefault = detailOpen.plan?.precio_mensual
      setInvoiceForm({ metodo: '', factura: '', monto: precioDefault ? String(precioDefault) : '', motivo: 'recurring' })
      openDetail(detailOpen.tenant)
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Error al generar factura')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPwdTarget || !newPassword.trim()) return
    setPwdSubmitting(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: resetPwdTarget.userId, newPassword: newPassword.trim() },
      })
      if (fnError || data?.error) throw fnError || new Error(data?.error)
      addToast('success', `Contrasena actualizada para ${resetPwdTarget.label}`)
      setResetPwdTarget(null)
      setNewPassword('')
    } catch {
      addToast('error', 'Error al restablecer la contraseña')
    } finally {
      setPwdSubmitting(false)
    }
  }

  const handleEditBranch = async () => {
    if (!editBranchTarget) return
    try {
      setEditBranchLoading(true)
      const { error: fnError } = await supabase.functions.invoke('update-branch', {
        body: {
          branchAccountId: editBranchTarget.branch.id,
          nombre_sucursal: editBranchForm.nombre_sucursal,
          nit: editBranchForm.nit,
          direccion: editBranchForm.direccion,
          telefono: editBranchForm.telefono,
        },
      })
      if (fnError) throw fnError
      setEditBranchTarget(null)
      addToast('success', `Sucursal "${editBranchForm.nombre_sucursal}" actualizada`)
      if (detailOpen) openDetail(detailOpen.tenant)
    } catch {
      addToast('error', 'No se pudo actualizar la sucursal')
    } finally {
      setEditBranchLoading(false)
    }
  }

  const openEditBranch = async (branch: BranchAccount) => {
    setEditBranchTarget({ branch, sucursalId: branch.sucursal_id })
    setEditBranchFetching(true)
    setEditBranchForm({ nombre_sucursal: branch.nombre_sucursal, nit: '', direccion: '', telefono: '' })
    try {
      if (branch.sucursal_id) {
        const { data, error } = await supabase.functions.invoke('update-branch', {
          body: { branchAccountId: branch.id },
        })
        if (!error && data?.data) {
          setEditBranchForm({
            nombre_sucursal: data.data.nombre_sucursal || branch.nombre_sucursal,
            nit: data.data.nit || '',
            direccion: data.data.direccion || '',
            telefono: data.data.telefono || '',
          })
        }
      }
    } catch {
      // keep defaults
    } finally {
      setEditBranchFetching(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Clientes</h1>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-400">{total} registros</span>
          <button
            onClick={async () => {
              const { data: plans } = await supabase.from('plans').select('*').eq('activo', true).order('precio_mensual', { ascending: true })
              setCreateClientPlans((plans || []) as Plan[])
              setCreateForm({ nombreNegocio: '', nit: '', email: '', telefono: '', planId: '', fechaInicio: new Date().toISOString().split('T')[0] })
              setCreateClientOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear cliente
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, NIT, ID o correo..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-md text-[13px] placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
          className="px-3 py-2 border border-slate-200 rounded-md text-[13px] text-slate-700 bg-white focus:outline-none focus:border-brand-400"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="suspended">Suspendidos</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>

      {error ? (
        <div className="flex flex-col items-center py-12 gap-4">
          <p className="text-sm text-slate-500">{error}</p>
          <button onClick={() => setRefreshKey(k => k + 1)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : (
        <>
          {loading && clients.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse-soft">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : clients.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={search || statusFilter !== 'all' ? 'Sin resultados' : 'No hay clientes'}
              description={search || statusFilter !== 'all' ? 'No se encontraron clientes con los filtros actuales' : 'Aún no hay clientes registrados en el sistema'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openDetail(c)}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-brand-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.nombre_negocio}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{c.nit}</p>
                        {c.client_id && <p className="text-[10px] text-slate-400 font-mono truncate">ID: {c.client_id}</p>}
                      </div>
                    </div>
                    <span className={classNames('shrink-0 inline-flex px-2 py-0.5 rounded text-[11px] font-medium border', statusBadgeColor(c.estado))}>
                      {getStatusLabel(c.estado)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{c.plan_nombre || '\u2014'}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateShort(c.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openDetail(c)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 group-hover:text-slate-600 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-white rounded-lg">
              <span className="text-[12px] text-slate-400">
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <AppModal
        open={!!detailOpen}
        onClose={() => setDetailOpen(null)}
        title={detailOpen?.tenant.nombre_negocio}
        size="xl"
        ariaLabel="Detalle del cliente"
      >
        {detailOpen && (
          <>
            <div className="flex border-b border-slate-100 px-5 gap-0.5 bg-slate-50/50 shrink-0">
              {([
                { key: 'general' as TabKey, label: 'General', icon: Building2 },
                { key: 'sucursales' as TabKey, label: 'Sucursales', icon: Store },
                { key: 'pagos' as TabKey, label: 'Pagos', icon: CreditCard },
                { key: 'actividad' as TabKey, label: 'Actividad', icon: Activity },
              ]).map(({ key, label, icon: TabIcon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={classNames(
                    'flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors',
                    activeTab === key
                      ? 'text-brand-700 border-brand-600 bg-white rounded-t-lg'
                      : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/60 rounded-t-lg'
                  )}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {label}
                  {key === 'sucursales' && detailOpen.branches.length > 0 && (
                    <span className="ml-0.5 text-[10px] text-slate-400 font-normal">({detailOpen.branches.length})</span>
                  )}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="p-5">
                {activeTab === 'general' && (
                  <div className="space-y-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                      <InfoRow icon={Mail} label="Email" value={detailOpen.tenant.email_propietario} />
                      <InfoRow icon={Phone} label="Teléfono" value={detailOpen.tenant.telefono} />
                      <InfoRow icon={Hash} label="NIT" value={detailOpen.tenant.nit} />
                      <InfoRow icon={Hash} label="ID Cliente" value={detailOpen.tenant.client_id || '—'} />
                      <InfoRow icon={Calendar} label="Registro" value={formatDate(detailOpen.tenant.created_at)} />
                      <InfoRow icon={Building2} label="Plan" value={detailOpen.plan?.nombre || 'Sin plan'} />
                      <InfoRow icon={CreditCard} label="Estado" value={getStatusLabel(detailOpen.tenant.estado)} />
                    </div>

                    {detailOpen.tenant.temp_password && (
                      <div className="mt-5 pt-5 border-t border-slate-100">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Acceso inicial</h3>
                        <div className="flex items-center justify-between bg-brand-50 rounded-lg p-3">
                          <div>
                            <p className="text-xs text-slate-400">Contrasena temporal</p>
                            <p className="text-sm font-mono font-semibold text-slate-800">{detailOpen.tenant.temp_password}</p>
                          </div>
                          <button
                            onClick={() => { navigator.clipboard.writeText(detailOpen.tenant.temp_password!); addToast('success', 'Contrasena copiada') }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors"
                          >
                            Copiar
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">El cliente debera cambiar esta contrasena en su primer inicio de sesion.</p>
                      </div>
                    )}

                    {detailOpen.subscription && (
                      <div className="mt-5 pt-5 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Suscripción</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Estado</span>
                              <span className={classNames('inline-block px-1.5 py-0.5 rounded text-[11px] font-medium border', statusBadgeColor(detailOpen.subscription.estado))}>
                                {getStatusLabel(detailOpen.subscription.estado)}
                              </span>
                              {isSubscriptionPastDue(detailOpen.subscription) && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium border border-danger-200 text-danger-500 bg-danger-100">
                                  Vencida
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wide mr-1">Inicio:</span>
                              {formatDateShort(detailOpen.subscription.fecha_inicio)}
                            </div>
                            <div className="text-xs text-slate-500">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wide mr-1">Próximo cobro:</span>
                              {formatDateShort(detailOpen.subscription.proximo_cobro)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailOpen.tenant.auth_user_id && (
                      <div className={`${detailOpen.subscription ? 'pt-5' : 'mt-5 pt-5'} border-t border-slate-100`}>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Acceso al panel</h3>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-700">{detailOpen.tenant.email_propietario}</p>
                            <p className="text-xs text-slate-400">Usuario del panel administrativo</p>
                          </div>
                          <button
                            onClick={() => setResetPwdTarget({ userId: detailOpen.tenant.auth_user_id!, label: detailOpen.tenant.email_propietario })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors shrink-0"
                          >
                            <KeyRound className="w-3 h-3" />
                            Restablecer contraseña
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'sucursales' && (
                  <div className="space-y-0">
                    {detailOpen.branches.length === 0 ? (
                      <EmptyState icon={Store} title="Sin sucursales" description="Este cliente no tiene sucursales registradas" />
                    ) : (
                      detailOpen.branches.map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-4 py-3 border-t border-slate-100 first:border-t-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                              <Store className="w-3.5 h-3.5 text-brand-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-800">{b.nombre_sucursal}</p>
                                <span className={classNames('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border', b.activo ? 'bg-success-100 text-success-600 border-success-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                                  {b.activo ? 'Activa' : 'Inactiva'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{b.sucursal_id || '\u2014'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditBranch(b)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                            >
                              <PenLine className="w-3 h-3" />
                              Editar
                            </button>
                            {b.user_id && (
                              <button
                                onClick={() => setResetPwdTarget({ userId: b.user_id!, label: b.email })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                              >
                                <KeyRound className="w-3 h-3" />
                                Restablecer
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'pagos' && (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase tracking-wider">Metodo</label>
                          <select value={invoiceForm.metodo} onChange={e => setInvoiceForm({ ...invoiceForm, metodo: e.target.value })}
                            className="w-full mt-0.5 px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 bg-white">
                            <option value="">Seleccionar</option>

                            <option value="Nequi">Nequi</option>
                            <option value="Daviplata">Daviplata</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Efectivo">Efectivo</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase tracking-wider">Factura</label>
                          <input value={invoiceForm.factura} onChange={e => setInvoiceForm({ ...invoiceForm, factura: e.target.value })}
                            className="w-full mt-0.5 px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 font-mono"
                            placeholder="VENX-000001" />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase tracking-wider">Monto (COP)</label>
                          <input type="number" value={invoiceForm.monto} onChange={e => setInvoiceForm({ ...invoiceForm, monto: e.target.value })}
                            className="w-full mt-0.5 px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 font-mono"
                            placeholder={detailOpen.plan?.precio_mensual?.toString() || '0'} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase tracking-wider">Motivo</label>
                          <select value={invoiceForm.motivo} onChange={e => {
                            const motivo = e.target.value
                            const precio = motivo === 'initial'
                              ? detailOpen.plan?.precio_inicial
                              : detailOpen.plan?.precio_mensual
                            setInvoiceForm({ ...invoiceForm, motivo, monto: precio ? String(precio) : '' })
                          }}
                            className="w-full mt-0.5 px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 bg-white">
                            <option value="initial">Activacion</option>
                            <option value="recurring">Renovacion</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleGenerateInvoice}
                          disabled={invoiceLoading || !invoiceForm.monto}
                          className="w-full py-1.5 rounded-md text-[11px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                          {invoiceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          Generar factura
                        </button>
                      </div>
                    </div>

                    {detailOpen.payments.length === 0 ? (
                      <EmptyState icon={CreditCard} title="Sin pagos" description="No hay pagos registrados" />
                    ) : (
                      <div className="max-h-48 overflow-y-auto -mx-1 px-1">
                        {detailOpen.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-t border-slate-100 first:border-t-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                <CreditCard className="w-3 h-3 text-slate-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[12px] font-semibold text-slate-800 font-mono">{formatCurrency(p.amount)}</p>
                                  <span className={classNames('inline-block px-1 py-0.5 rounded text-[9px] font-medium border', statusBadgeColor(p.status))}>
                                    {getStatusLabel(p.status)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 capitalize">{p.tipo.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">{formatDateShort(p.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'actividad' && (
                  <EmptyState
                    icon={Activity}
                    title="Sin actividad"
                    description="No hay registros de actividad para este cliente"
                  />
                )}
              </div>
            )}
          </>
        )}
      </AppModal>

      {/* Password Reset Modal */}
      <AppModal
        open={!!resetPwdTarget}
        onClose={() => { setResetPwdTarget(null); setNewPassword('') }}
        title="Restablecer contraseña"
        z={zIndex.MODAL_NESTED}
      >
        <div className="p-5">
          <p className="text-[13px] text-slate-500">Nueva contraseña para <span className="font-medium text-slate-700">{resetPwdTarget?.label}</span></p>
          <input
            type="text"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña"
            className="mt-4 w-full px-3 py-2 border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 bg-white"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setResetPwdTarget(null); setNewPassword('') }}
              className="px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetPassword}
              disabled={!newPassword.trim() || pwdSubmitting}
              className="px-3 py-1.5 text-[13px] font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md disabled:opacity-50 transition-colors"
            >
              {pwdSubmitting ? 'Guardando...' : 'Restablecer'}
            </button>
          </div>
        </div>
      </AppModal>

      {/* Edit Branch Modal */}
      <AppModal
        open={!!editBranchTarget}
        onClose={() => setEditBranchTarget(null)}
        title="Editar sucursal"
        z={zIndex.MODAL_NESTED}
      >
        {editBranchFetching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Nombre</label>
              <input
                type="text"
                value={editBranchForm.nombre_sucursal}
                onChange={e => setEditBranchForm({ ...editBranchForm, nombre_sucursal: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">NIT</label>
              <input
                type="text"
                value={editBranchForm.nit}
                onChange={e => setEditBranchForm({ ...editBranchForm, nit: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Dirección</label>
              <input
                type="text"
                value={editBranchForm.direccion}
                onChange={e => setEditBranchForm({ ...editBranchForm, direccion: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Teléfono</label>
              <input
                type="text"
                value={editBranchForm.telefono}
                onChange={e => setEditBranchForm({ ...editBranchForm, telefono: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                onClick={() => setEditBranchTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!editBranchForm.nombre_sucursal.trim() || editBranchLoading}
                onClick={handleEditBranch}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {editBranchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </AppModal>

      {/* Create Client Modal */}
      <AppModal
        open={createClientOpen}
        onClose={() => setCreateClientOpen(false)}
        title="Crear cliente"
        ariaLabel="Crear cliente"
      >
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Nombre del negocio</label>
            <input
              type="text"
              value={createForm.nombreNegocio}
              onChange={e => setCreateForm({ ...createForm, nombreNegocio: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              placeholder="Nombre del negocio"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">NIT</label>
            <input
              type="text"
              value={createForm.nit}
              onChange={e => setCreateForm({ ...createForm, nit: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={createForm.email}
              onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Teléfono</label>
            <input
              type="text"
              value={createForm.telefono}
              onChange={e => setCreateForm({ ...createForm, telefono: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              placeholder="+57 300 000 0000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Plan</label>
            <select
              value={createForm.planId}
              onChange={e => setCreateForm({ ...createForm, planId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
            >
              <option value="">Seleccionar plan</option>
              {createClientPlans.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} — {formatCurrency(p.precio_mensual)}/mes</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Fecha de inicio</label>
            <input
              type="date"
              value={createForm.fechaInicio}
              onChange={e => setCreateForm({ ...createForm, fechaInicio: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <button
              onClick={() => setCreateClientOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={!createForm.nombreNegocio.trim() || !createForm.email.trim() || !createForm.telefono.trim() || !createForm.planId || createLoading}
              onClick={async () => {
                setCreateLoading(true)
                try {
                  const { data, error } = await supabase.functions.invoke('create-client', {
                    body: {
                      nombreNegocio: createForm.nombreNegocio.trim(),
                      nit: createForm.nit.trim() || undefined,
                      email: createForm.email.trim(),
                      telefono: createForm.telefono.trim(),
                      planId: createForm.planId,
                      fechaInicio: createForm.fechaInicio,
                    },
                  })
                  if (error) throw error
                  addToast('success', `Cliente creado. CLIENTE_ID: ${data?.clientId || '—'}. Contrasena temporal: ${data?.tempPassword || '—'}`)
                  setCreateClientOpen(false)
                  setRefreshKey(k => k + 1)
                } catch (e) {
                  addToast('error', e instanceof Error ? e.message : 'Error al crear cliente')
                } finally {
                  setCreateLoading(false)
                }
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear cliente
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-brand-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-900 font-medium mt-0.5 break-all">{value || '\u2014'}</p>
      </div>
    </div>
  )
}

function InfoItemMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-[12px] text-slate-700">{value || '\u2014'}</p>
    </div>
  )
}
