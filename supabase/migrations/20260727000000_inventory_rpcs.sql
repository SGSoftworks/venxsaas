-- ============================================================
-- Inventory RPCs for SaaS — SECURITY DEFINER to bypass POS RLS
-- ============================================================

-- Get all products for all branches of a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_products(
    p_tenant_id UUID,
    p_sucursal_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID, codigo_barras TEXT, descripcion TEXT, precio_venta DECIMAL(12,2),
    costo DECIMAL(12,2), activo BOOLEAN, stock_minimo DECIMAL(12,3),
    requiere_peso BOOLEAN, tarifa_iva DECIMAL(5,4), tarifa_impoconsumo DECIMAL(5,4),
    sucursal_id UUID, categoria_id UUID,
    stock_actual DECIMAL(12,3), categoria_nombre TEXT, sucursal_nombre TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT
        p.id, p.codigo_barras, p.descripcion, p.precio_venta,
        p.costo, p.activo, p.stock_minimo,
        p.requiere_peso, p.tarifa_iva, p.tarifa_impoconsumo,
        p.sucursal_id, p.categoria_id,
        COALESCE(ins.stock_actual, 0) AS stock_actual,
        c.nombre AS categoria_nombre,
        s.nombre AS sucursal_nombre
    FROM public.productos p
    JOIN public.sucursales s ON s.id = p.sucursal_id
    JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
        AND ba.tenant_id = p_tenant_id AND ba.activo = true
    LEFT JOIN public.categorias c ON c.id = p.categoria_id
    LEFT JOIN public.inventario_sucursal ins ON ins.sucursal_id = p.sucursal_id AND ins.producto_id = p.id
    WHERE (p_sucursal_id IS NULL OR p.sucursal_id = p_sucursal_id)
    ORDER BY p.descripcion;
$$;

-- Get categories for all branches of a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_categories(p_tenant_id UUID)
RETURNS TABLE(id UUID, nombre TEXT, sucursal_id UUID, sucursal_nombre TEXT, activo BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT c.id, c.nombre, c.sucursal_id, s.nombre AS sucursal_nombre, COALESCE(c.activo, true) AS activo
    FROM public.categorias c
    JOIN public.sucursales s ON s.id = c.sucursal_id
    JOIN public.branch_accounts ba ON ba.sucursal_id = c.sucursal_id
        AND ba.tenant_id = p_tenant_id AND ba.activo = true
    ORDER BY c.nombre;
$$;

-- Create product for a tenant's branch
CREATE OR REPLACE FUNCTION public.create_tenant_product(
    p_tenant_id UUID, p_sucursal_id UUID,
    p_codigo_barras TEXT, p_descripcion TEXT, p_precio_venta DECIMAL(12,2),
    p_costo DECIMAL(12,2), p_stock_inicial DECIMAL(12,3),
    p_stock_minimo DECIMAL(12,3), p_categoria_id UUID DEFAULT NULL,
    p_tarifa_iva DECIMAL(5,4) DEFAULT 0.19,
    p_tarifa_impoconsumo DECIMAL(5,4) DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_producto_id UUID;
BEGIN
    -- Verify branch belongs to tenant
    IF NOT EXISTS (
        SELECT 1 FROM public.branch_accounts
        WHERE tenant_id = p_tenant_id AND sucursal_id = p_sucursal_id AND activo = true
    ) THEN
        RAISE EXCEPTION 'Sucursal no pertenece al tenant';
    END IF;

    INSERT INTO public.productos (sucursal_id, codigo_barras, descripcion, precio_venta, costo, stock_minimo, categoria_id, tarifa_iva, tarifa_impoconsumo, activo)
    VALUES (p_sucursal_id, p_codigo_barras, p_descripcion, p_precio_venta, p_costo, p_stock_minimo, p_categoria_id, p_tarifa_iva, p_tarifa_impoconsumo, true)
    RETURNING id INTO v_producto_id;

    INSERT INTO public.inventario_sucursal (sucursal_id, producto_id, stock_actual, version, last_updated)
    VALUES (p_sucursal_id, v_producto_id, p_stock_inicial, 1, NOW())
    ON CONFLICT (sucursal_id, producto_id) DO NOTHING;

    RETURN v_producto_id;
END;
$$;

-- Update product (ownership validated via branch_accounts)
CREATE OR REPLACE FUNCTION public.update_tenant_product(
    p_tenant_id UUID, p_producto_id UUID,
    p_codigo_barras TEXT DEFAULT NULL, p_descripcion TEXT DEFAULT NULL,
    p_precio_venta DECIMAL(12,2) DEFAULT NULL, p_costo DECIMAL(12,2) DEFAULT NULL,
    p_stock_minimo DECIMAL(12,3) DEFAULT NULL,
    p_categoria_id UUID DEFAULT NULL,
    p_tarifa_iva DECIMAL(5,4) DEFAULT NULL,
    p_tarifa_impoconsumo DECIMAL(5,4) DEFAULT NULL,
    p_activo BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.productos p
        JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
        WHERE p.id = p_producto_id AND ba.tenant_id = p_tenant_id AND ba.activo = true
    ) THEN
        RAISE EXCEPTION 'Producto no pertenece al tenant';
    END IF;

    UPDATE public.productos SET
        codigo_barras = COALESCE(p_codigo_barras, codigo_barras),
        descripcion = COALESCE(p_descripcion, descripcion),
        precio_venta = COALESCE(p_precio_venta, precio_venta),
        costo = COALESCE(p_costo, costo),
        stock_minimo = COALESCE(p_stock_minimo, stock_minimo),
        categoria_id = COALESCE(p_categoria_id, categoria_id),
        tarifa_iva = COALESCE(p_tarifa_iva, tarifa_iva),
        tarifa_impoconsumo = COALESCE(p_tarifa_impoconsumo, tarifa_impoconsumo),
        activo = COALESCE(p_activo, activo)
    WHERE id = p_producto_id;
END;
$$;

-- Delete product (ownership validated via branch_accounts)
CREATE OR REPLACE FUNCTION public.delete_tenant_product(p_tenant_id UUID, p_producto_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.productos p
        JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
        WHERE p.id = p_producto_id AND ba.tenant_id = p_tenant_id AND ba.activo = true
    ) THEN
        RAISE EXCEPTION 'Producto no pertenece al tenant';
    END IF;

    DELETE FROM public.inventario_sucursal WHERE producto_id = p_producto_id;
    DELETE FROM public.productos WHERE id = p_producto_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_categories TO authenticated;

-- Stock adjustment for a tenant's product
CREATE OR REPLACE FUNCTION public.adjust_tenant_product_stock(
    p_tenant_id UUID, p_producto_id UUID,
    p_tipo TEXT, p_cantidad DECIMAL(12,3),
    p_observacion TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sucursal_id UUID;
    v_current_stock DECIMAL(12,3);
    v_new_stock DECIMAL(12,3);
BEGIN
    SELECT p.sucursal_id INTO v_sucursal_id
    FROM public.productos p
    JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
    WHERE p.id = p_producto_id AND ba.tenant_id = p_tenant_id AND ba.activo = true;

    IF v_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Producto no pertenece al tenant';
    END IF;

    SELECT stock_actual INTO v_current_stock
    FROM public.inventario_sucursal
    WHERE sucursal_id = v_sucursal_id AND producto_id = p_producto_id;

    v_current_stock := COALESCE(v_current_stock, 0);

    IF p_tipo = 'entrada' THEN
        v_new_stock := v_current_stock + p_cantidad;
    ELSIF p_tipo = 'salida' THEN
        v_new_stock := v_current_stock - p_cantidad;
    ELSE
        v_new_stock := p_cantidad;
    END IF;

    INSERT INTO public.inventario_sucursal (sucursal_id, producto_id, stock_actual, version, last_updated)
    VALUES (v_sucursal_id, p_producto_id, v_new_stock, 1, NOW())
    ON CONFLICT (sucursal_id, producto_id)
    DO UPDATE SET stock_actual = EXCLUDED.stock_actual, version = public.inventario_sucursal.version + 1, last_updated = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_tenant_product_stock TO authenticated;
