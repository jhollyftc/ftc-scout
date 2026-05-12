import type { HybridMatch } from './ftc-client'

export interface TeamOPR {
  total: number
  nopr: number
  auto: number
  teleop: number
}

function solveLeastSquares(M: number[][], b: number[]): number[] {
  const n = M[0].length
  const rows = M.length

  // A = M^T * M,  rhs = M^T * b
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const rhs: number[] = new Array(n).fill(0)

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < rows; k++) A[i][j] += M[k][i] * M[k][j]
    }
    for (let k = 0; k < rows; k++) rhs[i] += M[k][i] * b[k]
  }

  // Gauss-Jordan with partial pivoting
  const aug = A.map((row, i) => [...row, rhs[i]])

  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]

    if (Math.abs(aug[col][col]) < 1e-10) continue

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = aug[row][col] / aug[col][col]
      for (let c = col; c <= n; c++) aug[row][c] -= f * aug[col][c]
    }
  }

  return aug.map((row, i) => (Math.abs(row[i]) < 1e-10 ? 0 : row[n] / row[i]))
}

export function calculateOPR(matches: HybridMatch[]): Record<number, TeamOPR> {
  const scored = matches.filter(
    m => m.scoreRedFinal !== null && m.scoreBlueFinal !== null
  )
  if (scored.length < 2) return {}

  const teams = Array.from(
    new Set(scored.flatMap(m => m.teams.map(t => t.teamNumber)))
  ).sort((a, b) => a - b)

  const teamIdx = new Map(teams.map((t, i) => [t, i]))
  const n = teams.length

  const M: number[][] = []
  const sTotal: number[] = []
  const sNoPenalty: number[] = []
  const sAuto: number[] = []
  const sTeleop: number[] = []

  for (const match of scored) {
    const red = new Array(n).fill(0)
    const blue = new Array(n).fill(0)

    for (const t of match.teams) {
      const idx = teamIdx.get(t.teamNumber)
      if (idx === undefined) continue
      if (t.station.startsWith('Red')) red[idx] = 1
      else blue[idx] = 1
    }

    M.push(red, blue)
    sTotal.push(match.scoreRedFinal!, match.scoreBlueFinal!)
    // nOPR: remove foul points that were added to each alliance's score
    sNoPenalty.push(
      match.scoreRedFinal! - (match.scoreRedFoul ?? 0),
      match.scoreBlueFinal! - (match.scoreBlueFoul ?? 0)
    )
    sAuto.push(match.scoreRedAuto ?? 0, match.scoreBlueAuto ?? 0)
    sTeleop.push(
      match.scoreRedFinal! - (match.scoreRedAuto ?? 0) - (match.scoreRedEndgame ?? 0) - (match.scoreRedFoul ?? 0),
      match.scoreBlueFinal! - (match.scoreBlueAuto ?? 0) - (match.scoreBlueEndgame ?? 0) - (match.scoreBlueFoul ?? 0)
    )
  }

  const totalOpr = solveLeastSquares(M, sTotal)
  const noprValues = solveLeastSquares(M, sNoPenalty)
  const autoOpr = solveLeastSquares(M, sAuto)
  const teleopOpr = solveLeastSquares(M, sTeleop)

  const result: Record<number, TeamOPR> = {}
  teams.forEach((t, i) => {
    result[t] = {
      total: Math.round(totalOpr[i] * 10) / 10,
      nopr: Math.round(noprValues[i] * 10) / 10,
      auto: Math.round(autoOpr[i] * 10) / 10,
      teleop: Math.round(teleopOpr[i] * 10) / 10,
    }
  })
  return result
}
