import { PDFDocument, StandardFonts, rgb, PageSizes, type PDFFont, type PDFPage, type PDFImage } from 'npm:pdf-lib@1.17.1'
import { getPlanConfigByName } from './plans.ts'

interface InvoiceData {
  numero: string
  concepto: string
  subtotal: number
  iva: number
  total: number
  moneda: string
  created_at: string
  wompi_transaction_id: string | null
  wompi_reference: string | null
  metodo_pago: string
  tenant_nombre: string
  tenant_nit: string
  tenant_email: string
  tenant_telefono: string | null
  plan_nombre: string
  cliente_id: string
  estado: string
  old_plan_nombre: string | null
  sucursales_count: number
  tipo: 'activacion' | 'renovacion' | 'cambio_plan' | 'otro'
  proximo_pago?: string | null
  fecha_inicio_periodo?: string | null
  fecha_fin_periodo?: string | null
}

const LOGO_URL = 'https://beacnoxukkoellhecofm.supabase.co/storage/v1/object/public/branding/logo-saas.png'

const C = {
  brandDark: rgb(0.059, 0.09, 0.165),
  brand: rgb(0.427, 0.235, 0.961),
  green: rgb(0.063, 0.725, 0.506),
  grayText: rgb(0.45, 0.51, 0.58),
  grayLight: rgb(0.89, 0.91, 0.94),
  grayBg: rgb(0.965, 0.97, 0.985),
  white: rgb(1, 1, 1),
  dark: rgb(0.059, 0.09, 0.165),
}

const MARGIN = 50
const PAGE_W = PageSizes.A4[0]
const PAGE_H = PageSizes.A4[1]
const CONTENT_W = PAGE_W - MARGIN * 2
const RX = PAGE_W - MARGIN
const CX = MARGIN + CONTENT_W / 2
const FOOTER_Y = 60
const TOP_Y = PAGE_H - MARGIN
const SEP_GAP = 18
const TXT_H = 12
const TXT_S = 9
const SML_S = 8

function formatCurrency(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO') + ' COP'
}

function formatInvoiceDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

function nowColombiaDate(): string {
  return new Date().toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function tw(text: string, font: PDFFont, size: number): number {
  return font.widthOfTextAtSize(text, size)
}

type Ctx = {
  doc: PDFDocument
  font: PDFFont
  bold: PDFFont
  mono: PDFFont
  pages: PDFPage[]
  idx: number
  y: number
  logo: PDFImage | null
}

function pg(ctx: Ctx): PDFPage { return ctx.pages[ctx.idx] }

function addPg(ctx: Ctx) {
  const p = ctx.doc.addPage(PageSizes.A4)
  ctx.pages.push(p)
  ctx.idx = ctx.pages.length - 1
  ctx.y = TOP_Y
  pg(ctx).drawRectangle({ x: 0, y: PAGE_H - 3, width: PAGE_W, height: 3, color: C.brand })
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < FOOTER_Y) addPg(ctx)
}

function finalize(ctx: Ctx) {
  ctx.pages.forEach((p, i) => {
    p.drawText(`Página ${i + 1} de ${ctx.pages.length}`, {
      x: CX - tw(`Página ${i + 1} de ${ctx.pages.length}`, ctx.font, 7) / 2,
      y: 24, size: 7, font: ctx.font, color: C.grayText,
    })
  })
}

function sepLine(ctx: Ctx) {
  pg(ctx).drawRectangle({ x: MARGIN, y: ctx.y - 2, width: CONTENT_W, height: 1, color: C.grayLight })
  ctx.y -= SEP_GAP
}

function drawBrandBar(ctx: Ctx) {
  pg(ctx).drawRectangle({ x: 0, y: PAGE_H - 3, width: PAGE_W, height: 3, color: C.brand })
}

function sectionTitle(ctx: Ctx, title: string, y: number): number {
  const p = pg(ctx)
  p.drawText(title.toUpperCase(), { x: MARGIN, y: y - 2, size: TXT_S, font: ctx.bold, color: C.brandDark })
  p.drawRectangle({ x: MARGIN, y: y - 14, width: 28, height: 2, color: C.brand })
  return y - 16
}

