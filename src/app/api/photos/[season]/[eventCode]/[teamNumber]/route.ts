import { list } from '@vercel/blob'

export interface PhotoEntry {
  url: string
  eventCode: string
  uploadedAt: string
}

export interface PhotosResponse {
  url: string | null       // primary photo (current event, or most recent in season)
  history: PhotoEntry[]    // all photos for this team in this season, newest first
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ season: string; eventCode: string; teamNumber: string }> }
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ url: null, history: [] } satisfies PhotosResponse)
  }

  const { season, eventCode, teamNumber } = await ctx.params

  // List all photos for this team in this season
  const { blobs } = await list({ prefix: `photos/${season}/` })
  const teamBlobs = blobs
    .filter(b => {
      const filename = b.pathname.split('/').pop() ?? ''
      return filename.startsWith(`${teamNumber}.`)
    })
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

  if (!teamBlobs.length) {
    return Response.json({ url: null, history: [] } satisfies PhotosResponse)
  }

  const history: PhotoEntry[] = teamBlobs.map(b => ({
    url: b.url,
    // photos/{season}/{eventCode}/{teamNumber}.ext — eventCode is index 2
    eventCode: b.pathname.split('/')[2],
    uploadedAt: b.uploadedAt.toISOString(),
  }))

  // Prefer a photo taken at the current event; fall back to most recent in season
  const primary = history.find(h => h.eventCode === eventCode) ?? history[0]

  return Response.json({ url: primary.url, history } satisfies PhotosResponse)
}
