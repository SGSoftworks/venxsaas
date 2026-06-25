import * as XLSX from 'xlsx'
import { formatCurrency } from './utils'

interface ExportColumn {
  key: string
  header: string
  format?: 'currency' | 'date' | 'text'
  width?: number
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  if (data.length === 0) return

  const headers = columns.map(c => c.header)

  const rows = data.map(item =>
    columns.map(col => {
      const val = item[col.key]
      if (val == null) return ''
      if (col.format === 'currency') {
        if (typeof val === 'number') return val
        const parsed = parseFloat(String(val))
        return isNaN(parsed) ? val : parsed
      }
      if (col.format === 'date') {
        if (typeof val === 'string') {
          const d = new Date(val)
          return isNaN(d.getTime()) ? val : d
        }
        return val
      }
      return String(val)
    })
  )

  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  const colWidths = columns.map(c => ({ wch: c.width || 20 }))
  ws['!cols'] = colWidths

  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C })
      if (ws[addr]) {
        ws[addr].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          fill: { fgColor: { rgb: '2563EB' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export const FACTURAS_COLUMNS: ExportColumn[] = [
  { key: 'numero_factura', header: 'Número', width: 22 },
  { key: 'concepto', header: 'Concepto', width: 40 },
  { key: 'subtotal', header: 'Subtotal', format: 'currency', width: 15 },
  { key: 'iva', header: 'IVA', format: 'currency', width: 15 },
  { key: 'total', header: 'Total', format: 'currency', width: 15 },
  { key: 'created_at', header: 'Fecha', format: 'date', width: 14 },
]

export const PAYMENTS_COLUMNS: ExportColumn[] = [
  { key: 'wompi_transaction_id', header: 'ID Transacción', width: 30 },
  { key: 'tenant_nombre', header: 'Cliente', width: 25 },
  { key: 'amount', header: 'Monto', format: 'currency', width: 15 },
  { key: 'payment_method_type', header: 'Método', width: 15 },
  { key: 'status', header: 'Estado', width: 12 },
  { key: 'tipo', header: 'Tipo', width: 14 },
  { key: 'created_at', header: 'Fecha', format: 'date', width: 14 },
]

export const CLIENTS_COLUMNS: ExportColumn[] = [
  { key: 'nombre_negocio', header: 'Negocio', width: 25 },
  { key: 'nit', header: 'NIT', width: 18 },
  { key: 'email_propietario', header: 'Email', width: 30 },
  { key: 'telefono', header: 'Teléfono', width: 15 },
  { key: 'plan_nombre', header: 'Plan', width: 15 },
  { key: 'estado', header: 'Estado', width: 12 },
  { key: 'created_at', header: 'Registro', format: 'date', width: 14 },
]

export const BRANCHES_COLUMNS: ExportColumn[] = [
  { key: 'nombre_sucursal', header: 'Sucursal', width: 25 },
  { key: 'email', header: 'Email', width: 30 },
  { key: 'activo', header: 'Estado', width: 12 },
  { key: 'created_at', header: 'Creada', format: 'date', width: 14 },
]