function calcLines(text: string, maxW: number, font: PDFFont, size: number): number {
  const words = text.split(' ')
  let n = 1, cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (tw(t, font, size) > maxW && cur) { n++; cur = w }
    else cur = t
  }
  return n
}

function wrapText(p: PDFPage, text: string, x: number, y: number, maxW: number, font: PDFFont, size: number, color: typeof C.dark, lh: number): number {
  const words = text.split(' ')
  let line = '', curY = y
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (tw(t, font, size) > maxW && line) {
      p.drawText(line, { x, y: curY, size, font, color })
      curY -= lh; line = w
    } else { line = t }
  }
  if (line) { p.drawText(line, { x, y: curY, size, font, color }); curY -= lh }
  return curY
}

// ═══════════════════════════════════════════════
//  1. HEADER
// ═══════════════════════════════════════════════
async function drawHeader(ctx: Ctx, data: InvoiceData) {
  const startY = ctx.y
  let y = startY

  if (ctx.logo) {
    const a = ctx.logo.width / ctx.logo.height
    const logoH = 32
    const logoW = Math.min(logoH * a, 120)
    pg(ctx).drawImage(ctx.logo, { x: MARGIN, y: y - logoH, width: logoW, height: logoH })
  } else {
    pg(ctx).drawText('VenxPOS', { x: MARGIN, y: y - 8, size: 22, font: ctx.bold, color: C.brandDark })
  }

  const info = [
    { t: 'jgsoftworks-site.netlify.app', f: ctx.font, s: 9, c: C.grayText },
    { t: 'NIT 1030528858-1', f: ctx.font, s: SML_S, c: C.grayText },
    { t: 'juan.dev1809@gmail.com', f: ctx.font, s: SML_S, c: C.grayText },
    { t: '3228372341', f: ctx.font, s: SML_S, c: C.grayText },
    { t: 'www.venxpos.com', f: ctx.font, s: SML_S, c: C.brand },
  ]
  let ry = y
  info.forEach(l => {
    pg(ctx).drawText(l.t, { x: RX - tw(l.t, l.f, l.s), y: ry - 2, size: l.s, font: l.f, color: l.c })
    ry -= l.s + 4
  })

  const topH = Math.max(40, y - ry + 4)
  y = startY - topH - 8

  pg(ctx).drawRectangle({ x: MARGIN, y: y - 2, width: CONTENT_W, height: 1, color: C.grayLight })
  y -= 16

  const label = { activacion: 'FACTURA DE ACTIVACIÓN', renovacion: 'FACTURA DE RENOVACIÓN', cambio_plan: 'FACTURA DE CAMBIO DE PLAN', otro: 'FACTURA' }[data.tipo] || 'FACTURA'

  pg(ctx).drawText(label, { x: MARGIN, y: y - 2, size: 14, font: ctx.bold, color: C.brandDark })

  const badge = 'PAGADA'
  const bw = tw(badge, ctx.bold, SML_S) + 20
  pg(ctx).drawRectangle({ x: RX - bw, y: y - 7, width: bw, height: 18, color: C.green })
  pg(ctx).drawText(badge, { x: RX - bw + 10, y: y + 3, size: SML_S, font: ctx.bold, color: C.white })

  y -= 22
  pg(ctx).drawText(`No. ${data.numero}`, { x: MARGIN, y: y - 2, size: TXT_S, font: ctx.mono, color: C.brandDark })
  y -= 16
  pg(ctx).drawText(nowColombiaDate(), { x: MARGIN, y: y - 2, size: SML_S, font: ctx.font, color: C.grayText })
  y -= 6

  ctx.y = y
}

