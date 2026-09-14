import { create } from 'zustand'
import { APP_CONFIG } from '../utils/dates'
import type { User } from '../types/domain'
import { fetchMe, getUsers, setAuthToken } from '../services/api'

const ROLE_KEY = 'oilsetu-role'

interface AuthState {
  userId: string | null
  role: 'manager' | 'supervisor' | 'worker' | null
  user: User | null
  ready: boolean
  setSession: (user: User, token: string) => void
  logout: () => void
  boot: () => Promise<void>
}

const storedId = localStorage.getItem(APP_CONFIG.SESSION_KEY)
const storedRole = localStorage.getItem(ROLE_KEY)
const initialRole = storedRole === 'manager' || storedRole === 'supervisor' || storedRole === 'worker' ? storedRole : null

let bootPromise: Promise<void> | null = null

export const useAuth = create<AuthState>((set, get) => ({
  userId: storedId ?? null,
  role: initialRole,
  user: null,
  ready: false,
  setSession: (user, token) => {
    setAuthToken(token)
    localStorage.setItem(APP_CONFIG.SESSION_KEY, user.id)
    localStorage.setItem(ROLE_KEY, user.role)
    set({ userId: user.id, role: user.role, user, ready: true })
  },
  logout: () => {
    setAuthToken(null)
    localStorage.removeItem(APP_CONFIG.SESSION_KEY)
    localStorage.removeItem(ROLE_KEY)
    bootPromise = null
    set({ userId: null, role: null, user: null, ready: true })
  },
  boot: () => {
    if (get().ready) return Promise.resolve()
    if (!bootPromise) {
      bootPromise = (async () => {
        const { userId } = get()
        if (userId && localStorage.getItem('oilsetu-token')) {
          const me = await fetchMe()
          if (me) {
            localStorage.setItem(ROLE_KEY, me.role)
            set({ user: me, role: me.role })
          } else {
            localStorage.removeItem(APP_CONFIG.SESSION_KEY)
            localStorage.removeItem(ROLE_KEY)
            set({ userId: null, role: null, user: null })
          }
        }
        try {
          await getUsers()
        } catch {
          set({ ready: true })
          return
        }
        set({ ready: true })
      })()
    }
    return bootPromise
  },
}))
