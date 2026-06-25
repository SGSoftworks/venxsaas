import { getWompiBase } from './env.ts'

export async function wompiRequest(path: string, options: RequestInit = {}, usePrivate = true) {
  const baseUrl = getWompiBase()
  const privateKey = Deno.env.get('WOMPI_PRIVATE_KEY')
  const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY')

  if (!privateKey || !publicKey) {
    throw new Error('WOMPI_PRIVATE_KEY and WOMPI_PUBLIC_KEY must be set')
  }

  const key = usePrivate ? privateKey : publicKey

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Error de Wompi: ${response.status}`)
  }

  return response.json()
}

export async function generateSignature(reference: string, amountInCents: number): Promise<string> {
  const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET')
  if (!integritySecret) throw new Error('WOMPI_INTEGRITY_SECRET must be set')

  const data = `${reference}${amountInCents}COP${integritySecret}`
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hash))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const WEBHOOK_TTL_MS = 5 * 60 * 1000

export async function verifyWebhookSignature(body: Record<string, unknown>, checksum: string): Promise<boolean> {
  if (!checksum) return false

  const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET')
  if (!eventsSecret) return false

  const timestamp = body.timestamp as number | undefined
  if (!timestamp) return false

  const now = Date.now()
  if (now - timestamp * 1000 > WEBHOOK_TTL_MS) {
    console.error('Webhook timestamp expired:', { timestamp, now, diff: now - timestamp * 1000 })
    return false
  }

  const sig = body.signature as { properties: string[]; checksum: string } | undefined
  if (!sig) return false

  if (sig.checksum && sig.checksum !== checksum) {
    console.error('Webhook checksum mismatch between body and header')
    return false
  }

  const { properties } = sig
  const values = properties.map((p: string) => {
    const parts = p.split('.')
    let current: unknown = body
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part]
      }
    }
    return String(current ?? '')
  })

  const data = values.join('') + timestamp + eventsSecret

  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hash))
  const computed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return computed.toUpperCase() === checksum.toUpperCase()
}
