import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const vars: Record<string, string> = {}
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const t = line.trim()
    if (t && !t.startsWith('#')) { const i = t.indexOf('='); if (i > 0) vars[t.substring(0,i)] = t.substring(i+1) }
  })
}

const supabase = createClient(vars['VITE_SUPABASE_URL'], vars['SUPABASE_SERVICE_ROLE_KEY'])
const tenantId = process.argv[2]

if (!tenantId) { console.error('Uso: npx tsx scripts/approve-payment.ts <tenantId>'); process.exit(1) }

async function main() {
  // Buscar payment pendiente más reciente
  const { data: payment } = await supabase.from('payments')
    .select('*').eq('tenant_id', tenantId).eq('status','pending')
    .order('created_at',{ascending:false}).limit(1).maybeSingle()

  if (!payment) { console.log('No hay pagos pendientes'); return }

  const { error } = await supabase.rpc('process_webhook_approval', {
    p_payment_id: (payment as Record<string,string>).id,
    p_tenant_id: tenantId,
  })

  if (error) { console.error('Error:', error.message); return }
  console.log('Pago aprobado. Tenant activado.')
}

main()
