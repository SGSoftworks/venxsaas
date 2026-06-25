-- Grant execute on invoice RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION public.generar_factura_desde_pago TO authenticated;
GRANT EXECUTE ON FUNCTION public.generar_numero_factura TO authenticated;
