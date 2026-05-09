import { list } from '@vercel/blob'
import type { NextRequest } from 'next/server'

interface MatchScoutEntry {
  autoRating: number | null
  teleopRating: number | null
  endgame: string
  notes: string
  scoutedAt: string
}

export interface MatchScoutEntryWithMatch extends MatchScoutEntry {
  matchNumber: number
}

type Ctx = { params: Promise<{ season: string; eventCode: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({})
  const { season, eventCode } = await ctx.params
  const { blobs } = await list({ prefix: `match-scout/${season}/${eventCode}/` })

  const entries: Record<string, MatchScoutEntryWithMatch[]> = {}

  await Promise.all(
    blobs.map(async blob => {
      const parts = blob.pathname.split('/')
      // path: match-scout/{season}/{eventCode}/{matchNumber}/{teamNumber}.json
      const teamNumber = parts[parts.length - 1].replace('.json', '')
      const matchNumber = Number(parts[parts.length - 2])
      const entry: MatchScoutEntry = await fetch(blob.url).then(r => r.json())
      if (!entries[teamNumber]) entries[teamNumber] = []
      entries[teamNumber].push({ ...entry, matchNumber })
    })
  )

  return Response.json(entries)
}
