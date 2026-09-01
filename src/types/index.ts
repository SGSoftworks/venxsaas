export interface Tenant {
  id: string
  client_id?: string | null
  temp_password?: string | null
  must_change_password?: boolean | null
  nombre_negocio: string
  nit: string
  email_propietario: string
  telefono: string
  estado: 'pending_payment' | 'active' | 'suspended' | 'cancelled' | 'pending_approval'
  auth_user_id: string
  plan_id: string | null
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  nombre: string
  max_sucursales: number
  max_administradores: number
  precio_inicial: number
  precio_mensual: number
  features: string[]
  activo: boolean
  destacado: boolean
  created_at: string
}

export interface Subscription {
  id: string
  tenant_id: string
  plan_id: string
  estado: 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired'
  fecha_inicio: string | null
  fecha_renovacion: string | null
  proximo_cobro: string | null
  payment_source_id: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  tenant_id: string
  subscription_id: string | null
  amount: number
  currency: string
  status: 'pending' | 'approved' | 'declined' | 'voided' | 'error'
  payment_method_type: string | null
  tipo: 'initial' | 'recurring' | 'manual' | 'retry' | 'plan_change'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BranchAccount {
  id: string
  tenant_id: string
  sucursal_id: string | null
  user_id: string | null
  nombre_sucursal: string
  email: string
  activo: boolean
  created_at: string
}

export interface AdminKPI {
  mrr: number
  arr: number
  activeClients: number
  pastDueClients: number
  monthlyRevenue: number
  totalBranches: number
  conversionRate: number
  totalInvoices: number
  suspendedClients: number
  expiringSoon: number
  monthlyRenewals: number
  pendingApprovalClients: number
}

export interface FacturaSaas {
  id: string
  tenant_id: string
  payment_id: string | null
  numero_factura: string
  concepto: string
  subtotal: number
  total: number
  moneda: string
  estado: 'emitida' | 'pagada' | 'anulada' | 'reembolsada'
  pdf_url: string | null
  created_at: string
  updated_at: string
  tenant_nombre?: string
  tenant_nit?: string
}

export interface AuditLog {
  id: string
  tenant_id: string | null
  user_id: string | null
  accion: string
  entidad: string
  entidad_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
  user_email?: string
  tenant_nombre?: string
}

export interface SalesKPI {
  total_ventas: number
  cantidad_transacciones: number
  ticket_promedio: number
  ganancia: number
}

export interface MonthlyRevenue {
  mes: number
  total: number
  cantidad: number
}

export interface PaymentProof {
  id: string
  tenant_id: string
  plan_id: string | null
  amount: number
  payment_date: string
  proof_url: string | null
  notes: string | null
  status: 'pending_review' | 'approved' | 'rejected'
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export interface SubscriptionRequest {
  id: string
  tenant_id: string
  subscription_id: string | null
  tipo: 'RENOVACION' | 'CAMBIO_PLAN'
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  plan_actual_id: string | null
  plan_nuevo_id: string | null
  solicitud_data: Record<string, unknown>
  aprobado_por: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface PendingPayment {
  tenant_id: string
  nombre_negocio: string
  total: number
  dias_vencido: number
}
