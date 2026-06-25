-- Enable RLS and add policies for payment_proofs
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- Tenant owners can see their own proofs
CREATE POLICY "Tenant can view own proofs"
ON public.payment_proofs FOR SELECT
USING (
  tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  OR is_superadmin()
);

-- Tenant owners can insert their own proofs
CREATE POLICY "Tenant can insert own proofs"
ON public.payment_proofs FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
);

-- Superadmin can do everything
CREATE POLICY "Superadmin full access"
ON public.payment_proofs FOR ALL
USING (is_superadmin())
WITH CHECK (is_superadmin());

-- Clean all test data
DELETE FROM public.payment_proofs;
DELETE FROM public.pending_signups;
DELETE FROM public.facturas_saas;
DELETE FROM public.audit_logs;
DELETE FROM public.subscription_events;
DELETE FROM public.payments;
DELETE FROM public.subscriptions;
DELETE FROM public.branch_accounts;
DELETE FROM public.ventas_conflicto;
DELETE FROM public.devolucion_detalles;
DELETE FROM public.devoluciones;
DELETE FROM public.movimientos_inventario;
DELETE FROM public.cierres_caja;
DELETE FROM public.aperturas_caja;
DELETE FROM public.venta_detalles;
DELETE FROM public.ventas;
DELETE FROM public.inventario_sucursal;
DELETE FROM public.eventos_auditoria;
DELETE FROM public.productos;
DELETE FROM public.categorias;
DELETE FROM public.usuarios;
DELETE FROM public.sucursales;
DELETE FROM public.empresas;
DELETE FROM public.tenants;
DELETE FROM public.invoice_counter;
