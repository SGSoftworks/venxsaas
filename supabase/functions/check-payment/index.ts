import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyAuth } from '../_shared/supabase.ts'
import { getWompiBase } from '../_shared/env.ts'
import { notifyPagoAprobado, notifyPagoRechazado, notifyRenovacionExitosa, notifySuscripcionVencida } from '../_shared/notify.ts'

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

    const privKey = Deno.env.get('WOMPI_PRIVATE_KEY')!
    const baseUrl = getWompiBase()

    // Buscar payment pendiente más reciente
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('tipo', ['initial', 'recurring', 'plan_change'])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!payment) {
      return new Response(JSON.stringify({ status: 'not_found' }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const linkId = payment.wompi_transaction_id

    const today = new Date().toISOString().split('T')[0]
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const searchTx = async (param: string, value: string) => {
      const res = await fetch(`${baseUrl}/transactions?${param}=${value}&from_date=${lastWeek}&until_date=${today}&page=1&page_size=10`, {
        headers: { 'Authorization': `Bearer ${privKey}` },
      })
      if (res.ok) {
        const data = await res.json()
        return data.data?.[0] || null
      }
      return null
    }

    let tx = await searchTx('payment_link_id', linkId || '')
    if (!tx) tx = await searchTx('reference', payment.wompi_reference || '')

    if (tx) {
      if (tx.status === 'APPROVED') {
        if (payment.tipo === 'recurring') {
          await supabaseAdmin.rpc('process_renewal', {
            p_tenant_id: tenantId,
            p_payment_id: payment.id,
            p_wompi_transaction_id: tx.id,
          })
          if (tx.payment_source_id) {
            await supabaseAdmin.from('subscriptions').update({ payment_source_id: String(tx.payment_source_id) }).eq('tenant_id', tenantId)
          }
          notifyRenovacionExitosa(payment.subscription_id, tenantId)
        } else if (payment.tipo === 'plan_change') {
          const newPlanId = payment.metadata?.new_plan_id
          if (newPlanId) {
            await supabaseAdmin.rpc('process_plan_change', {
              p_tenant_id: tenantId,
              p_payment_id: payment.id,
              p_new_plan_id: newPlanId,
              p_wompi_transaction_id: tx.id,
            })
          }
          notifyPagoAprobado(payment.id, tenantId, tx.id)
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': Deno.env.get('INTERNAL_API_KEY') || '' },
            body: JSON.stringify({ paymentId: payment.id }),
          }).catch(() => {})
        } else {
          await supabaseAdmin.rpc('set_pending_approval', {
            p_tenant_id: tenantId,
            p_payment_id: payment.id,
            p_wompi_transaction_id: tx.id,
          })
          notifyPagoAprobado(payment.id, tenantId, tx.id)
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': Deno.env.get('INTERNAL_API_KEY') || '' },
            body: JSON.stringify({ paymentId: payment.id }),
          }).catch(() => {})
        }
        return new Response(JSON.stringify({ status: 'approved' }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
      }

      if (tx.status === 'DECLINED') {
        await supabaseAdmin.from('payments').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', payment.id)
        if (payment.tipo === 'recurring') {
          await supabaseAdmin.rpc('mark_subscription_past_due', {
            p_tenant_id: tenantId,
            p_payment_id: payment.id,
          })
          notifySuscripcionVencida(tenantId)
        } else {
          notifyPagoRechazado(payment.id, tenantId)
        }
        return new Response(JSON.stringify({ status: 'declined' }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ status: 'pending' }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('check-payment error:', err)
    return new Response(JSON.stringify({ status: 'error' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
