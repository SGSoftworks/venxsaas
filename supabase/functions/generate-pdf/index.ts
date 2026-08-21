import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyInternalKey, verifySuperAdmin } from '../_shared/supabase.ts'
import { buildInvoicePdf } from './_shared/invoice-template.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const isInternal = await verifyInternalKey(req)
    if (!isInternal) {
      const auth = await verifySuperAdmin(req)
      if (auth instanceof Response) return auth
    }

    const body = await req.json()
    const { invoiceId } = body
    console.log('[generate-pdf] invoiceId:', invoiceId)

    if (!invoiceId || typeof invoiceId !== 'string') {
      return new Response(JSON.stringify({ error: 'invoiceId requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    console.log('[generate-pdf] Fetching factura...')
    const { data: factura, error: facturaErr } = await supabaseAdmin
      .from('facturas_saas')
      .select('*, tenants(*)')
      .eq('id', invoiceId)
      .single()

    if (facturaErr || !factura) {
      console.error('[generate-pdf] Factura not found:', facturaErr?.message)
      return new Response(JSON.stringify({ error: 'Factura no encontrada', detail: facturaErr?.message }), {
        status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    console.log('[generate-pdf] Factura found:', factura.numero_factura)

    const tenant = factura.tenants as Record<string, unknown>
    if (!tenant) {
      console.error('[generate-pdf] Tenant data missing from factura relation')
      return new Response(JSON.stringify({ error: 'Tenant data missing' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    console.log('[generate-pdf] Tenant:', tenant.nombre_negocio, tenant.id)

    console.log('[generate-pdf] Fetching plan...')
    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('nombre')
      .eq('id', tenant.plan_id)
      .maybeSingle()
    console.log('[generate-pdf] Plan:', plan?.nombre || '—')

    console.log('[generate-pdf] Counting sucursales...')
    const { count: sucursalesCount } = await supabaseAdmin
      .from('branch_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
    console.log('[generate-pdf] Sucursales count:', sucursalesCount)

    console.log('[generate-pdf] Fetching payment...')
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('payment_method_type, tipo, gateway_reference')
      .eq('id', factura.payment_id)
      .maybeSingle()
    console.log('[generate-pdf] Payment:', payment?.payment_method_type || 'MANUAL', 'tipo:', payment?.tipo || '—')

    console.log('[generate-pdf] Fetching subscription...')
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('proximo_cobro, fecha_renovacion, fecha_inicio, estado')
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    console.log('[generate-pdf] Subscription:', subscription?.proximo_cobro || '—', 'estado:', subscription?.estado || '—')

    const paymentTipo = payment?.tipo || ''
    let invoiceTipo: 'activacion' | 'renovacion' | 'cambio_plan' | 'otro' = 'otro'
    if (paymentTipo === 'initial') {
      invoiceTipo = 'activacion'
    } else if (paymentTipo === 'recurring' || paymentTipo === 'renewal') {
      invoiceTipo = 'renovacion'
    } else if (paymentTipo === 'plan_change') {
      invoiceTipo = 'cambio_plan'
    }

    let oldPlanNombre: string | null = null
    if (invoiceTipo === 'cambio_plan') {
      console.log('[generate-pdf] Fetching subscription_events for old plan name...')
      const { data: lastEvent } = await supabaseAdmin
        .from('subscription_events')
        .select('metadata')
        .eq('tenant_id', tenant.id)
        .eq('tipo', 'plan_changed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lastEvent?.metadata) {
        const meta = lastEvent.metadata as Record<string, unknown>
        oldPlanNombre = (meta.old_plan_name as string) || null
        console.log('[generate-pdf] Old plan name:', oldPlanNombre)
      }
    }

    const proximoPago = subscription?.proximo_cobro || subscription?.fecha_renovacion || null
    const fechaInicioPeriodo = paymentTipo === 'recurring' || paymentTipo === 'renewal'
      ? factura.created_at?.slice(0, 10)
      : null
    const fechaFinPeriodo = proximoPago

    const metodoPago = payment?.payment_method_type || 'MANUAL'
    const metodoLabel: Record<string, string> = {
      CARD: 'Tarjeta',
      NEQUI: 'Nequi',
      PSE: 'PSE',
      BANCOLOMBIA_TRANSFER: 'Bancolombia',
      DAVIPLATA: 'Daviplata',
      PAYMENT_LINK: 'Link de pago',
      MANUAL: 'Manual',
    }

    let estadoStr = subscription?.estado || '—'
    const estadoMap: Record<string, string> = {
      pending: 'Pendiente',
      active: 'Activo',
      past_due: 'Moroso',
      cancelled: 'Cancelado',
      expired: 'Expirado',
    }
    estadoStr = estadoMap[estadoStr.toLowerCase()] || estadoStr

    console.log('[generate-pdf] Building PDF...')
    const pdfBytes = await buildInvoicePdf({
      numero: factura.numero_factura,
      concepto: factura.concepto,
      subtotal: Number(factura.subtotal),
      iva: Number(factura.iva),
      total: Number(factura.total),
      moneda: factura.moneda || 'COP',
      created_at: factura.created_at,
      gateway_transaction_id: factura.gateway_transaction_id,
      gateway_reference: payment?.gateway_reference || null,
      metodo_pago: metodoLabel[metodoPago] || metodoPago,
      tenant_nombre: String(tenant.nombre_negocio || ''),
      tenant_nit: String(tenant.nit || ''),
      tenant_email: String(tenant.email_propietario || ''),
      tenant_telefono: tenant.telefono as string | null,
      plan_nombre: plan?.nombre || '—',
      cliente_id: String(tenant.client_id || tenant.id || '—'),
      estado: estadoStr,
      old_plan_nombre: oldPlanNombre,
      sucursales_count: sucursalesCount ?? 0,
      tipo: invoiceTipo,
      proximo_pago: proximoPago,
      fecha_inicio_periodo: fechaInicioPeriodo,
      fecha_fin_periodo: fechaFinPeriodo,
    })
    console.log('[generate-pdf] PDF built, size:', pdfBytes.byteLength, 'bytes')

    const bucketName = 'invoices'
    const filePath = `${tenant.id}/${factura.numero_factura}.pdf`

    console.log('[generate-pdf] Uploading via supabaseAdmin.storage...')
    const { error: uploadErr } = await supabaseAdmin
      .storage
      .from(bucketName)
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[generate-pdf] Upload failed:', uploadErr.message, JSON.stringify(uploadErr))
      return new Response(JSON.stringify({ error: 'Error al subir PDF a storage', detail: uploadErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    console.log('[generate-pdf] Upload success')

    const storageUrl = Deno.env.get('SUPABASE_URL')
    if (!storageUrl) {
      console.error('[generate-pdf] SUPABASE_URL not set for public URL')
      return new Response(JSON.stringify({ error: 'SUPABASE_URL not set' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    console.log('[generate-pdf] Getting public URL...')
    const { data: publicUrl } = await supabaseAdmin
      .storage
      .from(bucketName)
      .getPublicUrl(filePath)

    const pdfUrl = publicUrl?.publicUrl || `${storageUrl}/storage/v1/object/public/${bucketName}/${filePath}`
    console.log('[generate-pdf] Public URL:', pdfUrl)

    console.log('[generate-pdf] Updating factura pdf_url...')
    const { error: updateErr } = await supabaseAdmin
      .from('facturas_saas')
      .update({ pdf_url: pdfUrl })
      .eq('id', invoiceId)

    if (updateErr) {
      console.error('[generate-pdf] Failed to update pdf_url:', updateErr.message)
    } else {
      console.log('[generate-pdf] pdf_url updated')
    }

    return new Response(JSON.stringify({
      url: pdfUrl,
      path: filePath,
    }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[generate-pdf] UNCAUGHT ERROR:', err instanceof Error ? err.stack : String(err))
    return new Response(JSON.stringify({ error: 'Error interno al generar PDF' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
