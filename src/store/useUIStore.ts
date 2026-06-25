import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface UIState {
  sidebarOpen: boolean
  toasts: Toast[]

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  toasts: [],

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
}))
