import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, type?: ToastType) => void
  remove: (id: string) => void
}

let idCounter = 0

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const id = `${Date.now()}-${idCounter++}`
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
