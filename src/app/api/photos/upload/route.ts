import { put } from '@vercel/blob'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: 'Blob storage not configured' }, { status: 503 })
  }

  const form = await request.formData()
  const file = form.get('file') as File | null
  const season = form.get('season') as string | null
  const eventCode = form.get('eventCode') as string | null
  const teamNumber = form.get('teamNumber') as string | null

  if (!file || !season || !eventCode || !teamNumber) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
    return Response.json({ error: 'Invalid file type' }, { status: 400 })
  }

  const pathname = `photos/${season}/${eventCode}/${teamNumber}.${ext}`

  try {
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
    })
    return Response.json({ url: blob.url })
  } catch (e) {
    console.error('Blob upload error:', e)
    return Response.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 500 })
  }
}
