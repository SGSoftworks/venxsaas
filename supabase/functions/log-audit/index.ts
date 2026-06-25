import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin, verifyInternalKey } from '../_shared/supabase.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const isValid = await verifyInternalKey(req)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { tenantId, userId, accion, entidad, entidadId, metadata, ipAddress } = body

    if (!accion || typeof accion !== 'string') {
      return new Response(JSON.stringify({ error: 'accion requerida' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await supabaseAdmin.rpc('log_audit', {
      p_tenant_id: tenantId || null,
      p_user_id: userId || null,
      p_accion: accion,
      p_entidad: entidad || 'unknown',
      p_entidad_id: entidadId || null,
      p_metadata: metadata || {},
      p_ip_address: ipAddress || null,
    })

    if (error) {
      console.error('Error logging audit:', error)
      return new Response(JSON.stringify({ error: 'Error al registrar auditoría' }), {
        status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ id: data }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('log-audit error:', err)
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
