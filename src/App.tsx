import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { GerenteGuard } from '@/components/auth/GerenteGuard'
import { LandingPage } from '@/components/landing/LandingPage'
import { LoginPage } from '@/components/auth/LoginPage'
import { PaymentPage } from '@/components/payment/PaymentPage'
import { CheckoutPage } from '@/components/payment/CheckoutPage'
import { PaymentSuccess } from '@/components/payment/PaymentSuccess'
import { PaymentPending } from '@/components/payment/PaymentPending'
import { PaymentFailed } from '@/components/payment/PaymentFailed'
import { PendingApprovalPage } from '@/components/pending/PendingApprovalPage'
import { ChangePasswordPage } from '@/components/auth/ChangePasswordPage'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import iconApp from '@/assets/branding/icon-app.png'
import { DashboardHome } from '@/components/dashboard/DashboardHome'
import { SubscriptionPage } from '@/components/dashboard/SubscriptionPage'
import { BranchesPage } from '@/components/dashboard/BranchesPage'
import { InvoicesPage } from '@/components/dashboard/InvoicesPage'
import { AnalyticsPage } from '@/components/dashboard/AnalyticsPage'
import { ConfigPage } from '@/components/dashboard/ConfigPage'
import { InventoryPage } from '@/components/dashboard/InventoryPage'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AdminClients } from '@/components/admin/AdminClients'
import { AdminPayments } from '@/components/admin/AdminPayments'
import { AdminBillingPage } from '@/components/admin/AdminBillingPage'
import { AdminAnalyticsPage } from '@/components/admin/AdminAnalyticsPage'
import { AdminRequests } from '@/components/admin/AdminRequests'
import { TerminosPage } from '@/components/legal/TerminosPage'
import { PrivacidadPage } from '@/components/legal/PrivacidadPage'
import { CookiesPage } from '@/components/legal/CookiesPage'
import { ReembolsosPage } from '@/components/legal/ReembolsosPage'
import { AceptableUsePage } from '@/components/legal/AceptableUsePage'
import { CumplimientoPage } from '@/components/legal/CumplimientoPage'
import { NotFoundPage } from '@/components/error/NotFoundPage'
import { ForbiddenPage } from '@/components/error/ForbiddenPage'
import { ServerErrorPage } from '@/components/error/ServerErrorPage'
import { Loader2 } from 'lucide-react'

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <img src={iconApp} className="w-12 h-12" />
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
      </div>
    </div>
  )
}

function Toasts() {
  const { toasts, removeToast } = useUIStore()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`animate-slide-up rounded-xl px-5 py-3 shadow-lg border text-sm font-medium cursor-pointer flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            'bg-brand-50 border-brand-200 text-brand-800'
          }`}
        >
          <span className="text-lg">
            {toast.type === 'success' ? '\u2713' : toast.type === 'error' ? '\u2717' : toast.type === 'warning' ? '\u26A0' : '\u2139'}
          </span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { initialize, initialized, loading } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initialize().then(() => setReady(true))
  }, [initialize])

  if (!ready || !initialized || loading) return <FullScreenLoader />

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />

        <Route path="/checkout/pay/:reference" element={<CheckoutPage />} />
        <Route path="/payment/success/:reference" element={<PaymentSuccess />} />
        <Route path="/payment/pending/:reference" element={<PaymentPending />} />
        <Route path="/payment/failed/:reference" element={<PaymentFailed />} />
        <Route path="/esperando-aprobacion" element={<PendingApprovalPage />} />

        <Route path="/legal/terminos" element={<TerminosPage />} />
        <Route path="/legal/privacidad" element={<PrivacidadPage />} />
        <Route path="/legal/cookies" element={<CookiesPage />} />
        <Route path="/legal/reembolsos" element={<ReembolsosPage />} />
        <Route path="/legal/conducta-aceptable" element={<AceptableUsePage />} />
        <Route path="/legal/cumplimiento" element={<CumplimientoPage />} />

        <Route path="/dashboard" element={
          <AuthGuard><DashboardLayout /></AuthGuard>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="facturas" element={<InvoicesPage />} />
          <Route path="analitica" element={<AnalyticsPage />} />
          <Route path="suscripcion" element={<SubscriptionPage />} />
          <Route path="sucursales" element={<BranchesPage />} />
          <Route path="configuracion" element={<ConfigPage />} />
          <Route path="inventario" element={<InventoryPage />} />
        </Route>

        <Route path="/admin" element={
          <GerenteGuard><AdminLayout /></GerenteGuard>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="clientes" element={<AdminClients />} />
          <Route path="pagos" element={<AdminPayments />} />
          <Route path="facturacion" element={<AdminBillingPage />} />
          <Route path="analitica" element={<AdminAnalyticsPage />} />
          <Route path="solicitudes" element={<AdminRequests />} />
        </Route>

        <Route path="/error/403" element={<ForbiddenPage />} />
        <Route path="/error/500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toasts />
    </>
  )
}
