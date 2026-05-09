import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { ftc } from '@/lib/ftc-client'
import EventNav from './EventNav'

export default async function EventLayout({
  params,
  children,
}: {
  params: Promise<{ season: string; eventCode: string }>
  children: React.ReactNode
}) {
  const { season, eventCode } = await params

  let eventName = eventCode
  try {
    const event = await ftc.event(Number(season), eventCode)
    if (event) eventName = event.name
  } catch {
    // fall through to eventCode
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Image src="/logo.png" alt="Nova Pyra" width={36} height={36} className="shrink-0 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]" />
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate leading-tight">{eventName}</h1>
              <p className="text-xs text-zinc-500 font-mono">
                {eventCode} · {season}
              </p>
            </div>
          </div>
          <EventNav season={season} eventCode={eventCode} />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
