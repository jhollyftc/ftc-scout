'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const SCOUT_PIN = process.env.NEXT_PUBLIC_SCOUT_PIN ?? '2619'
const SESSION_KEY = 'scout_mode'

interface ScoutModeCtx {
  isScout: boolean
  unlock: (pin: string) => boolean
  lock: () => void
}

const Ctx = createContext<ScoutModeCtx>({ isScout: false, unlock: () => false, lock: () => {} })

export function ScoutModeProvider({ children }: { children: ReactNode }) {
  const [isScout, setIsScout] = useState(false)

  useEffect(() => {
    setIsScout(sessionStorage.getItem(SESSION_KEY) === '1')
  }, [])

  function unlock(pin: string): boolean {
    if (pin === SCOUT_PIN) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setIsScout(true)
      return true
    }
    return false
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY)
    setIsScout(false)
  }

  return <Ctx.Provider value={{ isScout, unlock, lock }}>{children}</Ctx.Provider>
}

export function useScoutMode() {
  return useContext(Ctx)
}
