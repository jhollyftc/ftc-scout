import type { TeamOPR } from './opr'

export interface MatchPrediction {
  redScore: number
  blueScore: number
  redWinPct: number
  blueWinPct: number
  margin: number
}

export function predictMatch(
  redTeams: number[],
  blueTeams: number[],
  opr: Record<number, TeamOPR>,
  fallbackOpr = 40,
  scoreSigma = 25
): MatchPrediction {
  const redScore = redTeams.reduce((s, t) => s + (opr[t]?.total ?? fallbackOpr), 0)
  const blueScore = blueTeams.reduce((s, t) => s + (opr[t]?.total ?? fallbackOpr), 0)
  const diff = redScore - blueScore
  const redWinPct = Math.round((1 / (1 + Math.exp(-diff / scoreSigma))) * 100)
  return {
    redScore: Math.round(redScore),
    blueScore: Math.round(blueScore),
    redWinPct,
    blueWinPct: 100 - redWinPct,
    margin: Math.round(Math.abs(diff)),
  }
}
