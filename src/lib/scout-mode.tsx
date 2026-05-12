'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const SESSION_KEY = 'scout_user'

interface ScoutUser {
  name: string
  isAdmin: boolean
}

interface ScoutModeCtx {
  isScout: boolean
  isAdmin: boolean
  scoutName: string | null
  login: (name: string, pin: string) => Promise<boolean>
  logout: () => void
}

const Ctx = createContext<ScoutModeCtx>({
  isScout: false,
  isAdmin: false,
  scoutName: null,
  login: async () => false,
  logout: () => {},
})

export function ScoutModeProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ScoutUser | null>(null)

  useEffect(() => {
    sessionStorage.removeItem('scout_mode')
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
  }, [])

  async function login(name: string, pin: string): Promise<boolean> {
    const res = await fetch('/api/auth/scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    })
    if (!res.ok) return false
    const { name: returnedName, isAdmin } = await res.json()
    const scout: ScoutUser = { name: returnedName, isAdmin }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(scout))
    setUser(scout)
    return true
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  return (
    <Ctx.Provider
      value={{
        isScout: user !== null,
        isAdmin: user?.isAdmin ?? false,
        scoutName: user?.name ?? null,
        login,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useScoutMode() {
  return useContext(Ctx)
}
