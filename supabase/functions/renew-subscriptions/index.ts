import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyInternalKey } from '../_shared/supabase.ts'
import { wompiRequest, generateSignature } from '../_shared/wompi.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (!await verifyInternalKey(req)) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders(req) })
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: subscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('*, tenants(email_propietario, id), plans(precio_mensual)')
      .eq('estado', 'active')
      .lte('proximo_cobro', today)
      .not('payment_source_id', 'is', null)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: corsHeaders(req) })
    }

    const results = []
    for (const sub of subscriptions) {
      try {
        const amountInCents = Math.round(((sub.plans as { precio_mensual: number }).precio_mensual || 0) * 100)
        const tenantId = (sub.tenants as { id: string }).id
        const reference = `VENX-RENEW-${tenantId.substring(0, 8)}-${Date.now()}`
        const signature = await generateSignature(reference, amountInCents)
        const email = (sub.tenants as { email_propietario: string }).email_propietario

        const paymentSourceId = sub.payment_source_id
        if (!paymentSourceId || isNaN(Number(paymentSourceId))) {
          results.push({ tenantId, status: 'error', error: 'payment_source_id inválido' })
          continue
        }

        const { data: txData } = await wompiRequest('/transactions', {
          method: 'POST',
          body: JSON.stringify({
            amount_in_cents: amountInCents,
            currency: 'COP',
            customer_email: email,
            reference,
            signature,
            payment_source_id: Number(paymentSourceId),
          }),
        })

        await supabaseAdmin.from('payments').insert({
          tenant_id: tenantId,
          subscription_id: sub.id,
          wompi_transaction_id: txData.data.id,
          wompi_reference: reference,
          amount: amountInCents / 100,
          currency: 'COP',
          status: 'pending',
          payment_method_type: 'CARD',
          tipo: 'recurring',
        })

        results.push({ tenantId, status: 'processing', transactionId: txData.data.id })
      } catch (error) {
        results.push({ tenantId: (sub.tenants as { id: string }).id, status: 'error' })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch {
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: corsHeaders(req) })
  }
})
