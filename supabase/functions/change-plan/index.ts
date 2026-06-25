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
    const { tenantId, newPlanId } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return new Response(JSON.stringify({ error: 'Tenant requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!newPlanId || typeof newPlanId !== 'string') {
      return new Response(JSON.stringify({ error: 'Plan requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Verificar que el tenant pertenece al usuario (o es superadmin)
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id, plan_id, nombre_negocio, estado, auth_user_id')
      .eq('id', tenantId)
      .single()

    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant no encontrado' }), {
        status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Verificar superadmin permite cambio cross-tenant
    const { data: isSuper } = await supabaseAdmin.from('superadmins').select('id').eq('user_id', auth.user.id).maybeSingle()
    if (!isSuper && tenant.auth_user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Validate new plan exists
    const { data: newPlan } = await supabaseAdmin
      .from('plans')
      .select('id, nombre, precio_mensual')
      .eq('id', newPlanId)
      .eq('activo', true)
      .maybeSingle()
    if (!newPlan) {
      return new Response(JSON.stringify({ error: 'Plan no encontrado o inactivo' }), {
        status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Get current plan
    const { data: oldPlan } = await supabaseAdmin
      .from('plans')
      .select('id, nombre, precio_mensual')
      .eq('id', tenant.plan_id)
      .maybeSingle()

    // Get current subscription
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('proximo_cobro, plan_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const oldPrice = oldPlan?.precio_mensual ? Number(oldPlan.precio_mensual) : 0
    const newPrice = Number(newPlan.precio_mensual)

    let amountInCents = 0

    if (newPrice > oldPrice) {
      const today = new Date()
      let remainingDays = 30
      if (sub?.proximo_cobro) {
        const nextBilling = new Date(sub.proximo_cobro)
        const diffMs = nextBilling.getTime() - today.getTime()
        remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
      }
      const monthlyDiff = newPrice - oldPrice
      const prorated = (monthlyDiff * remainingDays) / 30
      amountInCents = Math.round(prorated * 100)
    }

    // Free change
    if (amountInCents <= 0) {
      await supabaseAdmin.rpc('process_plan_change', {
        p_tenant_id: tenantId,
        p_payment_id: '00000000-0000-0000-0000-000000000000',
        p_new_plan_id: newPlanId,
        p_wompi_transaction_id: 'free_change',
      })

      return new Response(JSON.stringify({ status: 'free' }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Create Wompi payment link with expiry
    const privKey = Deno.env.get('WOMPI_PRIVATE_KEY')!
    const baseUrl = getWompiBase()
    const reference = `CHG-${tenantId.substring(0, 8)}-${Date.now()}`
    const integritySignature = await generateSignature(reference, amountInCents)

    const wompiRes = await fetch(`${baseUrl}/payment_links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${privKey}` },
      body: JSON.stringify({
        name: 'Cambio de plan - VenxPOS',
        description: `Diferencia proporcional: ${oldPlan?.nombre || 'Actual'} → ${newPlan.nombre}`,
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
      return new Response(JSON.stringify({ error: 'Error al crear el link de pago' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const paymentLinkId = wompiData.data.id
    const amountInPesos = amountInCents / 100

    const { data: payment, error: dbError } = await supabaseAdmin
      .from('payments')
      .insert({
        tenant_id: tenantId,
        wompi_transaction_id: paymentLinkId,
        wompi_reference: reference,
        amount: amountInPesos,
        currency: 'COP',
        status: 'pending',
        payment_method_type: 'PAYMENT_LINK',
        tipo: 'plan_change',
        metadata: {
          new_plan_id: newPlanId,
          new_plan_nombre: newPlan.nombre,
          old_plan_id: oldPlan?.id || null,
          old_plan_nombre: oldPlan?.nombre || null,
          prorated_days: sub?.proximo_cobro
            ? Math.max(0, Math.ceil((new Date(sub.proximo_cobro).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 30,
          monthly_diff: (newPrice - oldPrice),
        },
      })
      .select('id')
      .single()

    if (dbError) {
      return new Response(JSON.stringify({ error: 'Error al registrar el pago' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      paymentId: payment.id,
      reference,
      amountInCents,
      amountInPesos,
      integritySignature,
      paymentLinkId,
      remainingDays: sub?.proximo_cobro
        ? Math.max(0, Math.ceil((new Date(sub.proximo_cobro).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 30,
      oldPlanName: oldPlan?.nombre || 'Actual',
      newPlanName: newPlan.nombre,
    }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
