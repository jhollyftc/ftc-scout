export type PitFieldType = 'select' | 'text' | 'number' | 'rating'

export interface PitField {
  key: string
  label: string
  type: PitFieldType
  options?: string[]    // for 'select'
  placeholder?: string  // for 'text'
}

export interface SeasonConfig {
  name: string
  endgameOptions: string[]
  pitFields: PitField[]
}

// ── How to update each season ────────────────────────────────────────────────
//
// At the start of a new season, add a new entry keyed by the season's START
// year (e.g. "2026" = the 2026–27 season).
//
//   endgameOptions: the dropdown choices shown in the match scout card.
//     Start with 'None' and list all endgame states for that year's game.
//
//   pitFields: the questions shown in the pit scouting form.
//     Each field needs a unique key (used as the storage key — don't rename
//     after data has been collected), a label, and a type:
//       'select'  — dropdown; provide options[]
//       'text'    — free-form textarea; optional placeholder
//       'number'  — numeric input
//       'rating'  — 1–5 button row (same as match scout auto/teleop)
//
// ─────────────────────────────────────────────────────────────────────────────

export const SEASON_CONFIGS: Record<string, SeasonConfig> = {
  '2026': {
    name: 'BioBuzz',
    // TODO: update when the 2026–27 game is announced
    endgameOptions: ['None', 'Park'],
    pitFields: [
      {
        key: 'drivetrain',
        label: 'Drivetrain',
        type: 'select',
        options: ['Mecanum', 'Tank', 'Swerve', 'Other'],
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        placeholder: 'General observations…',
      },
    ],
  },

  '2025': {
    name: 'Into The Deep',
    endgameOptions: ['None', 'Park', 'Low Hang', 'High Hang'],
    pitFields: [
      {
        key: 'drivetrain',
        label: 'Drivetrain',
        type: 'select',
        options: ['Mecanum', 'Tank', 'Swerve', 'Other'],
      },
      {
        key: 'auto',
        label: 'Auto Capability',
        type: 'select',
        options: [
          'None',
          'Leaves zone',
          'Scores (1 element)',
          'Scores (2+ elements)',
          'Full auto routine',
        ],
      },
      {
        key: 'teleop',
        label: 'Teleop Primary',
        type: 'select',
        options: ['Ground intake', 'Human player intake', 'Both', 'Neither'],
      },
      {
        key: 'endgame',
        label: 'Endgame',
        type: 'select',
        options: ['No attempt', 'Park', 'Low hang', 'High hang'],
      },
      {
        key: 'consistency',
        label: 'Consistency',
        type: 'rating',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        placeholder: 'Observations, strengths, weaknesses…',
      },
    ],
  },

  '2024': {
    name: 'Centerstage',
    endgameOptions: ['None', 'Park', 'Hang'],
    pitFields: [
      {
        key: 'drivetrain',
        label: 'Drivetrain',
        type: 'select',
        options: ['Mecanum', 'Tank', 'Swerve', 'Other'],
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        placeholder: 'Observations…',
      },
    ],
  },
}

const FALLBACK_CONFIG: SeasonConfig = {
  name: 'Unknown Season',
  endgameOptions: ['None', 'Park', 'Hang'],
  pitFields: [
    {
      key: 'drivetrain',
      label: 'Drivetrain',
      type: 'select',
      options: ['Mecanum', 'Tank', 'Swerve', 'Other'],
    },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
}

export function getSeasonConfig(season: string): SeasonConfig {
  return SEASON_CONFIGS[season] ?? FALLBACK_CONFIG
}
