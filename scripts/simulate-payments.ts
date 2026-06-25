/**
 * VenxPOS SaaS — Simulación de 4 escenarios de pago Wompi Sandbox
 * Uso: npx tsx scripts/simulate-payments.ts
 * Usa el service_role key de .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const vars: Record<string, string> = {}
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  content.split('\n').forEach(line => {
    const t = line.trim()
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=')
      if (i > 0) vars[t.substring(0, i)] = t.substring(i + 1)
    }
  })
}

const supabaseUrl = vars['VITE_SUPABASE_URL']
const serviceKey = vars['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: Configura VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function getOrCreateTestTenant(): Promise<string> {
  // Buscar un tenant existente en pending_payment
  const { data: tenants } = await supabase.from('tenants').select('id,email_propietario').eq('estado', 'pending_payment').limit(1)

  if (tenants && tenants.length > 0) {
    const t = tenants[0]
    console.log(`\nUsando tenant existente: ${(t as Record<string,string>).email_propietario} (${(t as Record<string,string>).id})`)
    return (t as Record<string,string>).id
  }

  console.log('No hay tenants pending. Registra uno primero desde la app.')
  process.exit(1)
}

async function simulateApproved(tenantId: string) {
  console.log('\n=== ESCENARIO 1: PAGO APROBADO ===')

  const txId = `sim-approved-${Date.now()}`

  // Insertar payment aprobado
  const { data: payment, error } = await supabase.from('payments').insert({
    tenant_id: tenantId,
    wompi_transaction_id: txId,
    wompi_reference: `SIM-OK-${tenantId.substring(0, 8)}`,
    amount: 150000,
    currency: 'COP',
    status: 'approved',
    payment_method_type: 'CARD',
    tipo: 'initial',
  }).select('id').single()

  if (error) { console.error('Error:', error.message); return }

  console.log(`Payment creado: ${(payment as Record<string,string>).id}`)

  // Activar tenant via RPC
  const { error: rpcError } = await supabase.rpc('process_webhook_approval', {
    p_payment_id: (payment as Record<string,string>).id,
    p_tenant_id: tenantId,
    p_transaction_id: txId,
  })

  if (rpcError) {
    console.error('Error RPC:', rpcError.message)
    return
  }

  // Verificar
  const { data: tenant } = await supabase.from('tenants').select('estado').eq('id', tenantId).single()
  console.log(`Tenant estado: ${(tenant as Record<string,string>).estado}`)
  console.log('RESULTADO: Pago aprobado — Tenant ACTIVADO')
}

async function simulatePending(tenantId: string) {
  console.log('\n=== ESCENARIO 2: PAGO PENDIENTE POR 10 MINUTOS ===')

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data: payment, error } = await supabase.from('payments').insert({
    tenant_id: tenantId,
    wompi_transaction_id: `link-sim-pending-${Date.now()}`,
    wompi_reference: `SIM-PENDING-${tenantId.substring(0, 8)}`,
    amount: 150000,
    currency: 'COP',
    status: 'pending',
    payment_method_type: 'PAYMENT_LINK',
    tipo: 'initial',
    created_at: tenMinAgo,
  }).select('id').single()

  if (error) { console.error('Error:', error.message); return }

  console.log(`Payment pendiente creado: ${(payment as Record<string,string>).id} (creado hace 10 min)`)

  // Simular reconcile-payments
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/reconcile-payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
    })
    const result = await resp.json()
    console.log('Reconciliación:', JSON.stringify(result, null, 2))
  } catch (e) {
    console.log('Reconciliación no disponible (esperado si no hay webhook)')
  }

  console.log('RESULTADO: Pago pendiente — Revisa "Ya pagué, verificar" en la app')
}

async function simulateDeclined(tenantId: string) {
  console.log('\n=== ESCENARIO 3: PAGO RECHAZADO ===')

  const { data: payment, error } = await supabase.from('payments').insert({
    tenant_id: tenantId,
    wompi_transaction_id: `sim-declined-${Date.now()}`,
    wompi_reference: `SIM-DECLINED-${tenantId.substring(0, 8)}`,
    amount: 150000,
    currency: 'COP',
    status: 'declined',
    payment_method_type: 'CARD',
    tipo: 'initial',
  }).select('id').single()

  if (error) { console.error('Error:', error.message); return }

  console.log(`Payment declinado creado: ${(payment as Record<string,string>).id}`)
  console.log('RESULTADO: Pago rechazado — La app debe mostrar mensaje de error')
}

async function simulateReconnect(tenantId: string) {
  console.log('\n=== ESCENARIO 4: USUARIO CIERRA Y VUELVE ===')

  // Primero pongo el tenant como pending_payment otra vez
  await supabase.from('tenants').update({ estado: 'pending_payment' }).eq('id', tenantId)

  // Crear payment pending de hace 5 min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: payment, error } = await supabase.from('payments').insert({
    tenant_id: tenantId,
    wompi_transaction_id: `link-sim-reconnect-${Date.now()}`,
    wompi_reference: `SIM-RECONNECT-${tenantId.substring(0, 8)}`,
    amount: 150000,
    currency: 'COP',
    status: 'pending',
    payment_method_type: 'PAYMENT_LINK',
    tipo: 'initial',
    created_at: fiveMinAgo,
  }).select('id').single()

  if (error) { console.error('Error:', error.message); return }

  console.log(`Payment pendiente creado: ${(payment as Record<string,string>).id} (creado hace 5 min)`)
  console.log('RESULTADO: Simula cerrar y volver —')
  console.log('  1. En la app, inicia sesión con el usuario del tenant')
  console.log('  2. Serás redirigido a /pago (tenant en pending_payment)')
  console.log('  3. Click "Ya pagué, verificar ahora" → buscará el pago pendiente')
  console.log('  4. Para aprobarlo, ejecuta: npx tsx scripts/approve-payment.ts ' + tenantId)
}

async function main() {
  console.log('VenxPOS — Simulación de pagos Wompi Sandbox')
  console.log('=============================================')

  const tenantId = await getOrCreateTestTenant()

  await simulateApproved(tenantId)
  await simulatePending(tenantId)
  await simulateDeclined(tenantId)
  await simulateReconnect(tenantId)

  console.log('\n=============================================')
  console.log('Simulaciones completadas.')
  console.log('Revisa la app en http://localhost:5174/pago')
}

main().catch(console.error)
