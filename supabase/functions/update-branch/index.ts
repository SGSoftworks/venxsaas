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
    const { branchAccountId, nombre_sucursal, nit, direccion, telefono } = body

    if (!branchAccountId || typeof branchAccountId !== 'string') {
      return new Response(JSON.stringify({ error: 'branchAccountId requerido' }), { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: branch, error: branchError } = await supabaseAdmin
      .from('branch_accounts')
      .select('tenant_id, sucursal_id, nombre_sucursal')
      .eq('id', branchAccountId)
      .maybeSingle()

    if (branchError || !branch) {
      return new Response(JSON.stringify({ error: 'Sucursal no encontrada' }), { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: superadmin } = await supabaseAdmin
      .from('superadmins')
      .select('id')
      .eq('user_id', auth.user.id)
      .maybeSingle()

    const isSuperAdmin = !!superadmin

    if (!isSuperAdmin) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('id', branch.tenant_id)
        .eq('auth_user_id', auth.user.id)
        .maybeSingle()

      if (!tenant) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
      }
    }

    let sucursalData: Record<string, string | null> = {}

    if (branch.sucursal_id) {
      const { data: sucursal } = await supabaseAdmin
        .from('sucursales')
        .select('nombre, nit, direccion, telefono')
        .eq('id', branch.sucursal_id)
        .maybeSingle()

      if (sucursal) {
        sucursalData = {
          nombre_sucursal: sucursal.nombre,
          nit: sucursal.nit,
          direccion: sucursal.direccion ?? '',
          telefono: sucursal.telefono ?? '',
        }
      }
    }

    const hasUpdates = typeof nombre_sucursal === 'string' || typeof nit === 'string' || typeof direccion === 'string' || typeof telefono === 'string'

    if (hasUpdates) {
      const updateBranchAccount: Record<string, string> = {}
      if (typeof nombre_sucursal === 'string') updateBranchAccount.nombre_sucursal = nombre_sucursal

      if (Object.keys(updateBranchAccount).length > 0) {
        await supabaseAdmin.from('branch_accounts').update(updateBranchAccount).eq('id', branchAccountId)
      }

      if (branch.sucursal_id) {
        const updateSucursal: Record<string, string> = {}
        if (typeof nombre_sucursal === 'string') updateSucursal.nombre = nombre_sucursal
        if (typeof nit === 'string') updateSucursal.nit = nit
        if (typeof direccion === 'string') updateSucursal.direccion = direccion
        if (typeof telefono === 'string') updateSucursal.telefono = telefono

        if (Object.keys(updateSucursal).length > 0) {
          await supabaseAdmin.from('sucursales').update(updateSucursal).eq('id', branch.sucursal_id)
        }

        sucursalData = {
          nombre_sucursal: nombre_sucursal ?? sucursalData.nombre_sucursal ?? branch.nombre_sucursal,
          nit: nit ?? sucursalData.nit ?? '',
          direccion: direccion ?? sucursalData.direccion ?? '',
          telefono: telefono ?? sucursalData.telefono ?? '',
        }
      }
    }

    return new Response(JSON.stringify({ success: true, data: sucursalData }), { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

  } catch {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
