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
    const { nombreNegocio, nit, email, telefono, planId, fechaInicio } = body

    if (!nombreNegocio || typeof nombreNegocio !== 'string') {
      return new Response(JSON.stringify({ error: 'Nombre del negocio requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Correo invalido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!telefono || typeof telefono !== 'string') {
      return new Response(JSON.stringify({ error: 'Telefono requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!planId || typeof planId !== 'string') {
      return new Response(JSON.stringify({ error: 'Plan requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('id, nombre')
      .eq('id', planId)
      .eq('activo', true)
      .maybeSingle()

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plan no encontrado o inactivo' }), {
        status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('email_propietario', email)
      .maybeSingle()

    if (existingTenant) {
      return new Response(JSON.stringify({ error: 'Ya existe un cliente con ese correo' }), {
        status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const tempPassword = Math.random().toString(36).slice(2, 8) + 'A1!'

    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre_negocio: nombreNegocio, telefono },
    })

    if (createErr) {
      if (createErr.message?.includes('already') || createErr.message?.includes('exists')) {
        return new Response(JSON.stringify({ error: 'El correo ya esta registrado en auth' }), {
          status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      console.error('createUser error:', createErr.message)
      return new Response(JSON.stringify({ error: 'Error al crear usuario: ' + createErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!authData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Error: usuario no creado' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user.id

    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .insert({
        auth_user_id: userId,
        nombre_negocio: nombreNegocio,
        nit: nit || null,
        email_propietario: email,
        telefono,
        plan_id: planId,
        estado: 'active',
        temp_password: tempPassword,
        must_change_password: true,
      })
      .select('id, client_id')
      .single()

    if (tenantErr) {
      console.error('tenant insert error:', tenantErr.message)
      return new Response(JSON.stringify({ error: 'Error al crear negocio: ' + tenantErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    try {
      await supabaseAdmin.from('empresas').insert({
        nombre: nombreNegocio,
        plan: 'basico',
        estado: 'activo',
        tenant_id: tenant.id,
      })
    } catch { /* optional */ }

    const inicio = fechaInicio && typeof fechaInicio === 'string' ? fechaInicio : new Date().toISOString().split('T')[0]
    const renovacion = new Date(new Date(inicio + 'T00:00:00').getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        tenant_id: tenant.id,
        plan_id: planId,
        estado: 'active',
        fecha_inicio: inicio,
        fecha_renovacion: renovacion,
        proximo_cobro: renovacion,
      })

    if (subErr) {
      console.error('subscription insert error:', subErr.message)
      return new Response(JSON.stringify({ error: 'Error al crear suscripcion: ' + subErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      tenantId: tenant.id,
      clientId: tenant.client_id,
      tempPassword,
      email,
    }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('create-client unhandled error:', err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
