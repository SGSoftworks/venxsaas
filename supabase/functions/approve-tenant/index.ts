import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifySuperAdmin } from '../_shared/supabase.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifySuperAdmin(req)
    if (auth instanceof Response) return auth

    const body = await req.json()
    const { tenantId, paymentProofId, transactionId, amount: bodyAmount } = body

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('id, estado, nombre_negocio, email_propietario, nit, plan_id, client_id')
      .eq('id', tenantId)
      .single()

    // Read payment proof data if provided
    let proofAmount = bodyAmount || 0
    let proofRef = transactionId || ''
    if (paymentProofId) {
      const { data: proof } = await supabaseAdmin
        .from('payment_proofs')
        .select('reference, amount')
        .eq('id', paymentProofId)
        .maybeSingle()
      if (proof) {
        proofRef = proofRef || proof.reference || ''
        proofAmount = bodyAmount || proof.amount || proofAmount
      }
    }

    // Fallback: use plan price if no amount
    if (!proofAmount && tenant?.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('precio_inicial')
        .eq('id', tenant.plan_id)
        .maybeSingle()
      if (plan) proofAmount = plan.precio_inicial
    }

    if (tenantErr || !tenant) {
      return new Response(JSON.stringify({ error: 'Tenant no encontrado' }), {
        status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const isPending = tenant.estado === 'pending_approval'
    const isActive = tenant.estado === 'active'

    // Approve payment proof if provided
    if (paymentProofId) {
      await supabaseAdmin
        .from('payment_proofs')
        .update({ status: 'approved', reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() })
        .eq('id', paymentProofId)
    }

    // If already active, just approve the proof and return
    if (isActive) {
      return new Response(JSON.stringify({
        ok: true, message: 'Comprobante aprobado. La cuenta ya estaba activa.',
      }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Only process pending_approval tenants
    if (!isPending) {
      return new Response(JSON.stringify({ error: 'Tenant no esta pendiente de aprobacion' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Activate tenant
    const { error: updErr } = await supabaseAdmin
      .from('tenants')
      .update({ estado: 'active', updated_at: new Date().toISOString() })
      .eq('id', tenantId)

    if (updErr) {
      return new Response(JSON.stringify({ error: 'Error al activar: ' + updErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Create empresa (optional)
    try {
      await supabaseAdmin.from('empresas').insert({
        nombre: tenant.nombre_negocio,
        plan: 'basico',
        estado: 'activo',
        tenant_id: tenantId,
      })
    } catch { /* optional */ }

    // Create active subscription (check first to avoid duplicates)
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('estado', 'active')
      .maybeSingle()

    if (!existingSub) {
      const { error: subErr } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_id: tenant.plan_id,
          estado: 'active',
          fecha_inicio: new Date().toISOString().split('T')[0],
          fecha_renovacion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          proximo_cobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })

      if (subErr) {
        return new Response(JSON.stringify({ error: 'Error al crear suscripcion: ' + subErr.message }), {
          status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    }

    // Create payment record
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('payments')
      .insert({
        tenant_id: tenantId,
        gateway_transaction_id: proofRef || null,
        gateway_reference: proofRef || null,
        amount: proofAmount || 0,
        currency: 'COP',
        status: 'approved',
        payment_method_type: 'MANUAL',
        tipo: 'initial',
        metadata: { client_id: tenant.client_id },
      })
      .select('id')
      .single()

    if (payErr) {
      return new Response(JSON.stringify({ error: 'Error al crear pago: ' + payErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Generate invoice directly via RPC (more reliable than fire-and-forget HTTP call)
    if (payment) {
      const { data: invId, error: invErr } = await supabaseAdmin.rpc('generar_factura_desde_pago', {
        p_payment_id: payment.id,
      })
      if (invErr) {
        console.error('Invoice generation error:', invErr.message)
      } else if (invId) {
        // Fire PDF generation in background with correct invoiceId
        try {
          const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-pdf`
          fetch(fnUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': Deno.env.get('INTERNAL_API_KEY') || '' },
            body: JSON.stringify({ invoiceId: invId }),
          }).catch((e) => console.error('PDF generation background error:', e))
        } catch { /* optional */ }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      tenantId,
      clientId: tenant.client_id || null,
      message: 'Cuenta activada, suscripcion creada y factura generada.',
    }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error: ' + (err instanceof Error ? err.message : String(err)) }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
