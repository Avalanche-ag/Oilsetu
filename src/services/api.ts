const API_BASE_URL = 'http://127.0.0.1:8000'
import type {
  User,
  Project,
  ScheduleActivity,
  Assignment,
  DailyReport,
  ReportEntry,
  AiMatchResult,
  ConversationThread,
  Message,
  DelayEvent,
  AuditEvent,
  NewProjectInput,
  PreviewEntry,
  ReportSource,
  ActivityStatus,
  DelayReasonCode,
  DashboardData,
  InsightAggregate,
  Discipline,
} from '../types/domain'
import { getDb, persist, resetDb } from '../mocks/db'
import { analyzeReport } from '../mocks/aiEngine'
import { generateSchedule } from '../mocks/scheduleGenerator'
import { recomputeRollups } from '../mocks/seed'
import { uid } from '../utils/ids'
import { todayIso, parseIso, monthLabel } from '../utils/dates'
import { APP_CONFIG } from '../config/constants'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

interface ActivityUpdateInput {
  matchedActivityId: string | null
  status: ActivityStatus | null
  delayReason?: DelayReasonCode | null
  delayText?: string
}

export const aiService = {
  async processReport(rawText: string, ctx: { projectId: string; supervisorId: string; source: ReportSource; language: string }): Promise<PreviewEntry[]> {
    await delay(1600 + Math.random() * 600)
    const db = getDb()
    const allActivities = db.activities.filter((a) => a.projectId === ctx.projectId)
    const assignedActivities = allActivities.filter((a) => a.assigneeId === ctx.supervisorId && a.level === 'L6')
    return analyzeReport(rawText, {
      projectId: ctx.projectId,
      supervisorId: ctx.supervisorId,
      source: ctx.source,
      assignedActivities,
      allActivities,
      language: ctx.language,
    })
  },
}

export function getUsers(): Promise<User[]> {
  return Promise.resolve(getDb().users)
}

export function getUser(id: string): User | undefined {
  return getDb().users.find((u) => u.id === id)
}

export function updateUserLanguage(id: string, lang: 'en' | 'hi'): void {
  const user = getUser(id)
  if (user) {
    user.preferredLanguage = lang
    persist()
  }
}

export function getProjects(): Promise<Project[]> {
  const db = getDb()
  const l6 = db.activities.filter((a) => a.level === 'L6')
  return Promise.resolve(
    db.projects.map((p) => {
      const projectL6 = l6.filter((a) => a.projectId === p.id)
      const completed = projectL6.filter((a) => a.status === 'COMPLETED').length
      return { ...p, progress: projectL6.length ? Math.round((completed / projectL6.length) * 100) : 0 }
    })
  )
}

export function getProject(id: string): Project | undefined {
  return getDb().projects.find((p) => p.id === id)
}

export function createProject(input: NewProjectInput): Promise<Project> {
  const db = getDb()
  const project: Project = {
    id: uid('p'),
    name: input.name,
    code: input.code,
    client: input.client,
    location: input.location,
    disciplines: input.disciplines,
    startDate: input.startDate,
    plannedEnd: input.plannedEnd,
    status: 'ACTIVE',
    createdAt: todayIso(),
  }
  db.projects.push(project)
  pushAudit('u-mgr-01', 'PROJECT_CREATED', 'Project', project.id, { project: project.name })
  persist()
  return Promise.resolve(project)
}

export function uploadSchedule(projectId: string, fileName: string): Promise<{ activityCount: number; levelCounts: Record<string, number>; disciplines: string[] }> {
  const db = getDb()
  const project = getProject(projectId)
  if (!project) throw new Error('Project not found')
  const activities = generateSchedule(project)
  activities.forEach((a) => db.activities.push(a))
  project.scheduleFileName = fileName
  project.scheduleUploadedAt = todayIso()
  pushAudit('u-mgr-01', 'SCHEDULE_UPLOADED', 'Project', projectId, { file: fileName, count: activities.length })
  persist()
  const levelCounts: Record<string, number> = {}
  activities.forEach((a) => {
    levelCounts[a.level] = (levelCounts[a.level] || 0) + 1
  })
  return Promise.resolve({
    activityCount: activities.length,
    levelCounts,
    disciplines: Array.from(new Set(activities.map((a) => a.discipline).filter((d): d is Discipline => Boolean(d)))),
  })
}

