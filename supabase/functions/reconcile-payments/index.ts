import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifySuperAdmin, verifyInternalKey } from '../_shared/supabase.ts'
import { getWompiBase } from '../_shared/env.ts'
import { notifyPagoAprobado, notifyPagoRechazado, notifyRenovacionExitosa, notifySuscripcionVencida } from '../_shared/notify.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (!await verifyInternalKey(req)) {
      const auth = await verifySuperAdmin(req)
      if (auth instanceof Response) return auth
    }

    const privKey = Deno.env.get('WOMPI_PRIVATE_KEY')
    const baseUrl = getWompiBase()

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('status', 'pending')
      .lte('created_at', fifteenMinAgo)
      .order('created_at', { ascending: true })
      .limit(50)

    if (!payments || payments.length === 0) {
      return new Response(JSON.stringify({ reconciled: 0 }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const results = []
    for (const payment of payments) {
      try {
        let tx = null

        if (payment.payment_method_type === 'PAYMENT_LINK') {
          const txRes = await fetch(`${baseUrl}/transactions?payment_link_id=${payment.wompi_transaction_id}`, {
            headers: { 'Authorization': `Bearer ${privKey}` },
          })
          if (txRes.ok) {
            const txData = await txRes.json()
            tx = txData.data?.[0] || null
          }
        } else if (payment.payment_method_type === 'CARD' && payment.wompi_reference) {
          const txRes = await fetch(`${baseUrl}/transactions?reference=${payment.wompi_reference}`, {
            headers: { 'Authorization': `Bearer ${privKey}` },
          })
          if (txRes.ok) {
            const txData = await txRes.json()
            tx = txData.data?.[0] || null
          }
        }

        if (tx) {
          if (tx.status === 'APPROVED') {
            if (payment.tipo === 'recurring') {
              await supabaseAdmin.rpc('process_renewal', {
                p_tenant_id: payment.tenant_id,
                p_payment_id: payment.id,
                p_wompi_transaction_id: tx.id,
              })
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
            } else {
              await supabaseAdmin.rpc('set_pending_approval', {
                p_tenant_id: payment.tenant_id,
                p_payment_id: payment.id,
                p_wompi_transaction_id: tx.id,
              })
              notifyPagoAprobado(payment.id, payment.tenant_id, tx.id)
            }
            results.push({ id: payment.id, status: 'approved' })
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
            results.push({ id: payment.id, status: 'declined' })
          } else {
            results.push({ id: payment.id, status: tx.status.toLowerCase() })
          }
        } else {
          results.push({ id: payment.id, status: 'still_pending' })
        }
      } catch {
        results.push({ id: payment.id, status: 'error' })
      }
    }

    return new Response(JSON.stringify({ reconciled: results.length, results }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch {
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
