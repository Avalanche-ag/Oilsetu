export const APP_CONFIG = {
  NAME: 'OilSetu',
  STORAGE_KEY: 'oilsetu-db-v1',
  SESSION_KEY: 'oilsetu-session',
  UI_KEY: 'oilsetu-ui',
  SIMULATED_AI: true,
  CONFIDENCE_AUTO: 90,
  CONFIDENCE_REVIEW: 70,
  STALE_DAYS: 3,
  RISK_NEAR_DAYS: 14,
}

export const DISCIPLINES: DisciplineKey[] = [
  'CIVIL',
  'PIPING',
  'ELECTRICAL',
  'INSTRUMENTATION',
  'EQUIPMENT',
  'HSE',
]

export const DELAY_REASONS: DelayReasonKey[] = [
  'MATERIAL',
  'MANPOWER',
  'EQUIPMENT',
  'WEATHER',
  'DESIGN_CHANGE',
  'PERMIT',
  'FRONTEND',
  'OTHER',
]

export const ACTIVITY_STATUSES: ActivityStatusKey[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'DELAYED',
  'ON_HOLD',
]

export const ACTIVITY_LEVELS: ActivityLevelKey[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']

export const CONFIDENCE_BANDS: ConfidenceBandKey[] = ['AUTO', 'REVIEW', 'UNMATCHED']

export type DisciplineKey =
  | 'CIVIL'
  | 'PIPING'
  | 'ELECTRICAL'
  | 'INSTRUMENTATION'
  | 'EQUIPMENT'
  | 'HSE'

export type DelayReasonKey =
  | 'MATERIAL'
  | 'MANPOWER'
  | 'EQUIPMENT'
  | 'WEATHER'
  | 'DESIGN_CHANGE'
  | 'PERMIT'
  | 'FRONTEND'
  | 'OTHER'

export type ActivityStatusKey =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELAYED'
  | 'ON_HOLD'

export type ActivityLevelKey = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'

export type ConfidenceBandKey = 'AUTO' | 'REVIEW' | 'UNMATCHED'