export function getActivities(projectId: string): Promise<ScheduleActivity[]> {
  return Promise.resolve(getDb().activities.filter((a) => a.projectId === projectId))
}

export function getActivity(projectId: string, id: string): ScheduleActivity | undefined {
  return getDb().activities.find((a) => a.id === id && a.projectId === projectId)
}

export function getAssignments(projectId: string): Promise<Assignment[]> {
  return Promise.resolve(getDb().assignments.filter((a) => a.projectId === projectId))
}

export function createAssignment(payload: {
  projectId: string
  workPackageId: string
  supervisorId: string
  includedL6Ids: string[]
  instructions?: string
}): Promise<Assignment> {
  const db = getDb()
  const existing = db.assignments.find(
    (a) => a.projectId === payload.projectId && a.workPackageId === payload.workPackageId && a.status === 'ACTIVE'
  )
  if (existing) {
    existing.supervisorId = payload.supervisorId
    existing.includedL6Ids = payload.includedL6Ids
    existing.instructions = payload.instructions
  } else {
    db.assignments.push({
      id: uid('a'),
      ...payload,
      assignedAt: todayIso(),
      status: 'ACTIVE',
    })
  }
  const supervisor = getUser(payload.supervisorId)
  const pkg = db.activities.find((a) => a.id === payload.workPackageId)
  db.activities.forEach((a) => {
    if (payload.includedL6Ids.includes(a.id)) a.assigneeId = payload.supervisorId
  })
  pushAudit('u-mgr-01', 'WORK_ASSIGNED', 'Assignment', payload.workPackageId, {
    package: pkg?.name ?? payload.workPackageId,
    supervisor: supervisor?.name ?? payload.supervisorId,
  })
  persist()
  return delay(300).then(() => db.assignments.find((a) => a.workPackageId === payload.workPackageId && a.status === 'ACTIVE')!)
}

export function unassign(assignmentId: string): Promise<void> {
  const db = getDb()
  const asgn = db.assignments.find((a) => a.id === assignmentId)
  if (!asgn) return Promise.resolve()
  asgn.status = 'COMPLETED'
  asgn.includedL6Ids.forEach((id) => {
    const act = db.activities.find((a) => a.id === id)
    if (act && act.assigneeId === asgn.supervisorId) act.assigneeId = undefined
  })
  persist()
  return Promise.resolve()
}

export function getSupervisorWork(supervisorId: string): Promise<ScheduleActivity[]> {
  return Promise.resolve(getDb().activities.filter((a) => a.assigneeId === supervisorId && a.level === 'L6'))
}

export function getSupervisorReports(supervisorId: string): Promise<DailyReport[]> {
  return Promise.resolve(getDb().reports.filter((r) => r.supervisorId === supervisorId).sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)))
}

export function getReports(projectId: string): Promise<DailyReport[]> {
  return Promise.resolve(getDb().reports.filter((r) => r.projectId === projectId).sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)))
}

