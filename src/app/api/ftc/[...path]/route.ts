import type { NextRequest } from 'next/server'

const BASE = process.env.FTC_API_BASE!

function getAuth(): string {
  return `Basic ${Buffer.from(`${process.env.FTC_API_USER}:${process.env.FTC_API_TOKEN}`).toString('base64')}`
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params
  const search = new URL(request.url).search
  const upstream = `${BASE}/${path.join('/')}${search}`

  const res = await fetch(upstream, {
    headers: { Authorization: getAuth(), Accept: 'application/json' },
  })

  if (!res.ok) {
    return Response.json({ error: `FTC API ${res.status}` }, { status: res.status })
  }

  return Response.json(await res.json())
}
