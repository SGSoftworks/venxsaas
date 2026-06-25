-- ============================================================================
-- VenxPOS SaaS — RPC para obtener productos con stock bajo
-- Útil para el widget de Dashboard que alerta sobre inventario crítico
-- ============================================================================

CREATE OR REPLACE FUNCTION get_low_stock_products(p_tenant_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE(
  producto_id       UUID,
  codigo_barras     TEXT,
  descripcion       TEXT,
  stock_actual      DECIMAL(12,3),
  stock_minimo      DECIMAL(12,3),
  sucursal_id       UUID,
  sucursal_nombre   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.codigo_barras,
    p.descripcion,
    COALESCE(inv.stk_actual, 0),
    p.stock_minimo,
    s.id,
    s.nombre
  FROM branch_accounts ba
  JOIN sucursales s ON s.id = ba.sucursal_id
  JOIN productos p ON p.sucursal_id = s.id AND p.activo = true
  LEFT JOIN LATERAL (
    SELECT i.stock_actual AS stk_actual
    FROM inventario_sucursal i
    WHERE i.sucursal_id = s.id AND i.producto_id = p.id
    LIMIT 1
  ) inv ON true
  WHERE ba.tenant_id = p_tenant_id
    AND ba.activo = true
    AND COALESCE(inv.stk_actual, 0) < p.stock_minimo
  ORDER BY (p.stock_minimo - COALESCE(inv.stk_actual, 0)) DESC
  LIMIT p_limit;
END;
$$;