export async function submitReport(payload: {
  projectId: string
  supervisorId: string
  source: ReportSource
  rawContent: string
  fileName?: string
  entries: PreviewEntry[]
}): Promise<DailyReport> {
  const db = getDb()
  const reportId = uid('r')
  const now = new Date().toISOString()
  const reportDate = todayIso()

  const entries: ReportEntry[] = payload.entries.map((e) => ({
    id: uid('re'),
    reportId,
    extractedText: e.extractedText,
    status: e.status,
    actualStart: e.actualStart,
    actualEnd: e.actualEnd,
    delayReason: e.delayReason,
    delayText: e.delayText,
  }))

  const report: DailyReport = {
    id: reportId,
    projectId: payload.projectId,
    supervisorId: payload.supervisorId,
    reportDate,
    submittedAt: now,
    source: payload.source,
    rawContent: payload.rawContent,
    fileName: payload.fileName,
    entries,
  }

  db.reports.push(report)

  let autoCount = 0
  let flaggedCount = 0

  payload.entries.forEach((preview, idx) => {
    const entry = entries[idx]
    const match: AiMatchResult = {
      id: uid('aim'),
      reportEntryId: entry.id,
      reportId,
      projectId: payload.projectId,
      extractedActivity: preview.extractedText,
      matchedActivityId: preview.matchedActivityId,
      matchedActivityName: preview.matchedActivityName,
      status: preview.status,
      actualStart: preview.actualStart,
      actualEnd: preview.actualEnd,
      delayReason: preview.delayReason,
      delayText: preview.delayText,
      confidence: preview.confidence,
      band: preview.band,
      keywords: preview.keywords,
      candidates: preview.candidates,
      source: payload.source,
      createdAt: now,
      decision: preview.band === 'AUTO' ? 'AUTO_APPROVED' : 'PENDING',
    }
    db.aiMatches.push(match)

    if (preview.band === 'AUTO' && entry.status) {
      autoCount++
      applyActivityUpdate(entry.status, preview, payload.supervisorId)
      const act = db.activities.find((a) => a.id === preview.matchedActivityId)
      pushAudit(payload.supervisorId, 'AI_AUTO_APPROVED', 'AiMatch', match.id, {
        extracted: preview.extractedText.slice(0, 60),
        activity: act?.name ?? preview.matchedActivityName ?? '',
        confidence: preview.confidence,
      })
    } else {
      flaggedCount++
    }
  })

  recomputeRollups(db.activities)

  const supervisor = getUser(payload.supervisorId)
  pushAudit(payload.supervisorId, 'REPORT_SUBMITTED', 'Report', reportId, {
    supervisor: supervisor?.name ?? payload.supervisorId,
    source: payload.source,
  })
  pushAudit(payload.supervisorId, 'AI_PROCESSED', 'Report', reportId, { matched: autoCount, flagged: flaggedCount })
  persist()
  return report
}

function applyActivityUpdate(status: ActivityStatus, preview: ActivityUpdateInput, actorId: string) {
  const db = getDb()
  const activity = db.activities.find((a) => a.id === preview.matchedActivityId)
  if (!activity) return
  activity.status = status
  activity.lastReportedAt = new Date().toISOString()
  if (status === 'COMPLETED') {
    activity.progressPct = 100
    activity.actualEnd = todayIso()
    if (!activity.actualStart) activity.actualStart = activity.plannedStart
  }
  if (status === 'IN_PROGRESS') {
    activity.progressPct = Math.max(activity.progressPct, 40)
    activity.actualStart = activity.actualStart ?? todayIso()
  }
  if (status === 'DELAYED') {
    activity.progressPct = activity.progressPct || 0
    activity.actualStart = activity.actualStart ?? todayIso()
    const existing = db.delays.find((d) => d.activityId === activity.id && d.status === 'OPEN')
    if (!existing) {
      db.delays.push({
        id: uid('d'),
        projectId: activity.projectId,
        activityId: activity.id,
        reasonCode: preview.delayReason ?? 'OTHER',
        reasonText: preview.delayText,
        reportedAt: new Date().toISOString(),
        status: 'OPEN',
        daysImpact: 0,
      })
      pushAudit(actorId, 'DELAY_REPORTED', 'Delay', activity.id, {
        activity: activity.name,
        reason: preview.delayReason ?? 'OTHER',
      })
    }
  }
}

export function getReconciliationQueue(projectId: string): Promise<AiMatchResult[]> {
  return Promise.resolve(
    getDb()
      .aiMatches.filter((m) => m.projectId === projectId && m.decision === 'PENDING')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  )
}

