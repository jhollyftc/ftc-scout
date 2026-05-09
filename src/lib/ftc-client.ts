const BASE = process.env.FTC_API_BASE!

function getAuth(): string {
  return `Basic ${Buffer.from(`${process.env.FTC_API_USER}:${process.env.FTC_API_TOKEN}`).toString('base64')}`
}

async function ftcGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`)
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: { Authorization: getAuth(), Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`FTC API ${res.status}: ${path}`)
  return res.json()
}

export interface FTCEvent {
  eventId: number
  code: string
  name: string
  type: string
  typeName: string
  regionCode: string
  leagueCode: string | null
  city: string
  stateprov: string
  country: string
  venue: string
  dateStart: string
  dateEnd: string
  published: boolean
  remote: boolean
}

export interface EventsResponse {
  events: FTCEvent[]
  eventCount: number
}

export interface MatchTeam {
  teamNumber: number
  teamName: string
  station: 'Red1' | 'Red2' | 'Blue1' | 'Blue2'
  surrogate: boolean
  noShow: boolean
}

export interface HybridMatch {
  matchNumber: number
  startTime: string
  actualStartTime: string | null
  postResultTime: string | null
  description: string
  tournamentLevel: string
  series: number
  teams: MatchTeam[]
  scoreRedFinal: number | null
  scoreBlueFinal: number | null
  scoreRedAuto: number | null
  scoreBlueAuto: number | null
  scoreRedDriveControlled: number | null
  scoreBlueDriveControlled: number | null
  scoreRedEndgame: number | null
  scoreBlueEndgame: number | null
  scoreRedFoul: number | null
  scoreBlueFoul: number | null
  redWins: boolean
  blueWins: boolean
  videoURL: string | null
}

export interface HybridScheduleResponse {
  schedule: HybridMatch[]
  scheduleCount: number
}

export interface Ranking {
  rank: number
  teamNumber: number
  teamName: string
  wins: number
  losses: number
  ties: number
  qualAverage: number
  matchesPlayed: number
  matchesCounted: number
  dq: number
  sortOrder1: number
  sortOrder2: number
  sortOrder3: number
  sortOrder4: number
  sortOrder5: number
  sortOrder6: number
}

export interface RankingsResponse {
  rankings: Ranking[]
  rankingCount: number
}

export interface Team {
  teamNumber: number
  nameShort: string
  nameFull: string
  city: string
  stateProv: string
  country: string
  rookieYear: number
  schoolName: string
}

export interface TeamsResponse {
  teams: Team[]
  teamCountPage: number
  teamCountTotal: number
}

export const ftc = {
  events: (season: number) =>
    ftcGet<EventsResponse>(`${season}/events`),

  event: async (season: number, eventCode: string): Promise<FTCEvent | null> => {
    const res = await ftcGet<EventsResponse>(`${season}/events`, { eventCode })
    return res.events[0] ?? null
  },

  hybridSchedule: (season: number, eventCode: string, level: 'qual' | 'playoff' = 'qual') =>
    ftcGet<HybridScheduleResponse>(`${season}/schedule/${eventCode}/${level}/hybrid`),

  rankings: (season: number, eventCode: string) =>
    ftcGet<RankingsResponse>(`${season}/rankings/${eventCode}`),

  teams: (season: number, eventCode: string) =>
    ftcGet<TeamsResponse>(`${season}/teams`, { eventCode }),

  teamInfo: async (season: number, teamNumber: number): Promise<Team | null> => {
    const res = await ftcGet<TeamsResponse>(`${season}/teams`, { teamNumber: String(teamNumber) })
    return res.teams[0] ?? null
  },
}
