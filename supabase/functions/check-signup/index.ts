import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'
import { getWompiBase } from '../_shared/env.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get('reference')

    if (!reference) {
      return new Response(JSON.stringify({ error: 'Reference requerido' }), {
        status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: signup, error: signupError } = await supabaseAdmin
      .from('pending_signups')
      .select('*')
      .eq('reference', reference)
      .maybeSingle()

    if (signupError || !signup) {
      return new Response(JSON.stringify({ status: 'not_found' }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (signup.estado === 'approved') {
      return new Response(JSON.stringify({
        status: 'approved',
        paymentLinkId: signup.wompi_payment_link_id,
        planName: signup.nombre_negocio,
      }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (signup.estado === 'expired') {
      return new Response(JSON.stringify({ status: 'expired' }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (signup.estado === 'cancelled') {
      return new Response(JSON.stringify({ status: 'cancelled' }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Check expiration
    if (new Date(signup.expires_at) < new Date()) {
      await supabaseAdmin
        .from('pending_signups')
        .update({ estado: 'expired' })
        .eq('id', signup.id)

      return new Response(JSON.stringify({ status: 'expired' }), {
        status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Query Wompi for payment status
    if (signup.wompi_payment_link_id || signup.payment_reference) {
      const privKey = Deno.env.get('WOMPI_PRIVATE_KEY')!
      const baseUrl = getWompiBase()
      const today = new Date().toISOString().split('T')[0]
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      let tx = null

      if (signup.wompi_payment_link_id) {
        const res = await fetch(
          `${baseUrl}/transactions?payment_link_id=${signup.wompi_payment_link_id}&from_date=${lastWeek}&until_date=${today}&page=1&page_size=5`,
          { headers: { 'Authorization': `Bearer ${privKey}` } }
        )
        if (res.ok) {
          const data = await res.json()
          tx = data.data?.[0] || null
        }
      }

      if (!tx && signup.payment_reference) {
        const res = await fetch(
          `${baseUrl}/transactions?reference=${signup.payment_reference}&from_date=${lastWeek}&until_date=${today}&page=1&page_size=5`,
          { headers: { 'Authorization': `Bearer ${privKey}` } }
        )
        if (res.ok) {
          const data = await res.json()
          tx = data.data?.[0] || null
        }
      }

      if (tx) {
        if (tx.status === 'APPROVED') {
          await supabaseAdmin
            .from('pending_signups')
            .update({ transaction_id: tx.id, estado: 'approved' })
            .eq('id', signup.id)

          // Create auth user + tenant + subscription
          try {
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: signup.email,
              password: signup.password_hash,
              email_confirm: true,
              user_metadata: { nombre_negocio: signup.nombre_negocio, telefono: signup.telefono },
            })

            if (!authError && authUser?.user) {
              await supabaseAdmin
                .from('tenants')
                .insert({
                  auth_user_id: authUser.user.id,
                  nombre_negocio: signup.nombre_negocio,
                  nit: signup.nit,
                  email_propietario: signup.email,
                  telefono: signup.telefono,
                  plan_id: signup.plan_id,
                  estado: 'pending_approval',
                })

              await supabaseAdmin
                .from('payments')
                .insert({
                  tenant_id: (await supabaseAdmin.from('tenants').select('id').eq('email_propietario', signup.email).single()).data?.id,
                  wompi_transaction_id: tx.id,
                  wompi_reference: signup.payment_reference,
                  amount: signup.amount_in_cents ? signup.amount_in_cents / 100 : 0,
                  currency: 'COP',
                  status: 'approved',
                  payment_method_type: tx.payment_method_type || 'CARD',
                  tipo: 'initial',
                })
            }
          } catch (err) {
            console.error('check-signup activation error:', err)
          }

          return new Response(JSON.stringify({ status: 'approved' }), {
            status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          })
        }

        if (tx.status === 'DECLINED') {
          await supabaseAdmin
            .from('pending_signups')
            .update({ transaction_id: tx.id })
            .eq('id', signup.id)

          return new Response(JSON.stringify({ status: 'declined' }), {
            status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          })
        }
      }
    }

    return new Response(JSON.stringify({
      status: 'pending',
      paymentLinkId: signup.wompi_payment_link_id,
      planName: signup.nombre_negocio,
    }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('check-signup error:', err)
    return new Response(JSON.stringify({ status: 'error' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
