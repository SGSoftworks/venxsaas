import { create } from 'zustand'
import { supabase } from '@/lib/supabase/client'
import type { FacturaSaas, AuditLog, SalesKPI, MonthlyRevenue } from '@/types'

interface BillingState {
  facturas: FacturaSaas[]
  facturasLoading: boolean
  auditLogs: AuditLog[]
  salesKPI: SalesKPI | null
  monthlyRevenue: MonthlyRevenue[]

  fetchFacturas: (tenantId?: string) => Promise<void>
  fetchAuditLogs: (tenantId?: string) => Promise<void>
  fetchSalesKPI: (tenantId: string, sucursalId?: string, desde?: string, hasta?: string) => Promise<void>
  fetchMonthlyRevenue: (anio?: number) => Promise<void>
}

export const useBillingStore = create<BillingState>((set) => ({
  facturas: [],
  facturasLoading: false,
  auditLogs: [],
  salesKPI: null,
  monthlyRevenue: [],

  fetchFacturas: async (tenantId) => {
    set({ facturasLoading: true })
    try {
      let query = supabase
        .from('facturas_saas')
        .select('*')
        .order('created_at', { ascending: false })

      if (tenantId) query = query.eq('tenant_id', tenantId)

      const { data } = await query
      set({ facturas: (data as FacturaSaas[]) ?? [] })
    } catch {
      // silently fail
    } finally {
      set({ facturasLoading: false })
    }
  },

  fetchAuditLogs: async (tenantId) => {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (tenantId) query = query.eq('tenant_id', tenantId)

      const { data } = await query
      set({ auditLogs: (data as AuditLog[]) ?? [] })
    } catch {
      // silently fail
    }
  },

  fetchSalesKPI: async (tenantId, sucursalId, desde, hasta) => {
    try {
      const params: Record<string, string | undefined> = {
        p_tenant_id: tenantId,
        p_sucursal_id: sucursalId,
        p_desde: desde,
        p_hasta: hasta,
      }

      const { data } = await supabase.rpc('get_ventas_periodo', params)
      set({ salesKPI: data as unknown as SalesKPI })
    } catch {
      // silently fail
    }
  },

  fetchMonthlyRevenue: async (anio) => {
    try {
      const { data } = await supabase.rpc('get_facturacion_anual', { p_anio: anio ?? new Date().getFullYear() })
      set({ monthlyRevenue: (data as MonthlyRevenue[]) ?? [] })
    } catch {
      // silently fail
    }
  },
}))
