const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://venxsaas.vercel.app',
  'https://venxpos.com',
  'https://www.venxpos.com',
  'https://venxpos.vercel.app',
  'https://venxpos.netlify.app',
  'https://venxpos-pos.netlify.app',
]

const PREVIEW_ORIGIN = /^https:\/\/venxsaas-[a-z0-9-]+\.vercel\.app$/

const ALLOWED_METHODS = 'POST, GET, OPTIONS'
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-event-checksum'

function getOrigin(req: Request): string {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.find(o => origin.includes(o.replace('https://', '').replace('http://', '')))
  if (allowed) return origin
  if (PREVIEW_ORIGIN.test(origin)) return origin
  return ALLOWED_ORIGINS[0]
}

export function corsHeaders(req?: Request) {
  const origin = req ? getOrigin(req) : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Vary': 'Origin',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }
  return null
}
