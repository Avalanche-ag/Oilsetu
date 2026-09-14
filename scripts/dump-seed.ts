import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  SEED_ASSIGNMENTS,
  SEED_AI_MATCHES,
  SEED_DELAYS,
  SEED_PROJECT,
  SEED_REPORTS,
  SEED_THREADS,
  SEED_USERS,
  applyAssignments,
  buildSeedActivities,
  buildSeedAudit,
} from '../src/mocks/seed'

const activities = buildSeedActivities()
applyAssignments(activities, structuredClone(SEED_ASSIGNMENTS))

const rows = activities.map((a) => ({
  id: a.id,
  parentId: a.parentId,
  name: a.name,
  discipline: a.discipline,
  level: a.level,
  plannedStart: a.plannedStart,
  plannedEnd: a.plannedEnd,
  status: a.status,
  progressPct: a.progressPct,
  assigneeId: a.assigneeId ?? null,
}))
const out = join(process.cwd(), 'data/seed_activities.json')
writeFileSync(out, JSON.stringify(rows))
console.log(`wrote ${rows.length} activities to ${out}`)

const full = {
  project: SEED_PROJECT,
  users: SEED_USERS,
  assignments: SEED_ASSIGNMENTS,
  reports: SEED_REPORTS,
  aiMatches: SEED_AI_MATCHES,
  threads: SEED_THREADS,
  delays: SEED_DELAYS,
  audit: buildSeedAudit(),
}
const fullOut = join(process.cwd(), 'data/seed_full.json')
writeFileSync(fullOut, JSON.stringify(full))
console.log(`wrote full story to ${fullOut}`)
