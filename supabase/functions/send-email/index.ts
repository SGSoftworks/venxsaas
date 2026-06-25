import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyInternalKey } from '../_shared/supabase.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY must be set')

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const isInternal = await verifyInternalKey(req)
    if (!isInternal) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { to, subject, html } = body

    if (!to || typeof to !== 'string') {
      return new Response(JSON.stringify({ error: 'Destinatario requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'VenxPOS <sistema@venxpos.com>',
        to,
        subject,
        html,
      }),
    })

    const result = await response.json()

    return new Response(JSON.stringify(result), {
      status: response.ok ? 200 : 400,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch {
    return new Response(JSON.stringify({ error: 'Error al enviar el correo' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
