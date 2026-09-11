import { create } from 'zustand'
import { APP_CONFIG } from '../utils/dates'

interface AuthState {
  userId: string | null
  setUserId: (id: string | null) => void
  login: (id: string) => void
  logout: () => void
}

const stored = localStorage.getItem(APP_CONFIG.SESSION_KEY)

export const useAuth = create<AuthState>((set) => ({
  userId: stored ?? null,
  setUserId: (id) => {
    if (id) localStorage.setItem(APP_CONFIG.SESSION_KEY, id)
    else localStorage.removeItem(APP_CONFIG.SESSION_KEY)
    set({ userId: id })
  },
  login: (id) => {
    localStorage.setItem(APP_CONFIG.SESSION_KEY, id)
    set({ userId: id })
  },
  logout: () => {
    localStorage.removeItem(APP_CONFIG.SESSION_KEY)
    set({ userId: null })
  },
}))
