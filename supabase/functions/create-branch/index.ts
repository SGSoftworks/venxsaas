import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyAuth } from '../_shared/supabase.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifyAuth(req)
    if (auth instanceof Response) return auth

    const body = await req.json()
    const { tenantId, nombreSucursal, email, password } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return new Response(JSON.stringify({ error: 'Tenant requerido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }
    if (!nombreSucursal || typeof nombreSucursal !== 'string') {
      return new Response(JSON.stringify({ error: 'Nombre de sucursal requerido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('id', tenantId).maybeSingle()
    if (!tenant) return new Response(JSON.stringify({ error: 'Tenant no encontrado' }), { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

    if (tenant.auth_user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', tenant.plan_id).maybeSingle()
    if (!plan) return new Response(JSON.stringify({ error: 'Plan no encontrado' }), { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

    const { count: branchCount } = await supabaseAdmin
      .from('branch_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('activo', true)

    if ((branchCount || 0) >= plan.max_sucursales) {
      return new Response(JSON.stringify({ error: 'Has alcanzado el límite de sucursales para tu plan' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email || `${nombreSucursal.toLowerCase().replace(/\s+/g, '')}@${tenant.nombre_negocio.toLowerCase().replace(/\s+/g, '')}.pos`,
      password: password || Math.random().toString(36).slice(-10),
      email_confirm: true,
      user_metadata: { tenant_id: tenantId },
    })

    if (createError || !authUser?.user) {
      return new Response(JSON.stringify({ error: 'Error al crear usuario' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    let { data: empresa } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!empresa) {
      const { data: newEmpresa } = await supabaseAdmin
        .from('empresas')
        .insert({
          tenant_id: tenantId,
          nombre: tenant.nombre_negocio,
          plan: plan.nombre,
          estado: 'activo',
        })
        .select('id')
        .single()
      if (!newEmpresa) return new Response(JSON.stringify({ error: 'Error al crear empresa' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
      empresa = newEmpresa
    }

    const { data: sucursal } = await supabaseAdmin
      .from('sucursales')
      .insert({
        nombre: nombreSucursal,
        nit: tenant.nit,
        empresa_id: empresa.id,
      })
      .select('id')
      .single()

    if (!sucursal) return new Response(JSON.stringify({ error: 'Error al crear sucursal' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

    const randomPin = Math.floor(1000 + Math.random() * 9000).toString()

    await supabaseAdmin
      .from('usuarios')
      .insert({
        user_id: authUser.user.id,
        sucursal_id: sucursal.id,
        rol: 'admin',
        nombre: nombreSucursal,
        pin_acceso: randomPin,
        estado: 'activo',
      })

    const { data: branch } = await supabaseAdmin
      .from('branch_accounts')
      .insert({
        tenant_id: tenantId,
        sucursal_id: sucursal.id,
        user_id: authUser.user.id,
        nombre_sucursal: nombreSucursal,
        email,
        activo: true,
      })
      .select('id')
      .single()

    return new Response(JSON.stringify({
      branchId: branch?.id,
      sucursalId: sucursal.id,
      userId: authUser.user.id,
      email,
    }), { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
