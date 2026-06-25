import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyAuth } from '../_shared/supabase.ts'
import { isSandbox } from '../_shared/env.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (!isSandbox()) {
      return new Response(JSON.stringify({ error: 'No disponible en producción' }), { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const auth = await verifyAuth(req)
    if (auth instanceof Response) return auth

    const body = await req.json()
    const { tenantId, planId, amount } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return new Response(JSON.stringify({ error: 'Tenant requerido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: tenant } = await supabaseAdmin.from('tenants').select('auth_user_id').eq('id', tenantId).single()
    if (!tenant || tenant.auth_user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const txId = `sim-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`

    const { data: payment, error: dbError } = await supabaseAdmin
      .from('payments')
      .insert({
        tenant_id: tenantId,
        wompi_transaction_id: txId,
        wompi_reference: `SIM-${tenantId.substring(0, 8)}-${Date.now()}`,
        amount: amount || 0,
        currency: 'COP',
        status: 'approved',
        payment_method_type: 'CARD',
        tipo: 'initial',
      })
      .select('id')
      .single()

    if (dbError) {
      return new Response(JSON.stringify({ error: 'Error al simular el pago' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    await supabaseAdmin.rpc('process_webhook_approval', {
      p_payment_id: payment.id,
      p_tenant_id: tenantId,
      p_transaction_id: txId,
      p_payment_source_id: '',
    })

    return new Response(JSON.stringify({ ok: true, tenantId }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
