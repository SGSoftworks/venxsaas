import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'
import { verifyWebhookSignature } from '../_shared/wompi.ts'
import { notifyPagoAprobado, notifyPagoRechazado, notifyRenovacionExitosa, notifySuscripcionVencida } from '../_shared/notify.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = await req.json()
    const checksum = req.headers.get('X-Event-Checksum') || ''

    const valid = await verifyWebhookSignature(body, checksum)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Firma inválida' }), { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    if (body.event !== 'transaction.updated') {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const tx = body.data.transaction

    // Buscar payment: primero por payment_link_id
    let { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('wompi_transaction_id', tx.payment_link_id || '')
      .maybeSingle()

    // Fallback: buscar por referencia
    if (!payment && tx.reference) {
      const { data: byRef } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('wompi_reference', tx.reference)
        .maybeSingle()
      payment = byRef
    }

    if (!payment && tx.reference) {
      // Try pending_signups as fallback
      const { data: signup } = await supabaseAdmin
        .from('pending_signups')
        .select('*')
        .eq('payment_reference', tx.reference)
        .eq('estado', 'pending_payment')
        .maybeSingle()

      if (signup && tx.status === 'APPROVED') {
        await supabaseAdmin
          .from('pending_signups')
          .update({ transaction_id: tx.id, estado: 'approved' })
          .eq('id', signup.id)

        return new Response(JSON.stringify({ ok: true, processed: 'signup' }), {
          status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      if (signup && tx.status === 'DECLINED') {
        await supabaseAdmin
          .from('pending_signups')
          .update({ transaction_id: tx.id, estado: 'cancelled' })
          .eq('id', signup.id)

        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    }

    if (!payment) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Idempotencia mejorada: si ya está en estado final para este evento, ignorar
    if (payment.status === 'approved' || payment.status === 'declined' || payment.status === 'voided' || payment.status === 'error') {
      return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Verificar monto
    const expectedCents = Math.round(Number(payment.amount) * 100)
    if (tx.amount_in_cents !== expectedCents) {
      await supabaseAdmin.from('payments').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', payment.id)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    if (tx.status === 'APPROVED') {
      if (payment.tipo === 'initial') {
        await supabaseAdmin.rpc('set_pending_approval', {
          p_tenant_id: payment.tenant_id,
          p_payment_id: payment.id,
          p_wompi_transaction_id: tx.id,
        })
        notifyPagoAprobado(payment.id, payment.tenant_id, tx.id)
      } else if (payment.tipo === 'recurring') {
        await supabaseAdmin.rpc('process_renewal', {
          p_tenant_id: payment.tenant_id,
          p_payment_id: payment.id,
          p_wompi_transaction_id: tx.id,
        })
        // Actualizar payment_source_id si el pago usó uno nuevo
        if (tx.payment_source_id) {
          await supabaseAdmin.from('subscriptions').update({ payment_source_id: String(tx.payment_source_id) }).eq('tenant_id', payment.tenant_id)
        }
        notifyRenovacionExitosa(payment.subscription_id, payment.tenant_id)
      } else if (payment.tipo === 'plan_change') {
        const newPlanId = payment.metadata?.new_plan_id
        if (newPlanId) {
          await supabaseAdmin.rpc('process_plan_change', {
            p_tenant_id: payment.tenant_id,
            p_payment_id: payment.id,
            p_new_plan_id: newPlanId,
            p_wompi_transaction_id: tx.id,
          })
        }
        notifyPagoAprobado(payment.id, payment.tenant_id, tx.id)
      }

      // Generar factura (process_renewal ya genera para recurring)
      const shouldGenerateInvoice = payment.tipo === 'initial' || payment.tipo === 'plan_change'
      if (shouldGenerateInvoice) {
        const internalKey = Deno.env.get('INTERNAL_API_KEY') || ''
        const fnUrl = Deno.env.get('SUPABASE_URL') ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-invoice` : ''
        if (fnUrl) {
          fetch(fnUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': internalKey },
            body: JSON.stringify({ paymentId: payment.id }),
          }).catch(e => console.error('Error calling generate-invoice:', e))
        }
      }
    } else if (tx.status === 'DECLINED') {
      await supabaseAdmin.from('payments').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', payment.id)
      if (payment.tipo === 'recurring') {
        await supabaseAdmin.rpc('mark_subscription_past_due', {
          p_tenant_id: payment.tenant_id,
          p_payment_id: payment.id,
        })
        notifySuscripcionVencida(payment.tenant_id)
      } else {
        notifyPagoRechazado(payment.id, payment.tenant_id)
      }
    } else if (tx.status === 'VOIDED' || tx.status === 'ERROR') {
      await supabaseAdmin.from('payments').update({ status: tx.status.toLowerCase(), updated_at: new Date().toISOString() }).eq('id', payment.id)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