// ═══════════════════════════════════════════════
//  2. CLIENT DATA
// ═══════════════════════════════════════════════
function drawClientSection(ctx: Ctx, data: InvoiceData) {
  const left = [
    `Negocio: ${data.tenant_nombre}`,
    `Cliente ID: ${data.cliente_id}`,
    `NIT: ${data.tenant_nit}`,
    `Email: ${data.tenant_email}`,
  ]
  const right = [
    `Teléfono: ${data.tenant_telefono || ''}`,
    `Plan actual: ${data.plan_nombre}`,
    `Sucursales: ${data.sucursales_count}`,
    `Estado: ${data.estado}`,
  ].filter(l => !l.endsWith(': ') && !l.endsWith(':'))

  const rows = Math.max(left.length, right.length)
  const contentH = rows * TXT_H + 4
  const headH = 18
  const totalH = headH + contentH

  ensure(ctx, totalH)
  const startY = ctx.y
  const cy = sectionTitle(ctx, 'DATOS DEL CLIENTE', startY)

  const midX = MARGIN + CONTENT_W * 0.45
  let ly = cy
  left.forEach(l => {
    pg(ctx).drawText(l, { x: MARGIN, y: ly - 2, size: TXT_S, font: l.startsWith('Cliente ID:') || l.startsWith('NIT:') ? ctx.mono : ctx.font, color: C.dark })
    ly -= TXT_H
  })
  let ry = cy
  right.forEach(l => {
    pg(ctx).drawText(l, { x: midX, y: ry - 2, size: TXT_S, font: ctx.font, color: C.dark })
    ry -= TXT_H
  })

  ctx.y = startY - totalH
}

// ═══════════════════════════════════════════════
//  3. PAYMENT DATA
// ═══════════════════════════════════════════════
function drawPaymentSection(ctx: Ctx, data: InvoiceData) {
  const left = [
    data.metodo_pago ? `Método: ${data.metodo_pago}` : null,
    data.wompi_reference ? `Referencia: ${data.wompi_reference}` : null,
  ].filter(Boolean) as string[]

  const right = [
    data.wompi_transaction_id ? `ID Transacción: ${data.wompi_transaction_id}` : null,
  ].filter(Boolean) as string[]
  right.push(`Fecha de pago: ${formatInvoiceDate(data.created_at)}`)

  if (!left.length && right.length <= 1) {
    ctx.y -= 8; return
  }

  const rows = Math.max(left.length, right.length)
  const contentH = rows * TXT_H + 4
  const headH = 18
  const totalH = headH + contentH

  ensure(ctx, totalH)
  const startY = ctx.y
  const cy = sectionTitle(ctx, 'DATOS DEL PAGO', startY)

  const midX = MARGIN + CONTENT_W * 0.45
  let ly = cy
  left.forEach(l => {
    pg(ctx).drawText(l, { x: MARGIN, y: ly - 2, size: TXT_S, font: l.startsWith('Referencia:') ? ctx.mono : ctx.font, color: C.dark })
    ly -= TXT_H
  })
  let ry = cy
  right.forEach(l => {
    pg(ctx).drawText(l, { x: midX, y: ry - 2, size: TXT_S, font: l.startsWith('ID Transacción:') ? ctx.mono : ctx.font, color: C.dark })
    ry -= TXT_H
  })

  ctx.y = startY - totalH
}

// ═══════════════════════════════════════════════
//  4a. IMPLEMENTATION DETAIL (activacion)
// ═══════════════════════════════════════════════
function drawImplementationBlock(ctx: Ctx) {
  const items = [
    'Activación del sistema',
    'Configuración inicial de la empresa',
    'Configuración de sucursal principal',
    'Registro inicial del inventario',
    'Creación de usuarios administrativos',
    'Parametrización del sistema',
    'Configuración tributaria',
    'Capacitación del personal',
    'Primera mensualidad incluida',
  ]

  const rh = 11
  const contentH = items.length * rh + 6
  const headH = 18
  const totalH = headH + contentH

  ensure(ctx, totalH)
  const startY = ctx.y
  const cy = sectionTitle(ctx, 'DETALLE DE IMPLEMENTACIÓN', startY)
  let y = cy

  items.forEach((item, i) => {
    if (i % 2 === 1) pg(ctx).drawRectangle({ x: MARGIN, y: y - rh + 1, width: CONTENT_W, height: rh - 1, color: C.grayBg })
    pg(ctx).drawText('•', { x: MARGIN, y: y - rh + 3, size: SML_S, font: ctx.bold, color: C.brand })
    pg(ctx).drawText(item, { x: MARGIN + 14, y: y - rh + 3, size: SML_S, font: ctx.font, color: C.dark })
    y -= rh
  })

  ctx.y = startY - totalH
}