export function getAutoApprovedLog(projectId: string): Promise<AiMatchResult[]> {
  return Promise.resolve(
    getDb()
      .aiMatches.filter((m) => m.projectId === projectId && m.decision !== 'PENDING')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  )
}

export function decideMatch(
  matchId: string,
  action: 'ACCEPT' | 'CORRECT' | 'LINK' | 'ASK',
  actorId: string,
  options: { activityId?: string; question?: string } = {}
): Promise<void> {
  const db = getDb()
  const match = db.aiMatches.find((m) => m.id === matchId)
  if (!match) return Promise.resolve()

  const now = new Date().toISOString()
  match.decidedAt = now
  match.decidedBy = actorId

  if (action === 'ACCEPT') {
    match.decision = 'ACCEPTED'
    if (match.status) {
      applyActivityUpdate(match.status, { matchedActivityId: match.matchedActivityId, status: match.status, delayReason: match.delayReason, delayText: match.delayText }, actorId)
      pushAudit(actorId, 'AI_REVIEW_ACCEPTED', 'AiMatch', match.id, { activity: match.matchedActivityName ?? match.matchedActivityId ?? '' })
    }
  }

  if ((action === 'CORRECT' || action === 'LINK') && options.activityId) {
    match.decision = action === 'CORRECT' ? 'CORRECTED' : 'LINKED'
    match.matchedActivityId = options.activityId
    const act = db.activities.find((a) => a.id === options.activityId)
    match.matchedActivityName = act?.name ?? options.activityId
    if (match.status) {
      applyActivityUpdate(match.status, { matchedActivityId: options.activityId, status: match.status, delayReason: match.delayReason, delayText: match.delayText }, actorId)
      pushAudit(actorId, match.decision === 'CORRECTED' ? 'AI_CORRECTED' : 'AI_LINKED', 'AiMatch', match.id, {
        activity: act?.name ?? options.activityId,
      })
    }
  }

  if (action === 'ASK' && options.question) {
    match.decision = 'ASKED'
    const report = db.reports.find((r) => r.id === match.reportId)
    const supervisorId = report?.supervisorId ?? 'u-sup-01'
    const targetActivityId = options.activityId ?? match.matchedActivityId ?? match.candidates[0]?.activityId ?? ''
    const thread = createThread(match.projectId, targetActivityId, supervisorId, actorId, options.question, match.extractedActivity)
    pushAudit(actorId, 'AI_ASKED', 'AiMatch', match.id, { supervisor: getUser(supervisorId)?.name ?? supervisorId })
    pushAudit(actorId, 'QUESTION_ASKED', 'Thread', thread.id, { activity: targetActivityId })
  }

  recomputeRollups(db.activities)
  persist()
  return Promise.resolve()
}

export function getThreads(projectId: string): Promise<ConversationThread[]> {
  return Promise.resolve(getDb().threads.filter((t) => t.projectId === projectId).sort((a, b) => lastMessageTime(b) - lastMessageTime(a)))
}

export function getSupervisorThreads(supervisorId: string): Promise<ConversationThread[]> {
  return Promise.resolve(getDb().threads.filter((t) => t.supervisorId === supervisorId).sort((a, b) => lastMessageTime(b) - lastMessageTime(a)))
}

export function getThread(id: string): ConversationThread | undefined {
  return getDb().threads.find((t) => t.id === id)
}

export function askQuestion(projectId: string, activityId: string, supervisorId: string, actorId: string, text: string): Promise<ConversationThread> {
  const thread = createThread(projectId, activityId, supervisorId, actorId, text)
  pushAudit(actorId, 'QUESTION_ASKED', 'Thread', thread.id, { activity: activityId })
  persist()
  return Promise.resolve(thread)
}

