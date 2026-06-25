import { supabaseAdmin } from './supabase.ts'
import { pagoAprobadoHtml, pagoRechazadoHtml, renovacionExitosaHtml, suscripcionVencidaHtml } from './email-template.ts'

const FN_URL = Deno.env.get('SUPABASE_URL')
const INTERNAL_KEY = Deno.env.get('INTERNAL_API_KEY') || ''

async function sendEmail(to: string, subject: string, html: string) {
  if (!FN_URL) return
  try {
    await fetch(`${FN_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_KEY,
      },
      body: JSON.stringify({ to, subject, html }),
    })
  } catch (err) {
    console.error('Error sending email:', err)
  }
}

function fmtCOP(n: number): string {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export async function notifyPagoAprobado(paymentId: string, tenantId: string, transactionId: string) {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, tenants(nombre, email_propietario), plans(nombre)')
    .eq('id', paymentId)
    .single()
  if (!payment?.tenants?.email_propietario) return

  const tenant = payment.tenants as { nombre: string; email_propietario: string }
  const plan = payment.plans as { nombre: string } | null
  const now = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  await sendEmail(
    tenant.email_propietario,
    'VenxPOS — Pago aprobado',
    pagoAprobadoHtml({
      negocio: tenant.nombre,
      monto: fmtCOP(Number(payment.amount)),
      referencia: transactionId,
      fecha: now,
      plan: plan?.nombre || '—',
    }),
  )
}

export async function notifyPagoRechazado(paymentId: string, tenantId: string, motivo?: string) {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, tenants(nombre, email_propietario)')
    .eq('id', paymentId)
    .single()
  if (!payment?.tenants?.email_propietario) return

  const tenant = payment.tenants as { nombre: string; email_propietario: string }

  await sendEmail(
    tenant.email_propietario,
    'VenxPOS — Pago rechazado',
    pagoRechazadoHtml({
      negocio: tenant.nombre,
      monto: fmtCOP(Number(payment.amount)),
      referencia: payment.wompi_reference || payment.wompi_transaction_id || '—',
      motivo,
    }),
  )
}

export async function notifyRenovacionExitosa(subscriptionId: string, tenantId: string) {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('*, tenants(nombre, email_propietario), plans(nombre)')
    .eq('id', subscriptionId)
    .single()
  if (!sub?.tenants?.email_propietario) return

  const tenant = sub.tenants as { nombre: string; email_propietario: string }
  const plan = sub.plans as { nombre: string } | null
  const proxCobro = sub.proximo_cobro
    ? new Date(sub.proximo_cobro).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  await sendEmail(
    tenant.email_propietario,
    'VenxPOS — Renovación exitosa',
    renovacionExitosaHtml({
      negocio: tenant.nombre,
      monto: fmtCOP(Number(sub.precio)),
      fecha_proximo_cobro: proxCobro,
      plan: plan?.nombre || '—',
    }),
  )
}

export async function notifySuscripcionVencida(tenantId: string) {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('nombre, email_propietario')
    .eq('id', tenantId)
    .single()
  if (!tenant?.email_propietario) return

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('*, plans(nombre)')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const plan = (sub?.plans as { nombre: string } | null)?.nombre || '—'

  await sendEmail(
    tenant.email_propietario,
    'VenxPOS — Suscripción vencida',
    suscripcionVencidaHtml({
      negocio: tenant.nombre,
      plan,
    }),
  )
}
