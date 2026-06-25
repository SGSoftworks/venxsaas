import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBillingStore } from '@/store/useBillingStore'
import { useUIStore } from '@/store/useUIStore'
import { formatCurrency, formatDateShort, classNames } from '@/lib/utils'
import { exportToExcel, FACTURAS_COLUMNS } from '@/lib/export'
import type { FacturaSaas } from '@/types'
import {
  FileText,
  Download,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from 'lucide-react'

const PAGE_SIZE = 10

const estadoFacturaConfig: Record<string, { style: string; label: string }> = {
  emitida: { style: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Emitida' },
  pagada: { style: 'bg-green-100 text-green-800 border-green-200', label: 'Pagada' },
  anulada: { style: 'bg-red-100 text-red-800 border-red-200', label: 'Anulada' },
  reembolsada: { style: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Reembolsada' },
}

const MESES = [
  { value: 0, label: 'Todos los meses' },
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-slate-50">
          <td className="px-5 py-3.5"><div className="h-3.5 w-24 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-32 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-48 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="px-5 py-3.5"><div className="h-8 w-20 bg-slate-100 rounded animate-pulse" /></td>
        </tr>
      ))}
    </>
  )
}

export function InvoicesPage() {
  const { tenant } = useAuthStore()
  const { facturas, facturasLoading, fetchFacturas } = useBillingStore()
  const { addToast } = useUIStore()

  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMes, setSelectedMes] = useState(0)
  const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear())
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (!tenant) return
    const load = async () => {
      try {
        await fetchFacturas(tenant.id)
        setError(null)
      } catch {
        setError('No se pudieron cargar las facturas.')
      }
    }
    load()
  }, [tenant, fetchFacturas])

  const anios = useMemo(() => {
    const year = new Date().getFullYear()
    const years: number[] = []
    for (let y = year + 1; y >= 2023; y--) years.push(y)
    return years
  }, [])

  const filtered = useMemo(() => {
    let result = facturas

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(f => f.numero_factura.toLowerCase().includes(term))
    }

    if (selectedMes > 0) {
      result = result.filter(f => {
        const d = new Date(f.created_at)
        return d.getMonth() + 1 === selectedMes
      })
    }

    if (selectedAnio) {
      result = result.filter(f => {
        const d = new Date(f.created_at)
        return d.getFullYear() === selectedAnio
      })
    }

    return result
  }, [facturas, searchTerm, selectedMes, selectedAnio])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)

  const handleExport = () => {
    if (filtered.length === 0) {
      addToast('info', 'No hay facturas para exportar')
      return
    }
    exportToExcel(filtered as unknown as Record<string, unknown>[], FACTURAS_COLUMNS, 'facturas')
    addToast('success', 'Facturas exportadas exitosamente')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Facturas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} factura{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={facturasLoading || filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            placeholder="Buscar por número..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={selectedMes}
            onChange={e => { setSelectedMes(Number(e.target.value)); setCurrentPage(1) }}
            className="appearance-none pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 cursor-pointer"
          >
            {MESES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <select
            value={selectedAnio}
            onChange={e => { setSelectedAnio(Number(e.target.value)); setCurrentPage(1) }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 cursor-pointer"
          >
            {anios.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {facturasLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <SkeletonRows count={PAGE_SIZE} />
              </tbody>
            </table>
          </div>
        </div>
      ) : error ? (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Error al cargar facturas</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
          <button
            onClick={() => { setError(null); fetchFacturas(tenant?.id) }}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileText className="w-7 h-7 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">No hay facturas</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchTerm || selectedMes > 0
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Las facturas aparecerán aquí cuando realices pagos'}
            </p>
          </div>
          {(searchTerm || selectedMes > 0) && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedMes(0); setSelectedAnio(new Date().getFullYear()) }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((f: FacturaSaas) => (
                    <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {formatDateShort(f.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-medium text-slate-800">
                          {f.numero_factura}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs max-w-[260px] truncate">
                        {f.concepto}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={classNames(
                          'inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border',
                          estadoFacturaConfig[f.estado]?.style ?? 'bg-slate-100 text-slate-600 border-slate-200'
                        )}>
                          {estadoFacturaConfig[f.estado]?.label ?? f.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-mono text-sm font-semibold text-slate-800 tabular-nums">
                          {formatCurrency(f.total)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {f.pdf_url ? (
                          <a
                            href={f.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 cursor-not-allowed">
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Página {safeCurrentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={classNames(
                      'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                      p === safeCurrentPage
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