// ═══════════════════════════════════════════════
//  4b. RENOVATION PERIOD (renovacion)
// ═══════════════════════════════════════════════
function drawRenovationBlock(ctx: Ctx, data: InvoiceData) {
  const lines = [
    data.fecha_inicio_periodo ? `Desde: ${formatInvoiceDate(data.fecha_inicio_periodo)}` : null,
    data.fecha_fin_periodo ? `Hasta: ${formatInvoiceDate(data.fecha_fin_periodo)}` : null,
    'Duración: 1 mes',
  ].filter(Boolean) as string[]

  const rows = lines.length
  const contentH = rows * TXT_H + 4
  const headH = 18
  const totalH = headH + contentH

  ensure(ctx, totalH)
  const startY = ctx.y
  const cy = sectionTitle(ctx, 'PERÍODO FACTURADO', startY)
  let y = cy
  lines.forEach(l => { pg(ctx).drawText(l, { x: MARGIN, y: y - 2, size: TXT_S, font: ctx.font, color: C.dark }); y -= TXT_H })
  ctx.y = startY - totalH
}

// ═══════════════════════════════════════════════
//  4c. PLAN CHANGE (cambio_plan)
// ═══════════════════════════════════════════════
function drawPlanChangeBlock(ctx: Ctx, data: InvoiceData) {
  const oldPlan = data.old_plan_nombre || '(no disponible)'
  const lines = [
    `Plan anterior: ${oldPlan}`,
    `Plan nuevo: ${data.plan_nombre}`,
    `Fecha efectiva: ${formatInvoiceDate(data.created_at)}`,
  ]

  const rows = lines.length
  const contentH = rows * TXT_H + 4
  const headH = 18
  const totalH = headH + contentH

  ensure(ctx, totalH)
  const startY = ctx.y
  const cy = sectionTitle(ctx, 'DETALLE DEL CAMBIO', startY)
  let y = cy
  lines.forEach(l => { pg(ctx).drawText(l, { x: MARGIN, y: y - 2, size: TXT_S, font: ctx.font, color: C.dark }); y -= TXT_H })
  ctx.y = startY - totalH
}

// ═══════════════════════════════════════════════
//  5. PERIOD SECTION
// ═══════════════════════════════════════════════
function drawPeriodSection(ctx: Ctx, data: InvoiceData) {
  let lines: string[] = []

  if (data.tipo === 'cambio_plan') {
    lines.push(`Cambio efectivo: ${formatInvoiceDate(data.created_at)}`)
    if (data.proximo_pago) lines.push(`Próxima renovación: ${formatInvoiceDate(data.proximo_pago)}`)
  } else {
    if (data.fecha_inicio_periodo) lines.push(`Fecha inicio: ${formatInvoiceDate(data.fecha_inicio_periodo)}`)
    if (data.fecha_fin_periodo) lines.push(`Fecha fin: ${formatInvoiceDate(data.fecha_fin_periodo)}`)
    if (data.proximo_pago) lines.push(`Próxima renovación: ${formatInvoiceDate(data.proximo_pago)}`)
  }

  if (!lines.length) return

  const contentH = lines.length * TXT_H + 4
  const headH = 18
  const totalH = headH + contentH

  ensure(ctx, totalH)
  const startY = ctx.y
  const cy = sectionTitle(ctx, 'PERÍODO DE FACTURACIÓN', startY)
  let y = cy
  lines.forEach(l => { pg(ctx).drawText(l, { x: MARGIN, y: y - 2, size: TXT_S, font: ctx.font, color: C.dark }); y -= TXT_H })
  ctx.y = startY - totalH
}

