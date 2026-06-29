export const APP_CONFIG = {
  whatsapp: '573228372341',
  email: 'juan.dev1809@gmail.com',
  responseTime: 'L-V 7AM a 7PM',
  company: 'JGSoftworks',
  product: 'VenxPOS',
  POS_WEB_URL: 'https://venxpos-pos.netlify.app/',
} as const

export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/${APP_CONFIG.whatsapp}?text=${encodeURIComponent(text)}`
}