function createThread(
  projectId: string,
  activityId: string,
  supervisorId: string,
  openedBy: string,
  text: string,
  subject?: string
): ConversationThread {
  const db = getDb()
  const now = new Date().toISOString()
  const activity = db.activities.find((a) => a.id === activityId)
  const threadId = uid('t')
  const thread: ConversationThread = {
    id: threadId,
    projectId,
    activityId: activityId || null,
    supervisorId,
    openedBy,
    subject: subject ?? activity?.name ?? 'General question',
    status: 'OPEN',
    createdAt: now,
    messages: [
      {
        id: uid('m'),
        threadId,
        senderId: openedBy,
        text,
        sentAt: now,
      },
    ],
  }
  db.threads.push(thread)
  persist()
  return thread
}

export function sendMessage(threadId: string, senderId: string, text: string): Promise<Message> {
  const db = getDb()
  const thread = db.threads.find((t) => t.id === threadId)
  if (!thread) throw new Error('Thread not found')
  const message: Message = {
    id: uid('m'),
    threadId,
    senderId,
    text,
    sentAt: new Date().toISOString(),
  }
  thread.messages.push(message)
  pushAudit(senderId, 'REPLY_SENT', 'Thread', threadId, { actor: getUser(senderId)?.name ?? senderId })
  persist()
  return Promise.resolve(message)
}

export function resolveThread(threadId: string, actorId: string): Promise<void> {
  const db = getDb()
  const thread = db.threads.find((t) => t.id === threadId)
  if (!thread) return Promise.resolve()
  thread.status = thread.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED'
  if (thread.status === 'RESOLVED') {
    pushAudit(actorId, 'THREAD_RESOLVED', 'Thread', threadId, {})
  }
  persist()
  return Promise.resolve()
}

export function getDelays(projectId: string): Promise<DelayEvent[]> {
  return Promise.resolve(getDb().delays.filter((d) => d.projectId === projectId).sort((a, b) => +new Date(b.reportedAt) - +new Date(a.reportedAt)))
}

export function getAudit(): Promise<AuditEvent[]> {
  const events = getDb().audit
  return Promise.resolve(events.slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)))
}

export function getInsights(): Promise<InsightAggregate> {
  return Promise.resolve(getDb().insights)
}

