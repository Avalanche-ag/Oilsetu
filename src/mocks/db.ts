import type {
  User,
  Project,
  ScheduleActivity,
  Assignment,
  DailyReport,
  AiMatchResult,
  ConversationThread,
  DelayEvent,
  AuditEvent,
  InsightAggregate,
} from '../types/domain'
import { APP_CONFIG } from '../utils/dates'
import {
  SEED_USERS,
  SEED_PROJECT,
  buildSeedActivities,
  SEED_ASSIGNMENTS,
  SEED_REPORTS,
  SEED_AI_MATCHES,
  SEED_THREADS,
  SEED_DELAYS,
  buildSeedAudit,
  SEED_INSIGHTS,
  recomputeRollups,
  applyAssignments,
} from './seed'

export interface DbSchema {
  users: User[]
  projects: Project[]
  activities: ScheduleActivity[]
  assignments: Assignment[]
  reports: DailyReport[]
  aiMatches: AiMatchResult[]
  threads: ConversationThread[]
  delays: DelayEvent[]
  audit: AuditEvent[]
  insights: InsightAggregate
  version: number
}

let db: DbSchema | null = null

export function getDb(): DbSchema {
  if (db) return db

  const raw = localStorage.getItem(APP_CONFIG.STORAGE_KEY)
  if (raw) {
    try {
      db = JSON.parse(raw) as DbSchema
      return db
    } catch {
      db = buildSeedDb()
      persist()
      return db
    }
  }

  db = buildSeedDb()
  persist()
  return db
}

export function persist(): void {
  if (!db) return
  localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(db))
}

export function resetDb(): void {
  localStorage.removeItem(APP_CONFIG.STORAGE_KEY)
  db = buildSeedDb()
  persist()
}

function buildSeedDb(): DbSchema {
  const activities = buildSeedActivities()
  const assignments = structuredClone(SEED_ASSIGNMENTS)
  applyAssignments(activities, assignments)
  recomputeRollups(activities)

  return {
    users: structuredClone(SEED_USERS),
    projects: [structuredClone(SEED_PROJECT)],
    activities,
    assignments,
    reports: structuredClone(SEED_REPORTS),
    aiMatches: structuredClone(SEED_AI_MATCHES),
    threads: structuredClone(SEED_THREADS),
    delays: structuredClone(SEED_DELAYS),
    audit: buildSeedAudit(),
    insights: structuredClone(SEED_INSIGHTS),
    version: 1,
  }
}

export function useDb(): DbSchema {
  return getDb()
}
