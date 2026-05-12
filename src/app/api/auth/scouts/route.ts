import type { NextRequest } from 'next/server'

function parseNames(): string[] {
  const raw = process.env.SCOUT_USERS ?? ''
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => entry.split(':')[0])
}

export async function GET(_req: NextRequest) {
  return Response.json({ names: parseNames() })
}
