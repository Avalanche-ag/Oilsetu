import { create } from 'zustand'
import { APP_CONFIG } from '../utils/dates'

interface UiState {
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void
}

const stored = localStorage.getItem(APP_CONFIG.UI_KEY)
const initial: { activeProjectId?: string } = stored ? JSON.parse(stored) : {}

export const useUi = create<UiState>((set) => ({
  activeProjectId: initial.activeProjectId ?? null,
  setActiveProjectId: (id) => {
    localStorage.setItem(APP_CONFIG.UI_KEY, JSON.stringify({ activeProjectId: id }))
    set({ activeProjectId: id })
  },
}))
