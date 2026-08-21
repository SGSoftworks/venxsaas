import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export type PendingWrite = () => Promise<unknown>

interface UIState {
  sidebarOpen: boolean
  toasts: Toast[]
  isOffline: boolean
  pendingWrites: PendingWrite[]

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
  setOffline: () => void
  setOnline: () => void
  enqueueWrite: (write: PendingWrite) => void
  dequeueWrite: () => PendingWrite | undefined
  clearPendingWrites: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  toasts: [],
  isOffline: false,
  pendingWrites: [],

  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  addToast: (type, message) => {
    const id = crypto.randomUUID()
    set({ toasts: [...get().toasts, { id, type, message }] })
    setTimeout(() => {
      set({ toasts: get().toasts.filter(t => t.id !== id) })
    }, 5000)
  },

  removeToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),

  setOffline: () => set({ isOffline: true }),
  setOnline: () => {
    const writes = get().pendingWrites
    set({ isOffline: false, pendingWrites: [] })
    writes.forEach((write) => write().catch(() => {}))
  },

  enqueueWrite: (write) => set({ pendingWrites: [...get().pendingWrites, write] }),
  dequeueWrite: () => {
    const [first, ...rest] = get().pendingWrites
    set({ pendingWrites: rest })
    return first
  },
  clearPendingWrites: () => set({ pendingWrites: [] }),
}))
