// Script de seeding para VenxPOS SaaS
// Crea el superadmin inicial y verifica la configuración
//
// Uso: npx tsx scripts/seed-saas.ts

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex)
        const value = trimmed.substring(eqIndex + 1)
        if (key && value) process.env[key] = value
      }
    }
  })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@jgsoftworks.com'
const superadminPassword = process.env.SUPERADMIN_PASSWORD || ''

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos')
  console.error('Configura .env.local con estas variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('VenxPOS SaaS — Seed Script')
  console.log('==========================\n')

  // 1. Verificar migraciones
  console.log('1. Verificando tablas SaaS...')
  const tables = ['plans', 'tenants', 'subscriptions', 'subscription_events', 'payments', 'branch_accounts', 'superadmins']
  for (const table of tables) {
    const { error } = await supabase.from(table).select('count', { count: 'exact', head: true })
    if (error) {
      console.error(`   ERROR: Tabla '${table}' no encontrada. Ejecuta las migraciones primero:`)
      console.error('   supabase db push')
      process.exit(1)
    }
    console.log(`   Tabla '${table}' OK`)
  }

  // 2. Verificar seed de planes
  console.log('\n2. Verificando planes...')
  const { data: plans, error: planError } = await supabase.from('plans').select('*')
  if (planError) {
    console.error('   ERROR:', planError.message)
    process.exit(1)
  }
  if (!plans || plans.length === 0) {
    console.log('   Insertando planes de seed...')
    const { error: seedError } = await supabase.from('plans').insert([
      {
        nombre: 'Básico', max_sucursales: 2, max_administradores: 2,
        precio_inicial: 150000, precio_mensual: 80000,
        features: JSON.stringify(['2 sucursales', '2 administradores', 'Reportes', 'Inventario', 'Soporte básico']),
        activo: true, destacado: false,
      },
      {
        nombre: 'Estándar', max_sucursales: 5, max_administradores: 5,
        precio_inicial: 250000, precio_mensual: 150000,
        features: JSON.stringify(['5 sucursales', '5 administradores', 'Reportes avanzados', 'Inventario multi-sucursal', 'Soporte prioritario']),
        activo: true, destacado: true,
      },
      {
        nombre: 'Pro', max_sucursales: 10, max_administradores: 10,
        precio_inicial: 400000, precio_mensual: 250000,
        features: JSON.stringify(['10 sucursales', '10 administradores', 'Reportes personalizados', 'API de acceso', 'Soporte 24/7']),
        activo: true, destacado: false,
      },
      {
        nombre: 'Empresarial', max_sucursales: 999, max_administradores: 999,
        precio_inicial: 0, precio_mensual: 0,
        features: JSON.stringify(['Sucursales ilimitadas', 'Administradores ilimitados', 'Personalización total', 'SLA garantizado', 'Gerente de cuenta dedicado']),
        activo: true, destacado: false,
      },
    ])
    if (seedError) console.error('   ERROR insertando planes:', seedError.message)
    else console.log('   Planes insertados correctamente')
  } else {
    console.log(`   ${plans.length} planes existentes:`)
    for (const p of plans) {
      console.log(`     - ${(p as Record<string, unknown>).nombre}: $${(p as Record<string, unknown>).precio_mensual}/mes`)
    }
  }

  // 3. Crear o verificar superadmin
  console.log('\n3. Configurando superadmin...')

  // Buscar usuario existente
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  let adminUser = existingUsers?.users.find(u => u.email === superadminEmail)

  if (!adminUser && superadminPassword) {
    console.log(`   Creando superadmin: ${superadminEmail}`)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: superadminEmail,
      password: superadminPassword,
      email_confirm: true,
      user_metadata: { nombre: 'JGSoftworks Admin', rol: 'superadmin' },
    })

    if (createError) {
      console.error('   ERROR creando superadmin:', createError.message)
    } else {
      adminUser = newUser.user
      console.log(`   Superadmin creado: ${adminUser?.id}`)
    }
  } else if (adminUser) {
    console.log(`   Superadmin existente: ${adminUser.email} (${adminUser.id})`)
  } else {
    console.log('   No se encontró superadmin. Configura SUPERADMIN_PASSWORD en .env.local')
  }

  // Registrar en tabla superadmins
  if (adminUser) {
    const { data: existingSA } = await supabase
      .from('superadmins')
      .select('*')
      .eq('user_id', adminUser.id)
      .maybeSingle()

    if (!existingSA) {
      const { error: saError } = await supabase.from('superadmins').insert({
        user_id: adminUser.id,
        nombre: 'JGSoftworks Admin',
      })
      if (saError) {
        console.error('   ERROR registrando superadmin:', saError.message)
      } else {
        console.log('   Superadmin registrado en tabla superadmins')
      }
    } else {
      console.log('   Superadmin ya registrado en tabla')
    }
  }

  console.log('\n==========================')
  console.log('Seed completado.')
  if (adminUser) {
    console.log(`\nCredenciales superadmin:`)
    console.log(`  Email: ${superadminEmail}`)
    console.log(`  URL Admin: http://localhost:5174/admin`)
  }
  console.log(`  URL App: http://localhost:5174`)
}

main().catch(console.error)
