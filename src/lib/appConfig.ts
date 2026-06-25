export const APP_CONFIG = {
  whatsapp: '573228372341',
  email: 'juan.dev1809@gmail.com',
  responseTime: '3 dias habiles',
  company: 'JGSoftworks',
  product: 'VenxPOS',
} as const

export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/${APP_CONFIG.whatsapp}?text=${encodeURIComponent(text)}`
}

export function buildMailtoUrl(subject: string, body?: string): string {
  let url = `mailto:${APP_CONFIG.email}?subject=${encodeURIComponent(subject)}`
  if (body) url += `&body=${encodeURIComponent(body)}`
  return url
}
