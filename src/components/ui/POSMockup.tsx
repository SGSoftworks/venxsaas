import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
} from 'lucide-react'

const PRODUCTS = [
  { name: 'Hamburguesa', price: '$8.50', color: 'bg-amber-50 text-amber-700' },
  { name: 'Pizza personal', price: '$6.90', color: 'bg-red-50 text-red-600' },
  { name: 'Tacos (3)', price: '$7.50', color: 'bg-green-50 text-green-700' },
  { name: 'Burrito', price: '$9.00', color: 'bg-orange-50 text-orange-700' },
  { name: 'Refresco', price: '$2.00', color: 'bg-blue-50 text-blue-600' },
  { name: 'Postre', price: '$4.50', color: 'bg-pink-50 text-pink-600' },
]

const CART_ITEMS = [
  { name: 'Hamburguesa', qty: 2, price: '$17.00' },
  { name: 'Refresco', qty: 3, price: '$6.00' },
  { name: 'Tacos (3)', qty: 1, price: '$7.50' },
]

export function POSMockup() {
  return (
    <div className="rounded-2xl border border-slate-200 shadow-xl bg-white overflow-hidden animate-[float_6s_ease-in-out_infinite]" style={{ animationDelay: '2s' }}>
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-brand-600" />
          <span className="text-xs font-bold text-white">VenxPOS</span>
        </div>
        <span className="text-[10px] text-slate-400">Sucursal Centro</span>
      </div>

      <div className="flex h-[380px]">
        <div className="flex-1 p-4 flex flex-col min-w-0">
          <div className="relative mb-3">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              readOnly
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 outline-none"
            />
          </div>

          <div className="flex-1 grid grid-cols-3 gap-2 content-start">
            {PRODUCTS.map(({ name, price, color }) => (
              <div
                key={name}
                className="bg-white border border-slate-200 rounded-xl p-2.5 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div
                  className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2 text-lg font-bold`}
                >
                  {name.charAt(0)}
                </div>
                <p className="text-[11px] font-medium text-slate-900 truncate">
                  {name}
                </p>
                <p className="text-[11px] font-semibold text-brand-600 tabular-nums">
                  {price}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-[220px] bg-slate-50 border-l border-slate-200 flex flex-col shrink-0">
          <div className="px-3 py-3 border-b border-slate-200 flex items-center gap-1.5">
            <ShoppingCart size={14} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Carrito</span>
            <span className="ml-auto text-[10px] text-slate-400 tabular-nums">3 items</span>
          </div>

          <div className="flex-1 p-3 space-y-2 overflow-hidden">
            {CART_ITEMS.map(({ name, qty, price }) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-900 truncate">
                    {name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                      <Minus size={9} />
                    </button>
                    <span className="text-[10px] font-medium text-slate-700 tabular-nums min-w-[14px] text-center">
                      {qty}
                    </span>
                    <button className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                      <Plus size={9} />
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-semibold text-slate-900 tabular-nums">
                    {price}
                  </p>
                  <button className="mt-0.5 text-slate-400 hover:text-danger-500 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 p-3 space-y-2 bg-white">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-900 tabular-nums">$30.50</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Impuesto</span>
              <span className="font-medium text-slate-900 tabular-nums">$4.88</span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900 tabular-nums">$35.38</span>
            </div>

            <button className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5">
              <CreditCard size={13} />
              Cobrar $35.38
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
