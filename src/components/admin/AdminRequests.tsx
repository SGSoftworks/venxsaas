import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort, classNames } from '@/lib/utils'
import { useUIStore } from '@/store/useUIStore'
import { AppModal } from '@/components/ui/AppModal'
import {
  Search,
  Check,
  X,
  Loader2,
  RefreshCw,
  Clock,
  Store,
} from 'lucide-react'

type FilterKey = 'pendientes' | 'aprobados' | 'todos'

type RowSource = 'pending_approval' | 'approved_today'

interface ApprovalRow {
  id: string
  tenantId: string
  clientId: string | null
  cliente: string
  email: string
  planNombre: string
  planPrecioInicial: number
  reference: string
  valor: number
  fechaSolicitud: string
  estado: string
  proofId: string | null
  source: RowSource
  tipo: string
}

interface AprobarForm {
  row: ApprovalRow
  transactionId: string
  amount: number
}

const TIPO_LABEL: Record<string, string> = {
  pending_approval: 'Activación',
  approved_today: 'Aprobado',
}

const TIPO_BADGE: Record<string, string> = {
  pending_approval: 'bg-sky-100 text-sky-700 border-sky-200',
  approved_today: 'bg-green-100 text-green-700 border-green-200',
}

export function AdminRequests() {
  const { addToast } = useUIStore()
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterKey, setFilterKey] = useState<FilterKey>('pendientes')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [aprobarForm, setAprobarForm] = useState<AprobarForm | null>(null)
  const [aprobarSubmitting, setAprobarSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows: ApprovalRow[] = []

      const showActivacionesPendientes = filterKey === 'pendientes' || filterKey === 'todos'
      const showActivacionesAprobadas = filterKey === 'aprobados' || filterKey === 'todos'

      if (showActivacionesPendientes) {
        const { data: pendingData, error: pendingErr } = await supabase
          .from('tenants')
          .select('*')
          .eq('estado', 'pending_approval')
          .order('created_at', { ascending: false })

        if (pendingErr) throw pendingErr

        if (pendingData && pendingData.length > 0) {
          const pendingTenantIds = pendingData.map((t: Record<string, unknown>) => t.id as string)
          const pendingPlanIds = [...new Set(pendingData.map((t: Record<string, unknown>) => t.plan_id as string | null).filter(Boolean))]

          const [{ data: plansData }, { data: proofsData }] = await Promise.all([
            pendingPlanIds.length > 0
              ? supabase.from('plans').select('*').in('id', pendingPlanIds as string[])
              : Promise.resolve({ data: [] }),
            supabase.from('payment_proofs').select('*').in('tenant_id', pendingTenantIds).order('created_at', { ascending: false }),
          ])

          const plansMap = new Map((plansData || []).map((p: Record<string, unknown>) => [p.id, p]))
          const proofsMap = new Map<string, Record<string, unknown>>()
          ;(proofsData || []).forEach((p: Record<string, unknown>) => {
            const tid = p.tenant_id as string
            if (!proofsMap.has(tid)) proofsMap.set(tid, p as Record<string, unknown>)
          })

          for (const t of pendingData as Record<string, unknown>[]) {
            const plan = t.plan_id ? plansMap.get(t.plan_id as string) : null
            const proof = proofsMap.get(t.id as string)
            rows.push({
              id: `pending-${t.id}`,
              tenantId: t.id as string,
              clientId: (t.client_id as string) || null,
              cliente: t.nombre_negocio as string,
              email: t.email_propietario as string,
              planNombre: (plan as Record<string, unknown> | null)?.nombre as string || '\u2014',
              planPrecioInicial: ((plan as Record<string, unknown> | null)?.precio_inicial as number) || 0,
              reference: (proof?.reference as string) || '\u2014',
              valor: (proof?.amount as number) || 0,
              fechaSolicitud: t.created_at as string,
              estado: 'pending_approval',
              proofId: (proof?.id as string) || null,
              source: 'pending_approval' as const,
              tipo: 'Activación',
            })
          }
        }
      }

      if (showActivacionesAprobadas) {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { data: approvedProofsData, error: approvedErr } = await supabase
          .from('payment_proofs')
          .select('*')
          .eq('status', 'approved')
          .gte('reviewed_at', todayStart.toISOString())
          .order('reviewed_at', { ascending: false })

        if (approvedErr) throw approvedErr

        if (approvedProofsData && approvedProofsData.length > 0) {
          const approvedTenantIds = [...new Set((approvedProofsData as Record<string, unknown>[]).map(p => p.tenant_id as string))]
          const { data: approvedTenantsData } = await supabase
            .from('tenants')
            .select('*')
            .in('id', approvedTenantIds as string[])

          const approvedPlanIds = [...new Set((approvedTenantsData || []).map((t: Record<string, unknown>) => t.plan_id as string | null).filter(Boolean))]
          const { data: approvedPlansData } = approvedPlanIds.length > 0
            ? await supabase.from('plans').select('*').in('id', approvedPlanIds as string[])
            : { data: [] }

          const tenantsMap = new Map((approvedTenantsData || []).map((t: Record<string, unknown>) => [t.id, t]))
          const appPlansMap = new Map((approvedPlansData || []).map((p: Record<string, unknown>) => [p.id, p]))

          for (const p of approvedProofsData as Record<string, unknown>[]) {
            const tenant = tenantsMap.get(p.tenant_id as string)
            const plan = tenant?.plan_id ? appPlansMap.get(tenant.plan_id as string) : null
            rows.push({
              id: `approved-${p.id}`,
              tenantId: p.tenant_id as string,
              clientId: (tenant?.client_id as string) || null,
              cliente: (tenant?.nombre_negocio as string) || '\u2014',
              email: (tenant?.email_propietario as string) || '\u2014',
              planNombre: (plan as Record<string, unknown> | null)?.nombre as string || '\u2014',
              planPrecioInicial: ((plan as Record<string, unknown> | null)?.precio_inicial as number) || 0,
              reference: (p.reference as string) || '\u2014',
              valor: (p.amount as number) || 0,
              fechaSolicitud: (p.reviewed_at as string) || (p.created_at as string),
              estado: 'approved',
              proofId: p.id as string,
              source: 'approved_today' as const,
              tipo: 'Aprobado',
            })
          }
        }
      }

      setRows(rows)
    } catch {
      setError('Error al cargar solicitudes')
    } finally {
      setLoading(false)
    }
  }, [filterKey])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const handleAprobar = async () => {
    if (!aprobarForm) return
    setAprobarSubmitting(true)
    try {
      const row = aprobarForm.row

      if (row.source === 'pending_approval') {
        const { error: fnError } = await supabase.functions.invoke('approve-tenant', {
          body: { tenantId: row.tenantId, paymentProofId: row.proofId, transactionId: aprobarForm.transactionId },
        })
        if (fnError) throw fnError
      }

      addToast('success', `"${aprobarForm.row.cliente}" aprobado`)
      setAprobarForm(null)
      setRefreshKey(k => k + 1)
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Error al aprobar')
    } finally {
      setAprobarSubmitting(false)
    }
  }

  const handleRechazar = async (row: ApprovalRow) => {
    setActionLoading(prev => ({ ...prev, [row.id]: true }))
    try {
      if (row.source === 'pending_approval') {
        const { error: upError } = await supabase
          .from('tenants')
          .update({ estado: 'cancelled' })
          .eq('id', row.tenantId)
        if (upError) throw upError

        if (row.proofId) {
          await supabase
            .from('payment_proofs')
            .update({ status: 'rejected' })
            .eq('id', row.proofId)
        }
      }

      addToast('success', `"${row.cliente}" rechazado`)
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'Error al rechazar')
    } finally {
      setActionLoading(prev => ({ ...prev, [row.id]: false }))
    }
  }

  const openAprobarForm = (row: ApprovalRow) => {
    setAprobarForm({
      row,
      transactionId: row.reference !== '\u2014' ? row.reference : '',
      amount: row.valor || row.planPrecioInicial,
    })
  }

  const filtered = rows.filter(r => {
    if (search && !r.cliente.toLowerCase().includes(search.toLowerCase()) && !r.email.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    return true
  })

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'aprobados', label: 'Aprobados' },
    { key: 'todos', label: 'Todos' },
  ]

  return (
    <div className="p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Solicitudes</h1>
        <span className="text-[12px] text-slate-400">{rows.length} registros</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 overflow-x-auto">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterKey(tab.key)}
              className={classNames(
                'px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap',
                filterKey === tab.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-md text-[13px] placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 bg-white"
          />
        </div>

        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="p-2 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={classNames('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center py-12 gap-4">
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                    Cliente
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                    Tipo
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Plan
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                    Valor
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                    Fecha
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                    Estado
                  </th>
                  <th className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-10">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && rows.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3.5" colSpan={9}>
                        <div className="h-4 bg-slate-100 rounded-full animate-pulse-soft w-full max-w-lg" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="w-8 h-8 text-slate-200" />
                        <p className="text-[13px] text-slate-400 font-medium">
                          {search
                            ? 'No se encontraron solicitudes con los filtros actuales'
                            : 'No hay solicitudes pendientes'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const isLoading = actionLoading[row.id]
                    const isPending = row.estado === 'pending_approval' || row.estado === 'pendiente'
                    const isApproved = row.estado === 'approved' || row.estado === 'aprobada'
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                              <Store className="w-3.5 h-3.5 text-brand-600" />
                            </div>
                            <div>
                              <span className="text-[13px] font-semibold text-slate-800">{row.cliente}</span>
                              {row.clientId && <p className="text-[10px] text-slate-400 font-mono">ID: {row.clientId}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className="text-[12px] text-slate-500">{row.email}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={classNames(
                            'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border',
                            TIPO_BADGE[row.source] || TIPO_BADGE[row.tipo] || 'bg-slate-100 text-slate-600 border-slate-200',
                          )}>
                            {TIPO_LABEL[row.source] || row.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <span className="text-[12px] text-slate-600">{row.planNombre}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[12px] font-semibold text-slate-800 tabular-nums">
                            {row.valor > 0 ? formatCurrency(row.valor) : '\u2014'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          <span className="text-[12px] text-slate-500">{formatDateShort(row.fechaSolicitud)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={classNames(
                            'inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border',
                            isPending ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            isApproved ? 'bg-green-100 text-green-800 border-green-200' :
                            'bg-red-100 text-red-800 border-red-200'
                          )}>
                            {isPending ? 'Pendiente' : isApproved ? 'Aprobada' : 'Rechazada'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-0.5">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => openAprobarForm(row)}
                                  disabled={isLoading}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50"
                                  title="Aprobar"
                                >
                                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Aprobar
                                </button>
                                <button
                                  onClick={() => handleRechazar(row)}
                                  disabled={isLoading}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                                  title="Rechazar"
                                >
                                  <X className="w-3 h-3" />
                                  Rechazar
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400">Procesado</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AppModal
        open={!!aprobarForm}
        onClose={() => !aprobarSubmitting && setAprobarForm(null)}
        title={`Aprobar — ${aprobarForm?.row.cliente}`}
        ariaLabel="Formulario de aprobación"
      >
        {aprobarForm && (
          <div className="p-5 space-y-4">
            {aprobarForm.row.source === 'pending_approval' && (
              <>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700">ID de Transacción</label>
                    <input
                      type="text"
                      value={aprobarForm.transactionId}
                      onChange={e => setAprobarForm({ ...aprobarForm, transactionId: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 bg-white"
                      placeholder="ID de la transacción"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Monto (COP)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={aprobarForm.amount}
                    onChange={e => setAprobarForm({ ...aprobarForm, amount: Number(e.target.value) })}
                    className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
              {aprobarForm.row.clientId && (
                <div className="flex justify-between text-slate-500">
                  <span>ID Cliente</span>
                  <span className="font-mono text-slate-700">{aprobarForm.row.clientId}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Tipo</span>
                <span className="font-medium text-slate-700">{TIPO_LABEL[aprobarForm.row.source] || aprobarForm.row.tipo}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Plan actual</span>
                <span className="font-medium text-slate-700">{aprobarForm.row.planNombre}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Valor</span>
                <span className="font-semibold text-slate-700">{formatCurrency(aprobarForm.amount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Fecha solicitud</span>
                <span className="text-slate-700">{formatDateShort(aprobarForm.row.fechaSolicitud)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                onClick={() => setAprobarForm(null)}
                disabled={aprobarSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprobar}
                disabled={aprobarSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {aprobarSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar aprobación
              </button>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  )
}