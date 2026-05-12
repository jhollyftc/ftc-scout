import { redirect } from 'next/navigation'

export default async function EventPage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = await params
  redirect(`/events/${season}/${eventCode}/teams`)
}
