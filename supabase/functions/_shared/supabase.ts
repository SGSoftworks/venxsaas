import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function verifyAuth(req: Request): Promise<{ user: { id: string; email?: string } } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  return { user: { id: user.id, email: user.email } }
}

export async function verifySuperAdmin(req: Request): Promise<{ user: { id: string; email?: string } } | Response> {
  const result = await verifyAuth(req)
  if (result instanceof Response) return result
  const { user } = result

  const { data } = await supabaseAdmin.from('superadmins').select('id').eq('user_id', user.id).maybeSingle()
  if (!data) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

  return { user }
}

export async function verifyInternalKey(req: Request): Promise<boolean> {
  const key = req.headers.get('X-Internal-Key')
  const expected = Deno.env.get('INTERNAL_API_KEY')
  if (!expected) {
    console.error('CRITICAL: INTERNAL_API_KEY environment variable is not set. All internal endpoints are exposed.')
    return false
  }
  if (!key) return false
  return key === expected
}
