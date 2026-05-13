import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  const raw = process.env.SCOUT_USERS ?? ''
  const names = raw
    .split(',')
    .map(entry => entry.trim().split(':')[0])
    .filter(Boolean)
  return Response.json(names)
}
