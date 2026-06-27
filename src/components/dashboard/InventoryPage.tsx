import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { supabase } from '@/lib/supabase/client'
import { AppModal } from '@/components/ui/AppModal'
import { exportToExcel } from '@/lib/export'
import { classNames } from '@/lib/utils'
import {
  Search,
  Plus,
  Download,
  Loader2,
  AlertCircle,
  Package,
  Store,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  PenLine,
  Power,
  PowerOff,
  Building2,
  Upload,
  FileText,
} from 'lucide-react'

type ProductRow = {
  id: string
  codigo_barras: string
  descripcion: string
  precio_venta: number
  costo: number
  stock_actual: number
  stock_minimo: number
  activo: boolean
  categoria_nombre: string | null
  categoria_id: string | null
  sucursal_nombre: string | null
  sucursal_id: string | null
  tarifa_iva: number
  tarifa_impoconsumo: number
}

type FilterMode = 'todos' | 'stock_bajo' | 'inactivos'

type BranchOption = {
  sucursal_id: string
  nombre_sucursal: string
}

type CategoriaOption = {
  id: string
  nombre: string
  sucursal_id: string | null
  sucursal_nombre: string | null
}

const PAGE_SIZE = 20

const INVENTORY_COLUMNS = [
  { key: 'codigo_barras', header: 'Código', width: 22 },
  { key: 'descripcion', header: 'Descripción', width: 40 },
  { key: 'stock_actual', header: 'Stock', width: 10 },
  { key: 'precio_venta', header: 'Precio', format: 'currency' as const, width: 15 },
  { key: 'costo', header: 'Costo', format: 'currency' as const, width: 15 },
  { key: 'sucursal_nombre', header: 'Sucursal', width: 22 },
  { key: 'activo', header: 'Activo', width: 10 },
]