// ═══════════════════════════════════════════════
//  6. ITEMS TABLE
// ═══════════════════════════════════════════════
function drawItemsTable(ctx: Ctx, data: InvoiceData) {
  const conceptoW = 150
  const colR = { cantidad: 265, valorUnitario: 363, iva: 446, total: 534 }
  const conceptoL = 60

  let rows: { label: string; cant: string; vu: string; iva: string; tot: string }[] = []

  if (data.tipo === 'activacion') {
    const cfg = getPlanConfigByName(data.plan_nombre)
    if (cfg) {
      const items = [
        { label: 'Activación y configuración VenxPOS', val: cfg.desglose_activacion.activacion_venxpos },
        { label: 'Configuración inicial de inventario', val: cfg.desglose_activacion.configuracion_inventario },
        { label: 'Primera mensualidad', val: cfg.desglose_activacion.primera_mensualidad },
      ]
      rows = items.map(item => {
        const v = item.val
        const s = Math.round(v / 1.19)
        return { label: item.label, cant: '1', vu: formatCurrency(s), iva: formatCurrency(v - s), tot: formatCurrency(v) }
      })
    } else {
      rows = [{ label: data.concepto, cant: '1', vu: formatCurrency(data.subtotal), iva: formatCurrency(data.iva), tot: formatCurrency(data.total) }]
    }
  } else {
    rows = [{ label: data.concepto, cant: '1', vu: formatCurrency(data.subtotal), iva: formatCurrency(data.iva), tot: formatCurrency(data.total) }]
  }

  const headH = 22
  const baseRH = 16
  const lh = 10

  let totalH = headH
  const rH: number[] = []
  rows.forEach(r => {
    const n = calcLines(r.label, conceptoW, ctx.font, SML_S)
    const h = baseRH + (n - 1) * lh
    rH.push(h)
    totalH += h
  })

  ensure(ctx, totalH + 8)
  let y = ctx.y
  const p = pg(ctx)

  p.drawRectangle({ x: MARGIN, y: y - headH, width: CONTENT_W, height: headH, color: C.brandDark })
  p.drawText('Concepto', { x: conceptoL, y: y - headH + 7, size: SML_S, font: ctx.bold, color: C.white })
  ;[{ t: 'Cant.', r: colR.cantidad }, { t: 'Valor Unitario', r: colR.valorUnitario }, { t: 'IVA', r: colR.iva }, { t: 'Total', r: colR.total }].forEach(c => {
    p.drawText(c.t, { x: c.r - tw(c.t, ctx.bold, SML_S), y: y - headH + 7, size: SML_S, font: ctx.bold, color: C.white })
  })
  y -= headH

  rows.forEach((row, i) => {
    const rh = rH[i]
    const bg = i % 2 === 0 ? C.white : C.grayBg
    p.drawRectangle({ x: MARGIN, y: y - rh, width: CONTENT_W, height: rh, color: bg })
    wrapText(p, row.label, conceptoL, y - 7, conceptoW, ctx.font, SML_S, C.dark, lh)
    p.drawText(row.cant, { x: colR.cantidad - tw(row.cant, ctx.mono, TXT_S), y: y - 7, size: TXT_S, font: ctx.mono, color: C.dark })
    p.drawText(row.vu, { x: colR.valorUnitario - tw(row.vu, ctx.mono, TXT_S), y: y - 7, size: TXT_S, font: ctx.mono, color: C.dark })
    p.drawText(row.iva, { x: colR.iva - tw(row.iva, ctx.mono, TXT_S), y: y - 7, size: TXT_S, font: ctx.mono, color: C.dark })
    p.drawText(row.tot, { x: colR.total - tw(row.tot, ctx.bold, TXT_S), y: y - 7, size: TXT_S, font: ctx.bold, color: C.dark })
    y -= rh
  })

  ctx.y = y - SEP_GAP
}

