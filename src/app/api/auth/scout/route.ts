import type { NextRequest } from 'next/server'

interface ScoutUser {
  name: string
  pin: string
  isAdmin: boolean
}

function parseScoutUsers(): ScoutUser[] {
  const raw = process.env.SCOUT_USERS ?? ''
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const parts = entry.split(':')
      return { name: parts[0], pin: parts[1] ?? '', isAdmin: parts[2] === 'admin' }
    })
}

export async function POST(req: NextRequest) {
  const { name, pin } = await req.json()
  const user = parseScoutUsers().find(u => u.name === name && u.pin === pin)
  if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  return Response.json({ ok: true, name: user.name, isAdmin: user.isAdmin })
}