function StockAdjustmentModal({
  open,
  onClose,
  tenantId,
  productId,
  productName,
  currentStock,
  sucursalId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  tenantId: string
  productId: string
  productName: string
  currentStock: number
  sucursalId: string | null
  onSuccess: () => void
}) {
  const [tipo, setTipo] = useState<'entrada' | 'salida' | 'ajuste'>('ajuste')
  const [cantidad, setCantidad] = useState('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)



  const aplicar = async () => {
    const qty = parseFloat(cantidad)
    if (isNaN(qty) || qty <= 0) {
      setError('Cantidad inválida')
      return
    }
    if (!sucursalId) {
      setError('No se pudo determinar la sucursal del producto')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('adjust_tenant_product_stock', {
        p_tenant_id: tenantId,
        p_producto_id: productId,
        p_tipo: tipo,
        p_cantidad: qty,
        p_observacion: observacion || `${tipo} manual`,
      })

      if (rpcError) throw rpcError

      onSuccess()
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Error al procesar ajuste')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <AppModal open={open} onClose={onClose} title="Ajustar stock" size="default">
      <div className="p-5 space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{productName}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Stock actual: <span className="font-semibold text-slate-700">{currentStock}</span>
          </p>
        </div>

        <div className="flex gap-2">
          {(['entrada', 'salida', 'ajuste'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={classNames(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
                tipo === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {t === 'entrada' ? 'Entrada (+)' : t === 'salida' ? 'Salida (-)' : 'Ajuste'}
            </button>
          ))}
        </div>

        {tipo === 'ajuste' ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Nuevo stock
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Cantidad final deseada"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Cantidad
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Cantidad a mover"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Observación
          </label>
          <input
            type="text"
            placeholder="Opcional"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={aplicar}
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Procesando...' : 'Aplicar ajuste'}
        </button>
      </div>
    </AppModal>
  )
}

function DeleteProductModal({
  open,
  onClose,
  onConfirm,
  loading,
  productName,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  loading: boolean
  productName: string
}) {
  return (
    <AppModal open={open} onClose={onClose} title="Eliminar producto" size="default">
      <div className="px-5 py-4">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-3">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800 mb-1">{productName}</p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Esta acción eliminará permanentemente el producto y su registro de inventario. No podrá recuperarse.
        </p>
      </div>
      <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2.5">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          disabled={loading}
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Eliminando...' : 'Si, eliminar'}
        </button>
      </div>
    </AppModal>
  )
}

function CreateProductModal({
  open,
  onClose,
  onCreate,
  loading,
  branches,
  categories,
  defaultBranchId,
}: {
  open: boolean
  onClose: () => void
  onCreate: (form: {
    codigo_barras: string
    descripcion: string
    precio_venta: string
    costo: string
    stock_inicial: string
    stock_minimo: string
    categoria_id: string
    sucursal_id: string
    tarifa_iva: string
    tarifa_impoconsumo: string
  }) => Promise<void>
  loading: boolean
  branches: BranchOption[]
  categories: CategoriaOption[]
  defaultBranchId: string
}) {
  const [codigoBarras, setCodigoBarras] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [costo, setCosto] = useState('')
  const [stockInicial, setStockInicial] = useState('')
  const [stockMinimo, setStockMinimo] = useState('10')
  const [categoriaId, setCategoriaId] = useState('')
  const [sucursalId, setSucursalId] = useState(defaultBranchId || '')
  const [tarifaIva, setTarifaIva] = useState('0.19')
  const [tarifaImpoconsumo, setTarifaImpoconsumo] = useState('0')
  const [error, setError] = useState('')



  const handleSubmit = async () => {
    if (!codigoBarras.trim() || !descripcion.trim() || !precioVenta) {
      setError('Código, descripción y precio son obligatorios')
      return
    }
    const precio = parseFloat(precioVenta)
    if (isNaN(precio) || precio <= 0) {
      setError('El precio debe ser mayor a 0')
      return
    }
    if (!sucursalId) {
      setError('Selecciona una sucursal')
      return
    }

    await onCreate({
      codigo_barras: codigoBarras.trim(),
      descripcion: descripcion.trim(),
      precio_venta: precioVenta,
      costo: costo || '0',
      stock_inicial: stockInicial,
      stock_minimo: stockMinimo || '10',
      categoria_id: categoriaId,
      sucursal_id: sucursalId,
      tarifa_iva: tarifaIva,
      tarifa_impoconsumo: tarifaImpoconsumo,
    })
  }

  if (!open) return null

  const filteredCategories = sucursalId
    ? categories.filter((c) => !c.sucursal_id || c.sucursal_id === sucursalId)
    : categories

  return (
    <AppModal open={open} onClose={onClose} title="Nuevo producto" size="default">
      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Código de barras *
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Ej: 7701234567890"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Descripción *
            </label>
            <input
              type="text"
              placeholder="Nombre del producto"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Precio venta *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="$ 0.00"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Costo
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="$ 0.00"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Stock inicial
            </label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="0"
              value={stockInicial}
              onChange={(e) => setStockInicial(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Stock mínimo
            </label>
            <input
              type="number"
              step="1"
              min="1"
              placeholder="10"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              IVA
            </label>
            <select
              value={tarifaIva}
              onChange={(e) => setTarifaIva(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700"
            >
              <option value="0.19">19%</option>
              <option value="0.05">5%</option>
              <option value="0">Exento</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Impoconsumo
            </label>
            <select
              value={tarifaImpoconsumo}
              onChange={(e) => setTarifaImpoconsumo(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700"
            >
              <option value="0">Ninguno</option>
              <option value="0.08">8%</option>
              <option value="0.16">16%</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Categoría
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700"
            >
              <option value="">Sin categoría</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.sucursal_nombre ? ` (${c.sucursal_nombre})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Sucursal *
            </label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700"
            >
              <option value="">Seleccionar...</option>
              {branches.map((b) => (
                <option key={b.sucursal_id} value={b.sucursal_id}>
                  {b.nombre_sucursal}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creando...' : 'Crear producto'}
          </button>
        </div>
      </div>
    </AppModal>
  )
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-slate-50">
          <td className="px-5 py-3.5"><div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-40 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-12 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-6 w-14 bg-slate-100 rounded animate-pulse" /></td>
          <td className="px-5 py-3.5"><div className="h-8 w-32 bg-slate-100 rounded animate-pulse ml-auto" /></td>
        </tr>
      ))}
    </>
  )
}

export function InventoryPage() {
  const { tenant } = useAuthStore()
  const { addToast } = useUIStore()

  const [products, setProducts] = useState<ProductRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [categories, setCategories] = useState<CategoriaOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('todos')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [showCreate, setShowCreate] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    codigo_barras: '',
    descripcion: '',
    precio_venta: '',
    costo: '',
    stock_minimo: '',
    categoria_id: '',
    tarifa_iva: '0.19',
    tarifa_impoconsumo: '0',
  })

  const [adjustTarget, setAdjustTarget] = useState<{
    id: string
    name: string
    stock: number
    sucursalId: string | null
  } | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!tenant) return
    const init = async () => {
      const { data: branchData } = await supabase
        .from('branch_accounts')
        .select('sucursal_id, nombre_sucursal')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
      if (branchData) {
        setBranches((branchData as BranchOption[]).filter((b) => b.sucursal_id))
      }
      try {
        const { data: catData, error: rpcError } = await supabase.rpc('get_tenant_categories', {
          p_tenant_id: tenant.id,
        })
        if (!rpcError && catData) {
          setCategories(catData as CategoriaOption[])
        }
      } catch {
        // Non-blocking
      }
    }
    init()
  }, [tenant])

  useEffect(() => {
    if (!tenant) return
    let cancelled = false
    const fetchProducts = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: Record<string, unknown> = { p_tenant_id: tenant.id }
        if (selectedBranch) {
          params.p_sucursal_id = selectedBranch
        }

        const { data, error: rpcError } = await supabase.rpc('get_tenant_products', params)

        if (rpcError) throw rpcError

        const rows: ProductRow[] = (Array.isArray(data) ? data : []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          codigo_barras: (p.codigo_barras as string) || '',
          descripcion: (p.descripcion as string) || '',
          precio_venta: (p.precio_venta as number) || 0,
          costo: (p.costo as number) || 0,
          stock_actual: (p.stock_actual as number) ?? 0,
          stock_minimo: (p.stock_minimo as number) ?? 10,
          activo: Boolean(p.activo ?? true),
          categoria_nombre: (p.categoria_nombre as string) || null,
          categoria_id: (p.categoria_id as string) || null,
          sucursal_nombre: (p.sucursal_nombre as string) || null,
          sucursal_id: (p.sucursal_id as string) || null,
          tarifa_iva: (p.tarifa_iva as number) ?? 0.19,
          tarifa_impoconsumo: (p.tarifa_impoconsumo as number) ?? 0,
        }))

        if (!cancelled) setProducts(rows)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudieron cargar los productos.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProducts()
    return () => { cancelled = true }
  }, [tenant, selectedBranch, refreshKey])

  const filtered = useMemo(() => {
    let result = [...products]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.descripcion.toLowerCase().includes(q) ||
          p.codigo_barras.toLowerCase().includes(q)
      )
    }

    if (filter === 'stock_bajo') {
      result = result.filter((p) => p.stock_actual >= 0 && p.stock_actual <= p.stock_minimo)
    } else if (filter === 'inactivos') {
      result = result.filter((p) => !p.activo)
    }

    return result
  }, [products, search, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)

  const handleCreateProduct = async (form: {
    codigo_barras: string
    descripcion: string
    precio_venta: string
    costo: string
    stock_inicial: string
    stock_minimo: string
    categoria_id: string
    sucursal_id: string
    tarifa_iva: string
    tarifa_impoconsumo: string
  }) => {
    if (!tenant) return
    setCreateLoading(true)
    try {
      const { error: rpcError } = await supabase.rpc('create_tenant_product', {
        p_tenant_id: tenant.id,
        p_sucursal_id: form.sucursal_id,
        p_codigo_barras: form.codigo_barras,
        p_descripcion: form.descripcion,
        p_precio_venta: parseFloat(form.precio_venta),
        p_costo: parseFloat(form.costo || '0'),
        p_stock_inicial: parseInt(form.stock_inicial || '0'),
        p_stock_minimo: parseInt(form.stock_minimo || '10'),
        p_categoria_id: form.categoria_id || null,
        p_tarifa_iva: parseFloat(form.tarifa_iva),
        p_tarifa_impoconsumo: parseFloat(form.tarifa_impoconsumo || '0'),
      })

      if (rpcError) throw rpcError

      setShowCreate(false)
      addToast('success', 'Producto creado exitosamente')
      setRefreshKey(k => k + 1)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('duplicate') || msg.includes('409') || msg.includes('23505')) {
        addToast('error', 'El código de barras ya existe en esta sucursal')
      } else {
        addToast('error', 'No se pudo crear el producto')
      }
    } finally {
      setCreateLoading(false)
    }
  }

  const startEdit = (p: ProductRow) => {
    setEditingId(p.id)
    setEditForm({
      codigo_barras: p.codigo_barras,
      descripcion: p.descripcion,
      precio_venta: String(p.precio_venta),
      costo: String(p.costo),
      stock_minimo: String(p.stock_minimo),
      categoria_id: p.categoria_id || '',
      tarifa_iva: String(p.tarifa_iva),
      tarifa_impoconsumo: String(p.tarifa_impoconsumo),
    })
  }

  const saveEdit = async () => {
    if (!tenant || !editingId) return
    try {
      const { error: rpcError } = await supabase.rpc('update_tenant_product', {
        p_tenant_id: tenant.id,
        p_producto_id: editingId,
        p_codigo_barras: editForm.codigo_barras,
        p_descripcion: editForm.descripcion,
        p_precio_venta: parseFloat(editForm.precio_venta),
        p_costo: parseFloat(editForm.costo),
        p_stock_minimo: parseInt(editForm.stock_minimo) || 10,
        p_categoria_id: editForm.categoria_id || null,
        p_tarifa_iva: parseFloat(editForm.tarifa_iva),
        p_tarifa_impoconsumo: parseFloat(editForm.tarifa_impoconsumo || '0'),
      })

      if (rpcError) throw rpcError

      setEditingId(null)
      addToast('success', 'Producto actualizado')
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo actualizar el producto')
    }
  }

  const toggleActive = async (product: ProductRow) => {
    if (!tenant) return
    try {
      const nuevoEstado = !product.activo
      const { error: rpcError } = await supabase.rpc('update_tenant_product', {
        p_tenant_id: tenant.id,
        p_producto_id: product.id,
        p_activo: nuevoEstado,
      })

      if (rpcError) throw rpcError

      addToast('success', nuevoEstado ? 'Producto activado' : 'Producto desactivado')
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo cambiar el estado del producto')
    }
  }

  const handleDelete = async () => {
    if (!tenant || !deleteTarget) return
    setDeleteLoading(true)
    try {
      const { error: rpcError } = await supabase.rpc('delete_tenant_product', {
        p_tenant_id: tenant.id,
        p_producto_id: deleteTarget.id,
      })

      if (rpcError) throw rpcError

      setDeleteTarget(null)
      addToast('success', 'Producto eliminado permanentemente')
      setRefreshKey(k => k + 1)
    } catch {
      addToast('error', 'No se pudo eliminar el producto')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      addToast('info', 'No hay productos para exportar')
      return
    }

    const exportData = filtered.map((p) => ({
      codigo_barras: p.codigo_barras,
      descripcion: p.descripcion,
      stock_actual: p.stock_actual,
      stock_minimo: p.stock_minimo,
      precio_venta: p.precio_venta,
      costo: p.costo,
      sucursal_nombre: p.sucursal_nombre || '',
      iva: `${(p.tarifa_iva * 100).toFixed(0)}%`,
      impoconsumo: p.tarifa_impoconsumo > 0 ? `${(p.tarifa_impoconsumo * 100).toFixed(0)}%` : '-',
      activo: p.activo ? 'Si' : 'No',
    }))

    exportToExcel(exportData as unknown as Record<string, unknown>[], INVENTORY_COLUMNS, 'inventario')
    addToast('success', 'Inventario exportado exitosamente')
  }

  const formatPrice = (n: number) =>
    n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const importRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { codigo_barras: '7701234567890', descripcion: 'Ejemplo — Producto', categoria: 'Ejemplo', costo: 2500, precio_venta: 5000, stock: 100, stock_minimo: 10 }
    ], { header: ['codigo_barras', 'descripcion', 'categoria', 'costo', 'precio_venta', 'stock', 'stock_minimo'] })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Plantilla_Productos.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', 'Plantilla descargada')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!tenant || !e.target.files?.[0]) return
    addToast('info', 'Importando productos...')
    try {
      const file = e.target.files[0]
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
      if (rows.length === 0) { addToast('error', 'Archivo vacío'); return }

      const required = ['codigo_barras', 'descripcion', 'precio_venta']
      const missing = required.filter(c => !(c in (rows[0] || {})))
      if (missing.length > 0) { addToast('error', `Faltan columnas: ${missing.join(', ')}`); return }

      if (!selectedBranch) { addToast('error', 'Selecciona una sucursal para importar'); return }

      const { data: existingProducts } = await supabase
        .rpc('get_tenant_products', {
          p_tenant_id: tenant.id,
          p_sucursal_id: selectedBranch,
        })
      const existingMap = new Map<string, ProductRow>()
      if (existingProducts) {
        for (const p of existingProducts as ProductRow[]) {
          existingMap.set(p.codigo_barras, p)
        }
      }

      let creados = 0, actualizados = 0, omitidos = 0, errores = 0
      const erroresLog: string[] = []

      for (const r of rows) {
        try {
          const code = String(r.codigo_barras || '').trim()
          const desc = String(r.descripcion || '').trim()
          const precio = parseFloat(String(r.precio_venta || '0').replace(',', '.'))
          if (!code || !desc || isNaN(precio) || precio <= 0) { omitidos++; continue }
          const stock = parseInt(String(r.stock || '0')) || 0
          const costo = parseFloat(String(r.costo || '0').replace(',', '.')) || 0
          const stockMinimo = parseInt(String(r.stock_minimo || '10')) || 10
          const categoriaRaw = String(r.categoria || '').trim()

          let categoriaId: string | null = null
          if (categoriaRaw) {
            const catMatch = categories.find(c =>
              c.sucursal_id === selectedBranch &&
              c.nombre.toLowerCase() === categoriaRaw.toLowerCase()
            )
            if (catMatch) categoriaId = catMatch.id
          }

          const existingProd = existingMap.get(code)

          if (existingProd) {
            const { error: updErr } = await supabase.rpc('update_tenant_product', {
              p_tenant_id: tenant.id,
              p_producto_id: existingProd.id,
              p_descripcion: desc,
              p_precio_venta: precio,
              p_costo: costo,
              p_stock_minimo: stockMinimo,
              p_categoria_id: categoriaId,
            })
            if (updErr) throw updErr

            const { error: adjErr } = await supabase.rpc('adjust_tenant_product_stock', {
              p_tenant_id: tenant.id,
              p_producto_id: existingProd.id,
              p_tipo: 'ajuste',
              p_cantidad: stock,
              p_observacion: 'Importación masiva',
            })
            if (adjErr) throw adjErr
            actualizados++
          } else {
            const { error: createErr } = await supabase.rpc('create_tenant_product', {
              p_tenant_id: tenant.id,
              p_sucursal_id: selectedBranch,
              p_codigo_barras: code,
              p_descripcion: desc,
              p_precio_venta: precio,
              p_costo: costo,
              p_stock_inicial: stock,
              p_stock_minimo: stockMinimo,
              p_categoria_id: categoriaId,
            })
            if (createErr) throw createErr
            creados++
          }
        } catch (rowErr) {
          errores++
          const msg = rowErr instanceof Error ? rowErr.message : 'Error desconocido'
          erroresLog.push(`Fila ${rows.indexOf(r) + 2}: ${msg}`)
        }
      }

      let resumen = `Importación completada: ${rows.length} procesados`
      if (creados > 0) resumen += `, ${creados} creados`
      if (actualizados > 0) resumen += `, ${actualizados} actualizados`
      if (omitidos > 0) resumen += `, ${omitidos} omitidos`
      if (errores > 0) resumen += `, ${errores} errores`

      if (erroresLog.length > 0) {
        const logData = erroresLog.map(m => ({ error: m }))
        const logWs = XLSX.utils.json_to_sheet(logData)
        const logWb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(logWb, logWs, 'Errores')
        const logBuf = XLSX.write(logWb, { type: 'array', bookType: 'xlsx' })
        const logBlob = new Blob([logBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const logUrl = URL.createObjectURL(logBlob)
        const logA = document.createElement('a')
        logA.href = logUrl
        logA.download = `errores_importacion_${new Date().toISOString().slice(0, 10)}.xlsx`
        logA.click()
        URL.revokeObjectURL(logUrl)
        resumen += '. Se descargó un archivo con los errores.'
      }

      addToast('success', resumen)
      setRefreshKey(k => k + 1)
    } catch (err) {
      console.error(err)
      addToast('error', 'Error al importar archivo')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventario</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Plantilla
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={() => {
              if (branches.length === 0 && selectedBranch === '') {
                addToast('warning', 'No tienes sucursales activas. Crea una sucursal primero.')
                return
              }
              setShowCreate(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Buscar por código o descripción..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as FilterMode)
              setCurrentPage(1)
            }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 cursor-pointer"
          >
            <option value="todos">Todos</option>
            <option value="stock_bajo">Stock bajo</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </div>

        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={selectedBranch}
            onChange={(e) => {
              setSelectedBranch(e.target.value)
              setCurrentPage(1)
            }}
            className="appearance-none pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 cursor-pointer"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.sucursal_id} value={b.sucursal_id}>
                {b.nombre_sucursal}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Error al cargar productos</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
          <button
            onClick={() => { setError(null); setRefreshKey(k => k + 1) }}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {!error && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Costo
                  </th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Sucursal
                  </th>
                  <th className="text-center px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Activo
                  </th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <SkeletonRows count={10} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <Package className="w-7 h-7 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">Sin productos</p>
                        <p className="text-xs text-slate-500">
                          {search || filter !== 'todos' || selectedBranch
                            ? 'Intenta ajustar los filtros de búsqueda'
                            : 'Crea tu primer producto haciendo clic en "Nuevo"'}
                        </p>
                        {(search || filter !== 'todos' || selectedBranch) && (
                          <button
                            onClick={() => {
                              setSearch('')
                              setFilter('todos')
                              setSelectedBranch('')
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            Limpiar filtros
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((p) => (
                    <tr
                      key={p.id}
                      className={classNames(
                        'transition-colors',
                        p.stock_actual >= 0 && p.stock_actual <= p.stock_minimo
                          ? 'bg-amber-50/60 hover:bg-amber-50'
                          : 'hover:bg-slate-50/50'
                      )}
                    >
                      {editingId === p.id ? (
                        <>
                          <td className="px-5 py-3">
                            <input
                              value={editForm.codigo_barras}
                              onChange={(e) =>
                                setEditForm({ ...editForm, codigo_barras: e.target.value })
                              }
                              className="w-36 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <input
                              value={editForm.descripcion}
                              onChange={(e) =>
                                setEditForm({ ...editForm, descripcion: e.target.value })
                              }
                              className="w-52 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                            />
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-500 text-xs">
                            {p.stock_actual}
                          </td>
                          <td className="px-5 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.precio_venta}
                              onChange={(e) =>
                                setEditForm({ ...editForm, precio_venta: e.target.value })
                              }
                              className="w-24 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.costo}
                              onChange={(e) =>
                                setEditForm({ ...editForm, costo: e.target.value })
                              }
                              className="w-24 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                            />
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">
                            {p.sucursal_nombre || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={classNames(
                                'text-[11px] font-medium px-2 py-0.5 rounded-full border',
                                p.activo
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-red-100 text-red-800 border-red-200'
                              )}
                            >
                              {p.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={saveEdit}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                            {p.codigo_barras}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-slate-800 text-xs truncate max-w-[280px]">
                              {p.descripcion}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={classNames(
                                  'inline-block w-2 h-2 rounded-full',
                                  p.stock_actual <= 0
                                    ? 'bg-red-500'
                                    : p.stock_actual <= p.stock_minimo
                                      ? 'bg-amber-400'
                                      : 'bg-green-500'
                                )}
                              />
                              <span
                                className={classNames(
                                  'font-semibold text-sm tabular-nums',
                                  p.stock_actual <= 0
                                    ? 'text-red-600'
                                    : p.stock_actual <= p.stock_minimo
                                      ? 'text-amber-600'
                                      : 'text-slate-700'
                                )}
                              >
                                {p.stock_actual}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="font-semibold text-sm text-brand-700 tabular-nums">
                              ${formatPrice(p.precio_venta)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="text-sm text-slate-500 tabular-nums">
                              ${formatPrice(p.costo)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <Store className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="text-xs text-slate-600">
                                {p.sucursal_nombre || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={classNames(
                                'text-[11px] font-medium px-2 py-0.5 rounded-full border',
                                p.activo
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-red-100 text-red-800 border-red-200'
                              )}
                            >
                              {p.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEdit(p)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Editar"
                              >
                                <PenLine className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => toggleActive(p)}
                                className={classNames(
                                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                  p.activo
                                    ? 'text-slate-600 hover:bg-slate-100'
                                    : 'text-red-700 bg-red-50 hover:bg-red-100'
                                )}
                                title={p.activo ? 'Desactivar' : 'Activar'}
                              >
                                {p.activo ? (
                                  <PowerOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Power className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  setAdjustTarget({
                                    id: p.id,
                                    name: p.descripcion,
                                    stock: p.stock_actual,
                                    sucursalId: p.sucursal_id,
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                                title="Ajustar stock"
                              >
                                <Package className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({ id: p.id, name: p.descripcion })
                                }
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!error && !loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Página {safeCurrentPage} de {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (safeCurrentPage <= 4) {
                pageNum = i < 6 ? i + 1 : totalPages
              } else if (safeCurrentPage >= totalPages - 3) {
                pageNum = i === 0 ? 1 : totalPages - 6 + i
              } else {
                pageNum = i === 0 ? 1 : i === 6 ? totalPages : safeCurrentPage - 3 + i
              }

              const isEllipsis =
                (i === 5 && safeCurrentPage <= 4 && totalPages > 7) ||
                (i === 1 && safeCurrentPage >= totalPages - 3 && totalPages > 7)

              if (isEllipsis) {
                return (
                  <span key={i} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">
                    ...
                  </span>
                )
              }

              return (
                <button
                  key={i}
                  onClick={() => setCurrentPage(pageNum)}
                  className={classNames(
                    'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                    pageNum === safeCurrentPage
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <CreateProductModal
        key={showCreate ? `create-${selectedBranch}` : 'create-closed'}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreateProduct}
        loading={createLoading}
        branches={branches}
        categories={categories}
        defaultBranchId={selectedBranch}
      />

      <DeleteProductModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        productName={deleteTarget?.name ?? ''}
      />

      <StockAdjustmentModal
        key={adjustTarget?.id ?? 'adjust-closed'}
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        tenantId={tenant?.id ?? ''}
        productId={adjustTarget?.id ?? ''}
        productName={adjustTarget?.name ?? ''}
        currentStock={adjustTarget?.stock ?? 0}
        sucursalId={adjustTarget?.sucursalId ?? null}
        onSuccess={() => {
          setAdjustTarget(null)
          setRefreshKey(k => k + 1)
          addToast('success', 'Stock ajustado exitosamente')
        }}
      />
    </div>
  )
}
