export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function daysUntil(date: string | null): number {
  if (!date) return 0
  const target = new Date(date)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function isSubscriptionPastDue(subscription: { estado: string; proximo_cobro: string | null } | null): boolean {
  if (!subscription || !subscription.proximo_cobro) return false
  if (subscription.estado === 'cancelled' || subscription.estado === 'expired') return false
  return daysUntil(subscription.proximo_cobro) < 0
}

export function isSubscriptionExpiringSoon(subscription: { estado: string; proximo_cobro: string | null } | null): boolean {
  if (!subscription || !subscription.proximo_cobro) return false
  if (subscription.estado !== 'active' && subscription.estado !== 'past_due') return false
  const d = daysUntil(subscription.proximo_cobro)
  return d >= 0 && d <= 5
}

export function getStatusColor(estado: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    pending_payment: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    suspended: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
    past_due: 'bg-red-100 text-red-800 border-red-200',
    expired: 'bg-gray-100 text-gray-500 border-gray-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    declined: 'bg-red-100 text-red-800 border-red-200',
    pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  }
  return colors[estado] || 'bg-gray-100 text-gray-600 border-gray-200'
}

export function getStatusLabel(estado: string): string {
  const labels: Record<string, string> = {
    active: 'Activa',
    pending: 'Pendiente',
    pending_payment: 'Pendiente de pago',
    pending_approval: 'Pendiente de aprobacion',
    suspended: 'Suspendida',
    cancelled: 'Cancelada',
    past_due: 'Por vencer',
    expired: 'Vencida',
    approved: 'Aprobado',
    declined: 'Rechazado',
  }
  return labels[estado] || estado
}
