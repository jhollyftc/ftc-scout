import { list } from '@vercel/blob'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ season: string; eventCode: string; teamNumber: string }> }
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ url: null })
  }

  const { season, eventCode, teamNumber } = await ctx.params
  const { blobs } = await list({ prefix: `photos/${season}/${eventCode}/${teamNumber}.` })

  if (!blobs.length) return Response.json({ url: null })

  const latest = blobs.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )[0]

  return Response.json({ url: latest.url })
}
