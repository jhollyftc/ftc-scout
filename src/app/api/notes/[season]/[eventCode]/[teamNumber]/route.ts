import { list, put } from '@vercel/blob'
import type { NextRequest } from 'next/server'

export interface Note {
  id: string
  text: string
  timestamp: string
}

async function readNotes(pathname: string): Promise<Note[]> {
  const { blobs } = await list({ prefix: pathname })
  if (!blobs.length) return []
  const res = await fetch(blobs[0].url)
  return res.json()
}

type Ctx = { params: Promise<{ season: string; eventCode: string; teamNumber: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json([])
  const { season, eventCode, teamNumber } = await ctx.params
  const notes = await readNotes(`notes/${season}/${eventCode}/${teamNumber}.json`)
  return Response.json(notes)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: 'Not configured' }, { status: 503 })
  const { season, eventCode, teamNumber } = await ctx.params
  const notes: Note[] = await req.json()
  await put(
    `notes/${season}/${eventCode}/${teamNumber}.json`,
    JSON.stringify(notes),
    { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
  )
  return Response.json({ ok: true })
}
