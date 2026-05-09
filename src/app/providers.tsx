'use client'

import { ScoutModeProvider } from '@/lib/scout-mode'

export function Providers({ children }: { children: React.ReactNode }) {
  return <ScoutModeProvider>{children}</ScoutModeProvider>
}
