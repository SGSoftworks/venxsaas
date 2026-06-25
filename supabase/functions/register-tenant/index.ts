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
      .select('id')
      .eq('id', planId)
      .eq('activo', true)
      .maybeSingle()

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plan no encontrado o inactivo' }), {
        status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let userId: string

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre_negocio: nombreNegocio, telefono },
    })

    if (authError) {
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
        const found = existing?.users?.find(u => u.email === email)
        if (found) {
          const { data: existingTenant } = await supabaseAdmin
            .from('tenants').select('id').eq('auth_user_id', found.id).maybeSingle()
          if (existingTenant) {
            return new Response(JSON.stringify({ userId: found.id, tenantId: existingTenant.id, existed: true }), {
              status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
            })
          }
          userId = found.id
        } else {
          return new Response(JSON.stringify({ error: 'El correo ya esta registrado pero no se pudo encontrar el usuario' }), {
            status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          })
        }
      } else {
        console.error('Error creating user:', authError.message)
        return new Response(JSON.stringify({ error: 'Error al crear la cuenta' }), {
          status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    } else if (authUser?.user) {
      userId = authUser.user.id
    } else {
      return new Response(JSON.stringify({ error: 'Error al crear la cuenta' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (nit && typeof nit === 'string') {
      const { data: tenantWithNit } = await supabaseAdmin
        .from('tenants').select('id').eq('nit', nit).maybeSingle()

      if (tenantWithNit) {
        return new Response(JSON.stringify({
          error: 'El NIT ya esta registrado. Usa otro NIT o contacta a soporte.',
        }), {
          status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        auth_user_id: userId,
        nombre_negocio: nombreNegocio,
        nit,
        email_propietario: email,
        telefono,
        plan_id: planId,
        estado: 'pending_payment',
      })
      .select('id')
      .single()

    if (tenantError) {
      console.error('Error creating tenant:', tenantError.message)
      return new Response(JSON.stringify({ error: 'Error al crear el registro del negocio' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ userId, tenantId: tenant.id }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('register-tenant unhandled error:', err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
