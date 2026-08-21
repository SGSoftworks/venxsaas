import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useUIStore } from '@/store/useUIStore'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { GerenteGuard } from '@/components/auth/GerenteGuard'
import { AdminNegocioGuard } from '@/components/auth/AdminNegocioGuard'
import { LandingPage } from '@/components/landing/LandingPage'
import { LoginPage } from '@/components/auth/LoginPage'
import { PendingApprovalPage } from '@/components/pending/PendingApprovalPage'
import { ChangePasswordPage } from '@/components/auth/ChangePasswordPage'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { NotFoundPage } from '@/components/error/NotFoundPage'
import { ForbiddenPage } from '@/components/error/ForbiddenPage'
import { ServerErrorPage } from '@/components/error/ServerErrorPage'
import iconApp from '@/assets/branding/icon-app.png'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminDashboard } from '@/components/admin/AdminDashboard'

const AdminPayments = lazy(() => import('@/components/admin/AdminPayments').then(m => ({ default: m.AdminPayments })))
const AdminBillingPage = lazy(() => import('@/components/admin/AdminBillingPage').then(m => ({ default: m.AdminBillingPage })))
const AdminAnalyticsPage = lazy(() => import('@/components/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })))
const AdminRequests = lazy(() => import('@/components/admin/AdminRequests').then(m => ({ default: m.AdminRequests })))
const AdminClients = lazy(() => import('@/components/admin/AdminClients').then(m => ({ default: m.AdminClients })))
const DashboardHome = lazy(() => import('@/components/dashboard/DashboardHome').then(m => ({ default: m.DashboardHome })))
const SubscriptionPage = lazy(() => import('@/components/dashboard/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })))
const BranchesPage = lazy(() => import('@/components/dashboard/BranchesPage').then(m => ({ default: m.BranchesPage })))
const InvoicesPage = lazy(() => import('@/components/dashboard/InvoicesPage').then(m => ({ default: m.InvoicesPage })))
const AnalyticsPage = lazy(() => import('@/components/dashboard/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const ConfigPage = lazy(() => import('@/components/dashboard/ConfigPage').then(m => ({ default: m.ConfigPage })))
const InventoryPage = lazy(() => import('@/components/dashboard/InventoryPage').then(m => ({ default: m.InventoryPage })))
import { TerminosPage } from '@/components/legal/TerminosPage'
import { PrivacidadPage } from '@/components/legal/PrivacidadPage'
import { CookiesPage } from '@/components/legal/CookiesPage'
import { ReembolsosPage } from '@/components/legal/ReembolsosPage'
import { AceptableUsePage } from '@/components/legal/AceptableUsePage'
import { CumplimientoPage } from '@/components/legal/CumplimientoPage'
import { MetodosPagoPage } from '@/components/legal/MetodosPagoPage'
import { Loader2 } from 'lucide-react'
import { ReconnectionOverlay } from '@/components/shared/ReconnectionOverlay'
import { startConnectionGuard } from '@/lib/supabase/connectionGuard'

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

  useEffect(() => {
    startConnectionGuard()
  }, [])

  if (!ready || !initialized || loading) return <FullScreenLoader />

  return (
    <>
      <ReconnectionOverlay />
      <ErrorBoundary>
      <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
        <Route path="/registro" element={<Navigate to="/" replace />} />
        <Route path="/esperando-aprobacion" element={<PendingApprovalPage />} />

        <Route path="/legal/terminos" element={<TerminosPage />} />
        <Route path="/legal/privacidad" element={<PrivacidadPage />} />
        <Route path="/legal/cookies" element={<CookiesPage />} />
        <Route path="/legal/reembolsos" element={<ReembolsosPage />} />
        <Route path="/legal/conducta-aceptable" element={<AceptableUsePage />} />
        <Route path="/legal/cumplimiento" element={<CumplimientoPage />} />
        <Route path="/legal/metodos-pago" element={<MetodosPagoPage />} />

        <Route path="/dashboard" element={
          <AuthGuard><DashboardLayout /></AuthGuard>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="facturas" element={<InvoicesPage />} />
          <Route path="analitica" element={<AdminNegocioGuard><AnalyticsPage /></AdminNegocioGuard>} />
          <Route path="suscripcion" element={<SubscriptionPage />} />
          <Route path="sucursales" element={<AdminNegocioGuard><BranchesPage /></AdminNegocioGuard>} />
          <Route path="configuracion" element={<AdminNegocioGuard><ConfigPage /></AdminNegocioGuard>} />
          <Route path="inventario" element={<AdminNegocioGuard><InventoryPage /></AdminNegocioGuard>} />
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
      </Suspense>
      </ErrorBoundary>
      <Toasts />
    </>
  )
}
