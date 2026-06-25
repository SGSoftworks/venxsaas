import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyInternalKey } from '../_shared/supabase.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const isValid = await verifyInternalKey(req)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { paymentId } = body

    if (!paymentId || typeof paymentId !== 'string') {
      return new Response(JSON.stringify({ error: 'paymentId requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Generar factura via RPC
    const { data: facturaId, error: rpcError } = await supabaseAdmin.rpc('generar_factura_desde_pago', {
      p_payment_id: paymentId,
    })

    if (rpcError) {
      console.error('Error al generar factura:', rpcError)
      return new Response(JSON.stringify({ error: 'Error al generar factura' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Obtener factura generada
    const { data: factura } = await supabaseAdmin
      .from('facturas_saas')
      .select('*')
      .eq('id', facturaId)
      .single()

    // Generar PDF en segundo plano (no bloqueante)
    const pdfUrl = Deno.env.get('SUPABASE_URL') ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-pdf` : ''

    if (pdfUrl) {
      const internalKey = Deno.env.get('INTERNAL_API_KEY') || ''
      fetch(pdfUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': internalKey },
        body: JSON.stringify({ invoiceId: facturaId }),
      }).catch(e => console.error('Error calling generate-pdf:', e))
    }

    // Log audit
    if (factura) {
      supabaseAdmin.rpc('log_audit', {
        p_tenant_id: factura.tenant_id,
        p_accion: 'factura_generada',
        p_entidad: 'facturas_saas',
        p_entidad_id: facturaId,
        p_metadata: { numero_factura: factura.numero_factura, payment_id: paymentId },
      }).catch(() => {})
    }

    return new Response(JSON.stringify({
      facturaId,
      numero: factura?.numero_factura,
    }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('generate-invoice error:', err)
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
