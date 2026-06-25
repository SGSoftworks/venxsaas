import { Check } from 'lucide-react'

interface PricingCardProps {
  name: string
  price: string
  setup: string
  features: string[]
  highlighted?: boolean
  cta: string
  onClick?: () => void
}

export function PricingCard({
  name,
  price,
  setup,
  features,
  highlighted = false,
  cta,
  onClick,
}: PricingCardProps) {
  return (
    <div
      className={`relative bg-white rounded-2xl border-2 p-6 sm:p-7 transition-all duration-200 hover:shadow-lg ${
        highlighted
          ? 'border-brand-300 ring-2 ring-brand-100 scale-[1.02]'
          : 'border-slate-200'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-block px-4 py-1 bg-brand-600 text-white text-xs font-semibold rounded-full">
            Popular
          </span>
        </div>
      )}

      <h3 className="text-lg font-semibold text-slate-900 mb-1">{name}</h3>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-bold text-slate-900 tabular-nums">
          {price}
        </span>
        <span className="text-sm text-slate-400">/mes</span>
      </div>
      <p className="text-xs text-slate-400 mb-5">{setup}</p>

      <ul className="space-y-2.5 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600">
            <Check size={16} className="text-brand-600 shrink-0 mt-0.5" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
          highlighted
            ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow-md'
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {cta}
      </button>
    </div>
  )
}