// ═══════════════════════════════════════════════
//  7. FINANCIAL SUMMARY
// ═══════════════════════════════════════════════
function drawFinancialSummary(ctx: Ctx, data: InvoiceData) {
  const sub = formatCurrency(data.subtotal)
  const iva = formatCurrency(data.iva)
  const tot = formatCurrency(data.total)

  const rh = 14
  const totalH = rh * 2 + 28

  ensure(ctx, totalH + 8)
  let y = ctx.y

  const labelX = MARGIN
  const valX = RX

  pg(ctx).drawRectangle({ x: MARGIN, y: y - totalH, width: CONTENT_W, height: totalH, color: C.grayBg })
  pg(ctx).drawRectangle({ x: MARGIN, y: y - totalH, width: CONTENT_W, height: 1, color: C.grayLight })
  pg(ctx).drawRectangle({ x: MARGIN, y: y - 1, width: CONTENT_W, height: 1, color: C.grayLight })

  y -= 12

  pg(ctx).drawText('Subtotal', { x: labelX, y: y - 2, size: TXT_S, font: ctx.font, color: C.grayText })
  pg(ctx).drawText(sub, { x: valX - tw(sub, ctx.font, TXT_S), y: y - 2, size: TXT_S, font: ctx.font, color: C.dark })
  y -= rh

  pg(ctx).drawText('IVA (19%)', { x: labelX, y: y - 2, size: TXT_S, font: ctx.font, color: C.grayText })
  pg(ctx).drawText(iva, { x: valX - tw(iva, ctx.font, TXT_S), y: y - 2, size: TXT_S, font: ctx.font, color: C.dark })
  y -= rh

  pg(ctx).drawRectangle({ x: MARGIN, y: y + 4, width: CONTENT_W, height: 1, color: C.brand })
  y -= 6

  pg(ctx).drawText('TOTAL', { x: labelX, y: y - 2, size: 14, font: ctx.bold, color: C.brand })
  pg(ctx).drawText(tot, { x: valX - tw(tot, ctx.bold, 14), y: y - 2, size: 14, font: ctx.bold, color: C.brand })

  ctx.y = ctx.y - totalH - SEP_GAP
}

// ═══════════════════════════════════════════════
//  8. FOOTER
// ═══════════════════════════════════════════════
function drawFooter(ctx: Ctx) {
  const lines = [
    { t: 'Factura generada automáticamente por VenxPOS', f: ctx.font, c: C.grayText },
    { t: 'jgsoftworks-site.netlify.app', f: ctx.font, c: C.grayText },
    { t: 'www.venxpos.com', f: ctx.font, c: C.brand },
    { t: 'No requiere firma física', f: ctx.font, c: C.grayText },
    { t: 'Gracias por confiar en VenxPOS', f: ctx.font, c: C.grayText },
  ]

  const lh = 10
  const totalH = lines.length * lh + 12

  ensure(ctx, totalH + 8)
  let y = ctx.y - 6

  pg(ctx).drawRectangle({ x: MARGIN, y: y + 2, width: CONTENT_W, height: 1, color: C.grayLight })
  y -= 14

  lines.forEach(l => {
    pg(ctx).drawText(l.t, { x: CX - tw(l.t, l.f, 7) / 2, y: y - 2, size: 7, font: l.f, color: l.c })
    y -= lh
  })

  ctx.y = y - 6
}

// ═══════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════
export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)

  let logo: PDFImage | null = null
  try {
    const res = await fetch(LOGO_URL, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const bytes = await res.arrayBuffer()
      logo = await doc.embedPng(new Uint8Array(bytes))
    }
  } catch { /* no logo */ }

  const p = doc.addPage(PageSizes.A4)
  const ctx: Ctx = { doc, font, bold, mono, pages: [p], idx: 0, y: TOP_Y, logo }

  drawBrandBar(ctx)
  await drawHeader(ctx, data)
  sepLine(ctx)

  drawClientSection(ctx, data)
  sepLine(ctx)

  drawPaymentSection(ctx, data)
  sepLine(ctx)

  if (data.tipo === 'activacion') drawImplementationBlock(ctx)
  else if (data.tipo === 'renovacion') drawRenovationBlock(ctx, data)
  else if (data.tipo === 'cambio_plan') drawPlanChangeBlock(ctx, data)
  sepLine(ctx)

  drawPeriodSection(ctx, data)
  sepLine(ctx)

  drawItemsTable(ctx, data)
  drawFinancialSummary(ctx, data)
  drawFooter(ctx)

  finalize(ctx)
  return await doc.save()
}
