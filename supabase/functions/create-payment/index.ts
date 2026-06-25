import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyAuth } from '../_shared/supabase.ts'
import { generateSignature, wompiRequest } from '../_shared/wompi.ts'
import { getWompiBase } from '../_shared/env.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifyAuth(req)
    if (auth instanceof Response) return auth

    const body = await req.json()
    const { planId, tenantId, customerEmail, amountInCents } = body

    if (!planId || typeof planId !== 'string') {
      return new Response(JSON.stringify({ error: 'Plan requerido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }
    if (!tenantId || typeof tenantId !== 'string') {
      return new Response(JSON.stringify({ error: 'Tenant requerido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }
    if (!amountInCents || typeof amountInCents !== 'number' || amountInCents <= 0) {
      return new Response(JSON.stringify({ error: 'Monto inválido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Verificar que el tenant pertenece al usuario
    const { data: tenant } = await supabaseAdmin.from('tenants').select('auth_user_id, estado').eq('id', tenantId).single()
    if (!tenant || tenant.auth_user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const privKey = Deno.env.get('WOMPI_PRIVATE_KEY')!
    const baseUrl = getWompiBase()
    const reference = `VENX-${tenantId.substring(0,8)}-${Date.now()}`
    const integritySignature = await generateSignature(reference, amountInCents)

    // Crear payment link con expiración
    const wompiRes = await fetch(`${baseUrl}/payment_links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${privKey}` },
      body: JSON.stringify({
        name: 'Pago inicial VenxPOS',
        description: 'Configuracion + primera sucursal + primer mes',
        amount_in_cents: amountInCents,
        single_use: true,
        collect_shipping: false,
        currency: 'COP',
        reference,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    })

    const wompiData = await wompiRes.json()
    if (!wompiRes.ok) {
      return new Response(JSON.stringify({ error: 'Error al crear el link de pago' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const paymentLinkId = wompiData.data.id

    // Registrar pago
    const { data: payment, error: dbError } = await supabaseAdmin
      .from('payments')
      .insert({
        tenant_id: tenantId,
        wompi_transaction_id: paymentLinkId,
        wompi_reference: reference,
        amount: amountInCents / 100,
        currency: 'COP',
        status: 'pending',
        payment_method_type: 'PAYMENT_LINK',
        tipo: 'initial',
      })
      .select('id')
      .single()

    if (dbError) {
      return new Response(JSON.stringify({ error: 'Error al registrar el pago' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Crear/actualizar subscription
    const { data: existingSub } = await supabaseAdmin.from('subscriptions').select('id').eq('tenant_id', tenantId).maybeSingle()
    if (existingSub) {
      await supabaseAdmin.from('subscriptions').update({ plan_id: planId, estado: 'pending', updated_at: new Date().toISOString() }).eq('id', existingSub.id)
    } else {
      await supabaseAdmin.from('subscriptions').insert({ tenant_id: tenantId, plan_id: planId, estado: 'pending' })
    }

    return new Response(JSON.stringify({
      paymentId: payment.id,
      reference,
      amountInCents,
      integritySignature,
      paymentLinkId,
    }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
