import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type { Tenant, Plan, Subscription } from '@/types'

interface AuthState {
  session: Session | null
  user: User | null
  tenant: Tenant | null
  plan: Plan | null
  subscription: Subscription | null
  isSuperadmin: boolean
  loading: boolean
  initialized: boolean

  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<{ error?: string; needsPayment?: boolean; needsApproval?: boolean; mustChangePassword?: boolean }>
  logout: () => Promise<void>
  refreshTenant: () => Promise<void>
}

let listenerRegistered = false

async function loadTenantData(userId: string) {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, plan_id, auth_user_id, estado, nombre_negocio, email_propietario, telefono, nit, created_at, updated_at, client_id, must_change_password')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (!tenants) return { tenant: null, plan: null, subscription: null }

  const tenant = tenants as unknown as Tenant

  let plan: Plan | null = null
  if (tenant.plan_id) {
    const { data: planData } = await supabase
      .from('plans')
      .select('*')
      .eq('id', tenant.plan_id)
      .maybeSingle()
    if (planData) plan = planData as unknown as Plan
  }

  let sub: Subscription | null = null
  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('estado', 'active')
    .maybeSingle()

  if (activeSub) {
    sub = activeSub as unknown as Subscription
  } else {
    const { data: pendingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('estado', 'pending')
      .maybeSingle()
    if (pendingSub) sub = pendingSub as unknown as Subscription
  }

  return { tenant, plan, subscription: sub }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  tenant: null,
  plan: null,
  subscription: null,
  isSuperadmin: false,
  loading: false,
  initialized: false,

  initialize: async () => {
    set({ loading: true })

    if (!listenerRegistered) {
      listenerRegistered = true
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          set({
            session: null, user: null, tenant: null,
            plan: null, subscription: null, isSuperadmin: false,
          })
        } else if (event === 'SIGNED_IN' && session) {
          set({ session, user: session.user })
        } else if (event === 'TOKEN_REFRESHED' && session) {
          set({ session, user: session.user })
        }
      })
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        set({ initialized: true, loading: false, session: null, user: null, tenant: null, plan: null, subscription: null, isSuperadmin: false })
        return
      }

      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        await supabase.auth.signOut()
        localStorage.removeItem('sb-beacnoxukkoellhecofm-auth-token')
        set({ initialized: true, loading: false, session: null, user: null, tenant: null, plan: null, subscription: null, isSuperadmin: false })
        return
      }

      set({ session, user: session.user })

      const result = await loadTenantData(session.user.id)
      set({ tenant: result.tenant, plan: result.plan, subscription: result.subscription })

      const { data: superData } = await supabase
        .from('superadmins')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      set({ isSuperadmin: !!superData })
    } catch (err) {
      console.error('Auth initialization error:', err)
    } finally {
      set({ initialized: true, loading: false })
    }
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const messages: Record<string, string> = {
        'Invalid login credentials': 'Correo o contraseña incorrectos',
        'Email not confirmed': 'Correo no confirmado. Revisa tu bandeja de entrada',
        'Rate limit exceeded': 'Demasiados intentos. Espera 30 segundos',
      }
      return { error: messages[error.message] || 'Error al iniciar sesión' }
    }
    if (!data.user) return { error: 'No se pudo iniciar sesión' }

    set({ session: data.session, user: data.user })

    const result = await loadTenantData(data.user.id)
    set({ tenant: result.tenant, plan: result.plan, subscription: result.subscription })

    if (result.tenant?.estado === 'pending_payment') {
      return { needsPayment: true }
    }

    if (result.tenant?.estado === 'pending_approval') {
      return { needsApproval: true }
    }

    if (result.tenant?.must_change_password) {
      return { mustChangePassword: true }
    }

    const { data: superData } = await supabase
      .from('superadmins')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    set({ isSuperadmin: !!superData })
    return {}
  },

  logout: async () => {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    localStorage.removeItem('supabase.auth.token')
    localStorage.removeItem('sb-beacnoxukkoellhecofm-auth-token')
    set({ session: null, user: null, tenant: null, plan: null, subscription: null, isSuperadmin: false })
  },

  refreshTenant: async () => {
    const { user } = get()
    if (!user) return

    const result = await loadTenantData(user.id)
    set({ tenant: result.tenant, plan: result.plan, subscription: result.subscription })
  },
}))