export function getDashboard(projectId: string): Promise<DashboardData> {
  const db = getDb()
  const project = getProject(projectId)
  if (!project) throw new Error('Project not found')

  const l6 = db.activities.filter((a) => a.projectId === projectId && a.level === 'L6')
  const total = l6.length || 1
  const completed = l6.filter((a) => a.status === 'COMPLETED').length
  const overallProgress = Math.round(l6.reduce((sum, a) => sum + a.progressPct, 0) / total)
  const plannedProgress = Math.round((l6.filter((a) => parseIso(a.plannedEnd).getTime() <= new Date().getTime()).length / total) * 100)

  const openDelays = db.delays.filter((d) => d.projectId === projectId && d.status === 'OPEN').length
  const pendingReviews = db.aiMatches.filter((m) => m.projectId === projectId && m.decision === 'PENDING').length
  const awaitingReply = db.threads.filter((t) => t.projectId === projectId && t.status === 'OPEN' && lastSenderIs(t, 'manager')).length
  const daysRemaining = Math.max(0, Math.round((parseIso(project.plannedEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))

  const disciplineProgress = Array.from(new Set(l6.map((a) => a.discipline).filter((d): d is Discipline => Boolean(d)))).map((disc) => {
    const group = l6.filter((a) => a.discipline === disc)
    const planned = Math.round((group.filter((a) => parseIso(a.plannedEnd).getTime() <= new Date().getTime()).length / group.length) * 100)
    return {
      discipline: disc,
      progress: Math.round(group.reduce((sum, a) => sum + a.progressPct, 0) / group.length),
      planned,
      colorClass: disciplineColor(disc),
    }
  })

  const delayedActivities = l6
    .filter((a) => a.status === 'DELAYED')
    .map((a) => {
      const delay = db.delays.find((d) => d.activityId === a.id && d.status === 'OPEN')
      return {
        activity: a,
        daysLate: delay ? daysSince(delay.reportedAt) : 0,
        reason: delay?.reasonCode,
      }
    })

  const recentAudit = db.audit.slice(0, 8)
  const progressTrend = buildProgressTrend(l6, project)

  return Promise.resolve({
    overallProgress,
    plannedProgress,
    completedCount: completed,
    totalCount: total,
    openDelays,
    pendingReviews,
    awaitingReply,
    daysRemaining,
    disciplineProgress,
    delayedActivities,
    recentAudit,
    progressTrend,
  })
}

function buildProgressTrend(l6: ScheduleActivity[], project: Project): { label: string; planned: number; actual: number }[] {
  const months: string[] = []
  const start = parseIso(project.startDate)
  const end = parseIso(project.plannedEnd)
  let cursor = new Date(start)
  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const now = new Date().getTime()
  return months.map((m) => {
    const monthEnd = new Date(new Date(m).getFullYear(), new Date(m).getMonth() + 1, 0).getTime()
    const planned = Math.round((l6.filter((a) => parseIso(a.plannedEnd).getTime() <= monthEnd).length / l6.length) * 100)
    const actual = monthEnd <= now ? Math.round((l6.filter((a) => a.status === 'COMPLETED' && parseIso(a.actualEnd || a.plannedEnd).getTime() <= monthEnd).length / l6.length) * 100) : 0
    return { label: monthLabel(m, 'en'), planned, actual }
  })
}

export function getAtRiskActivities(projectId: string): Promise<{ activity: ScheduleActivity; reason: 'stale' | 'deadline' }[]> {
  const db = getDb()
  const l6 = db.activities.filter((a) => a.projectId === projectId && a.level === 'L6')
  const now = new Date().getTime()
  const result: { activity: ScheduleActivity; reason: 'stale' | 'deadline' }[] = []
  l6.forEach((a) => {
    if (a.status === 'COMPLETED' || a.status === 'NOT_STARTED') return
    const plannedEnd = parseIso(a.plannedEnd).getTime()
    const daysLeft = Math.round((plannedEnd - now) / (1000 * 60 * 60 * 24))
    if (a.status === 'IN_PROGRESS' && a.lastReportedAt && daysSince(a.lastReportedAt) > APP_CONFIG.STALE_DAYS) {
      result.push({ activity: a, reason: 'stale' })
    } else if (daysLeft <= APP_CONFIG.RISK_NEAR_DAYS && daysLeft >= 0 && a.progressPct < 60) {
      result.push({ activity: a, reason: 'deadline' })
    }
  })
  return Promise.resolve(result)
}

export function resetDemo(): void {
  resetDb()
}

function pushAudit(actorId: string, action: AuditEvent['action'], entityType: string, entityId: string, params: Record<string, string | number>) {
  const db = getDb()
  db.audit.push({
    id: uid('ae'),
    actorId,
    action,
    entityType,
    entityId,
    descriptionParams: params,
    timestamp: new Date().toISOString(),
  })
}

function lastMessageTime(thread: ConversationThread): number {
  const last = thread.messages[thread.messages.length - 1]
  return last ? new Date(last.sentAt).getTime() : new Date(thread.createdAt).getTime()
}

function lastSenderIs(thread: ConversationThread, role: 'manager' | 'supervisor'): boolean {
  const last = thread.messages[thread.messages.length - 1]
  if (!last) return false
  const user = getUser(last.senderId)
  return user?.role === role
}

function daysSince(iso: string): number {
  return Math.floor((new Date().getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function disciplineColor(disc: string | null): string {
  switch (disc) {
    case 'CIVIL':
      return 'bg-amber-500'
    case 'PIPING':
      return 'bg-sky-500'
    case 'ELECTRICAL':
      return 'bg-yellow-500'
    case 'INSTRUMENTATION':
      return 'bg-violet-500'
    case 'EQUIPMENT':
      return 'bg-orange-500'
    case 'HSE':
      return 'bg-emerald-500'
    default:
      return 'bg-slate-500'
  }
}
