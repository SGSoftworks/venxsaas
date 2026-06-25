import { PDFDocument, StandardFonts, rgb, PageSizes } from 'npm:pdf-lib@1.17.1'

interface InvoiceData {
  numero: string
  concepto: string
  subtotal: number
  iva: number
  total: number
  moneda: string
  created_at: string
  wompi_transaction_id: string | null
  metodo_pago: string
  tenant_nombre: string
  tenant_nit: string
  tenant_email: string
  tenant_telefono: string | null
  plan_nombre: string
  sucursales_count: number
}

const LOGO_URL = 'https://beacnoxukkoellhecofm.supabase.co/storage/v1/object/public/branding/logo-saas.png'

const BLUE_DARK = rgb(0.059, 0.09, 0.165)
const BLUE = rgb(0.427, 0.235, 0.961)
const GREEN = rgb(0.063, 0.725, 0.506)
const GRAY_TEXT = rgb(0.394, 0.451, 0.529)
const GRAY_LIGHT = rgb(0.886, 0.91, 0.941)
const GRAY_BG = rgb(0.973, 0.98, 0.988)
const WHITE = rgb(1, 1, 1)
const BLACK_SOFT = rgb(0.059, 0.09, 0.165)

export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  console.log('[invoice-template] Creating PDFDocument...')
  const doc = await PDFDocument.create()
  console.log('[invoice-template] Adding A4 page...')
  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  console.log('[invoice-template] Page size:', width, 'x', height)

  console.log('[invoice-template] Embedding fonts...')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)
  console.log('[invoice-template] Fonts embedded')

  const MARGIN = 50
  const RIGHT_X = width - MARGIN

  let y = height - 60

  // --- TOP BAR ---
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: BLUE })

  // --- LOGO ---
  try {
    console.log('[invoice-template] Fetching logo...')
    const logoRes = await fetch(LOGO_URL, { signal: AbortSignal.timeout(5000) })
    if (logoRes.ok) {
      const logoBytes = await logoRes.arrayBuffer()
      console.log('[invoice-template] Logo fetched, size:', logoBytes.byteLength, 'bytes')
      const logoImg = await doc.embedPng(new Uint8Array(logoBytes))
      const aspect = logoImg.width / logoImg.height
      const logoH = 42
      const logoW = logoH * aspect
      page.drawImage(logoImg, { x: MARGIN, y: y - logoH, width: logoW, height: logoH })
      console.log('[invoice-template] Logo drawn')
    } else {
      console.log('[invoice-template] Logo fetch not OK, status:', logoRes.status)
      page.drawText('VenxPOS', { x: MARGIN, y: y - 10, size: 22, font: fontBold, color: BLUE })
    }
  } catch (e) {
    console.log('[invoice-template] Logo fallback:', e instanceof Error ? e.message : String(e))
    page.drawText('VenxPOS', { x: MARGIN, y: y - 10, size: 22, font: fontBold, color: BLUE })
  }

  // --- ISSUER DATA (right column) ---
  const issuerX = RIGHT_X - 200
  page.drawText('JGSoftworks', { x: issuerX, y, size: 10, font: fontBold, color: BLUE_DARK })
  y -= 13
  page.drawText('NIT: 1030528858-1', { x: issuerX, y, size: 8, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('Juan David Gomez Ruidiaz', { x: issuerX, y, size: 8, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('KR 39 #13 - 42', { x: issuerX, y, size: 8, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('Tel: 3228372341', { x: issuerX, y, size: 8, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('juan.dev1809@gmail.com', { x: issuerX, y, size: 8, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('Regimen: N/A', { x: issuerX, y, size: 8, font, color: GRAY_TEXT })

  // --- INVOICE TITLE (below logo) ---
  y = height - 115
  page.drawRectangle({ x: MARGIN, y: y - 8, width: width - 100, height: 1, color: GRAY_LIGHT })

  y -= 25
  page.drawText('FACTURA ELECTRONICA', { x: MARGIN, y, size: 14, font: fontBold, color: BLUE_DARK })
  y -= 18
  page.drawText(data.numero, { x: MARGIN, y, size: 20, font: fontBold, color: BLUE })
  y -= 14
  page.drawText(`Fecha de emision: ${data.created_at.slice(0, 10)}`, { x: MARGIN, y, size: 9, font, color: GRAY_TEXT })

  y -= 30
  page.drawRectangle({ x: MARGIN, y: y - 8, width: width - 100, height: 1, color: GRAY_LIGHT })

  // --- CLIENT DATA ---
  y -= 28
  page.drawText('DATOS DEL CLIENTE', { x: MARGIN, y, size: 9, font: fontBold, color: BLUE_DARK })
  y -= 14
  page.drawRectangle({ x: MARGIN, y, width: 32, height: 2, color: BLUE })

  y -= 16
  const clientLeft = [
    `Negocio: ${data.tenant_nombre}`,
    `NIT: ${data.tenant_nit}`,
    `Email: ${data.tenant_email}`,
  ]
  for (const line of clientLeft) {
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: BLACK_SOFT })
    y -= 14
  }

  const clientRight = [
    `Telefono: ${data.tenant_telefono || '—'}`,
    `Plan: ${data.plan_nombre}`,
    `Sucursales: ${data.sucursales_count}`,
  ]
  let ry = y + 42
  for (const line of clientRight) {
    page.drawText(line, { x: MARGIN + 250, y: ry, size: 9, font, color: BLACK_SOFT })
    ry -= 14
  }

  // --- PAYMENT DATA ---
  y -= 20
  page.drawRectangle({ x: MARGIN, y: y + 10, width: width - 100, height: 1, color: GRAY_LIGHT })
  y -= 15
  page.drawText('DATOS DEL PAGO', { x: MARGIN, y, size: 9, font: fontBold, color: BLUE_DARK })
  y -= 14
  page.drawRectangle({ x: MARGIN, y, width: 32, height: 2, color: BLUE })

  y -= 16
  page.drawText(`ID Transaccion: ${data.wompi_transaction_id || '—'}`, { x: MARGIN, y, size: 9, font: mono, color: BLACK_SOFT })
  y -= 14
  page.drawText(`Metodo de pago: ${data.metodo_pago}`, { x: MARGIN, y, size: 9, font, color: BLACK_SOFT })

  // --- DETAIL TABLE ---
  y -= 35
  page.drawRectangle({ x: MARGIN, y: y - 2, width: width - 100, height: 22, color: BLUE })
  page.drawText('Concepto', { x: MARGIN + 8, y: y + 3, size: 9, font: fontBold, color: WHITE })
  page.drawText('Subtotal', { x: RIGHT_X - 210, y: y + 3, size: 9, font: fontBold, color: WHITE })
  page.drawText('IVA (19%)', { x: RIGHT_X - 135, y: y + 3, size: 9, font: fontBold, color: WHITE })
  page.drawText('Total', { x: RIGHT_X - 70, y: y + 3, size: 9, font: fontBold, color: WHITE })

  y -= 30

  const subtotalStr = data.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const ivaStr = data.iva.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const totalStr = data.total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  page.drawRectangle({ x: MARGIN, y: y, width: width - 100, height: 22, color: GRAY_BG })
  page.drawText(data.concepto, { x: MARGIN + 8, y: y + 5, size: 9, font, color: BLACK_SOFT })
  page.drawText(`$${subtotalStr}`, { x: RIGHT_X - 210, y: y + 5, size: 9, font: mono, color: BLACK_SOFT })
  page.drawText(`$${ivaStr}`, { x: RIGHT_X - 135, y: y + 5, size: 9, font: mono, color: BLACK_SOFT })
  page.drawText(`$${totalStr}`, { x: RIGHT_X - 70, y: y + 5, size: 9, font: fontBold, color: BLACK_SOFT })

  // --- TOTALS ---
  y -= 40
  page.drawLine({ start: { x: RIGHT_X - 200, y }, end: { x: RIGHT_X, y }, thickness: 0.5, color: GRAY_LIGHT })

  y -= 22
  page.drawText('Subtotal', { x: RIGHT_X - 160, y, size: 10, font, color: GRAY_TEXT })
  page.drawText(`$${subtotalStr} COP`, { x: RIGHT_X - 65, y, size: 10, font: fontBold, color: BLACK_SOFT })

  y -= 18
  page.drawText('IVA (19%)', { x: RIGHT_X - 160, y, size: 10, font, color: GRAY_TEXT })
  page.drawText(`$${ivaStr} COP`, { x: RIGHT_X - 65, y, size: 10, font: fontBold, color: BLACK_SOFT })

  y -= 24
  page.drawLine({ start: { x: RIGHT_X - 200, y }, end: { x: RIGHT_X, y }, thickness: 1.5, color: BLUE })

  y -= 20
  page.drawText('TOTAL', { x: RIGHT_X - 160, y, size: 12, font: fontBold, color: BLUE })
  page.drawText(`$${totalStr} COP`, { x: RIGHT_X - 65, y, size: 12, font: fontBold, color: BLUE })

  // --- STATUS BADGE ---
  const badgeY = height - 60
  page.drawRectangle({
    x: RIGHT_X - 100, y: badgeY - 10, width: 50, height: 18,
    color: GREEN,
  })
  page.drawText('PAGADO', { x: RIGHT_X - 94, y: badgeY - 4, size: 7, font: fontBold, color: WHITE })

  // --- FOOTER ---
  y = 95
  page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT_X, y }, thickness: 1, color: GRAY_LIGHT })

  y -= 18
  page.drawText('VenxPOS SaaS — Desarrollado por JGSoftworks', { x: MARGIN, y, size: 7, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('NIT: 1030528858-1 — Juan David Gomez Ruidiaz', { x: MARGIN, y, size: 7, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('KR 39 #13 - 42 — juan.dev1809@gmail.com — Tel: 3228372341', { x: MARGIN, y, size: 7, font, color: GRAY_TEXT })
  y -= 12
  page.drawText('www.venxpos.com', { x: MARGIN, y, size: 7, font, color: BLUE })

  console.log('[invoice-template] Saving PDF...')
  const result = await doc.save()
  console.log('[invoice-template] PDF saved, size:', result.byteLength, 'bytes')
  return result
}
