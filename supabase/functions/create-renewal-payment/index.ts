import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyAuth } from '../_shared/supabase.ts'
import { generateSignature } from '../_shared/wompi.ts'
import { getWompiBase } from '../_shared/env.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifyAuth(req)
    if (auth instanceof Response) return auth

    const body = await req.json()
    const { tenantId } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return new Response(JSON.stringify({ error: 'Tenant requerido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Verificar que el tenant pertenece al usuario
    const { data: tenant } = await supabaseAdmin.from('tenants').select('auth_user_id').eq('id', tenantId).single()
    if (!tenant || tenant.auth_user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Obtener suscripción activa y plan
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan_id, proximo_cobro')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub) {
      return new Response(JSON.stringify({ error: 'Suscripción no encontrada' }), { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('id, nombre, precio_mensual')
      .eq('id', sub.plan_id)
      .maybeSingle()

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plan no encontrado' }), { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const amountInCents = Math.round(plan.precio_mensual * 100)
    const privKey = Deno.env.get('WOMPI_PRIVATE_KEY')!
    const baseUrl = getWompiBase()
    const reference = `REN-${tenantId.substring(0, 8)}-${Date.now()}`
    const signature = await generateSignature(reference, amountInCents)

    // Crear payment link con expiración
    const wompiRes = await fetch(`${baseUrl}/payment_links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${privKey}` },
      body: JSON.stringify({
        name: `Renovación ${plan.nombre} VenxPOS`,
        description: `Renovación mensual — plan ${plan.nombre}`,
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

    // Registrar pago recurrente
    const { data: payment, error: dbError } = await supabaseAdmin
      .from('payments')
      .insert({
        tenant_id: tenantId,
        subscription_id: sub.id,
        wompi_transaction_id: paymentLinkId,
        wompi_reference: reference,
        amount: amountInCents / 100,
        currency: 'COP',
        status: 'pending',
        payment_method_type: 'PAYMENT_LINK',
        tipo: 'recurring',
      })
      .select('id')
      .single()

    if (dbError) {
      return new Response(JSON.stringify({ error: 'Error al registrar el pago' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      paymentId: payment.id,
      reference,
      amountInCents,
      paymentLinkId,
      integritySignature: signature,
    }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
