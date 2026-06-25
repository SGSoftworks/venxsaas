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
    const { userId, newPassword } = body

    if (!userId || typeof userId !== 'string' || userId.length !== 36) {
      return new Response(JSON.stringify({ error: 'ID de usuario inválido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Error al actualizar la contrasena' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('tenants')
      .update({ temp_password: newPassword })
      .eq('auth_user_id', userId)
      .catch(() => {})

    return new Response(JSON.stringify({ ok: true, password: newPassword }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
