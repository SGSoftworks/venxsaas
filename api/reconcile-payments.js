export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  const expectedKey = process.env.CRON_SECRET

  if (expectedKey && (!authHeader || authHeader !== `Bearer ${expectedKey}`)) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const internalKey = process.env.INTERNAL_API_KEY

  if (!supabaseUrl || !internalKey) {
    return res.status(500).json({ error: 'Faltan variables de entorno' })
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/reconcile-payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': internalKey,
      },
    })

    const data = await response.json()
    return res.status(response.ok ? 200 : 500).json(data)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
