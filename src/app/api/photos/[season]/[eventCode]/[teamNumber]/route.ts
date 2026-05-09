import { list } from '@vercel/blob'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ season: string; eventCode: string; teamNumber: string }> }
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ url: null })
  }

  const { season, eventCode, teamNumber } = await ctx.params

  // Prefer event-specific photo
  const { blobs: eventBlobs } = await list({ prefix: `photos/${season}/${eventCode}/${teamNumber}.` })
  if (eventBlobs.length) {
    const latest = eventBlobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
    return Response.json({ url: latest.url })
  }

  // Fall back to most recent photo for this team across all events/seasons
  const { blobs: allBlobs } = await list({ prefix: 'photos/' })
  const teamBlobs = allBlobs.filter(b => {
    const filename = b.pathname.split('/').pop() ?? ''
    return filename.startsWith(`${teamNumber}.`)
  })

  if (!teamBlobs.length) return Response.json({ url: null })

  const latest = teamBlobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
  return Response.json({ url: latest.url })
}
