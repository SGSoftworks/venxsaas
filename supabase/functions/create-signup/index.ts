import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = await req.json()
    const { email, password, nombreNegocio, nit, telefono, planId } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Correo invalido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return new Response(JSON.stringify({ error: 'La contrasena debe tener al menos 8 caracteres' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!nombreNegocio || typeof nombreNegocio !== 'string') {
      return new Response(JSON.stringify({ error: 'Nombre del negocio requerido' }), {
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
      .select('id, nombre, precio_inicial')
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
      return new Response(JSON.stringify({ error: 'El correo ya esta registrado. Ve a /login para ingresar.' }), {
        status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Verificar NIT duplicado
    if (nit && typeof nit === 'string' && nit.trim()) {
      const { data: tenantWithNit } = await supabaseAdmin
        .from('tenants').select('id').eq('nit', nit.trim()).maybeSingle()
      if (tenantWithNit) {
        return new Response(JSON.stringify({ error: 'El NIT ya esta registrado. Usa otro NIT o contacta a soporte.' }), {
          status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    }

    // Crear auth user
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre_negocio: nombreNegocio, telefono: telefono || '' },
    })

    if (createErr) {
      if (createErr.message?.includes('already') || createErr.message?.includes('exists')) {
        return new Response(JSON.stringify({ error: 'El correo ya esta registrado. Ve a /login para ingresar.' }), {
          status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      console.error('createUser error:', createErr.message, createErr.status)
      return new Response(JSON.stringify({ error: 'Error al crear usuario: ' + createErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!authData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Error: usuario no creado' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Crear tenant
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .insert({
        auth_user_id: authData.user.id,
        nombre_negocio: nombreNegocio,
        nit: nit || null,
        email_propietario: email,
        telefono: telefono || '',
        plan_id: planId,
        estado: 'pending_approval',
      })
      .select('id')
      .single()

    if (tenantErr) {
      console.error('tenant insert error:', tenantErr.message, tenantErr.details)
      return new Response(JSON.stringify({ error: 'Error al crear negocio: ' + tenantErr.message }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      reference: tenant.id,
      tenantId: tenant.id,
      planName: plan.nombre,
      planPrice: plan.precio_inicial,
    }), { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('create-signup catch:', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ error: 'Error interno: ' + (err instanceof Error ? err.message : String(err)) }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
