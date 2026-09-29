import type {
  User,
  Project,
  ScheduleActivity,
  Assignment,
  DailyReport,
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
  Worker,
  WorkerAttendance,
  WorkerAttendanceStatus,
  WorkerDashboardData,
  WorkerTaskAssignment,
  ReallocationResult,
  CandidateActivity,
} from '../types/domain'
import { getDb } from '../mocks/db'
import { analyzeReport } from '../mocks/aiEngine'
import { uid } from '../utils/ids'
import { APP_CONFIG } from '../config/constants'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1'
const BACKEND_ANALYZE = (import.meta.env.VITE_USE_BACKEND as string | undefined) !== 'false'
const TOKEN_KEY = 'oilsetu-token'

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } })
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      detail = ''
    }
    throw new ApiError(res.status, detail || `Request failed with status ${res.status}`)
  }
  return (await res.json()) as T
}

const userCache = new Map<string, User>()
const activityCache = new Map<string, ScheduleActivity[]>()

export async function getUsers(): Promise<User[]> {
  const users = await apiFetch<User[]>('/users')
  userCache.clear()
  users.forEach((u) => userCache.set(u.id, u))
  return users
}

export function getUser(id: string): User | undefined {
  return userCache.get(id)
}

export async function loginWithPassword(email: string, password: string): Promise<{ token: string; user: User }> {
  const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAuthToken(data.token)
  userCache.set(data.user.id, data.user)
  return data
}

export async function loginAsDemo(userId: string): Promise<{ token: string; user: User }> {
  const data = await apiFetch<{ token: string; user: User }>('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  setAuthToken(data.token)
  userCache.set(data.user.id, data.user)
  return data
}

export async function fetchMe(): Promise<User | null> {
  try {
    const user = await apiFetch<User>('/auth/me')
    userCache.set(user.id, user)
    return user
  } catch {
    return null
  }
}

export function updateUserLanguage(id: string, lang: 'en' | 'hi'): void {
  apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ preferredLanguage: lang }) }).catch(() => {})
}

export async function getProjects(): Promise<(Project & { progress: number })[]> {
  return apiFetch('/projects')
}

export async function getProject(id: string): Promise<Project | undefined> {
  try {
    return await apiFetch(`/projects/${id}`)
  } catch {
    return undefined
  }
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  return apiFetch('/projects', { method: 'POST', body: JSON.stringify(input) })
}

export async function uploadSchedule(
  projectId: string,
  file: File
): Promise<{ activityCount: number; levelCounts: Record<string, number>; disciplines: string[] }> {
  const token = getAuthToken()
  if (file.size === 0) {
    return apiFetch(`/projects/${projectId}/schedule/generate`, { method: 'POST' })
  }
  const form = new FormData()
  form.append('file', file)
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/projects/${projectId}/schedule/import`, { method: 'POST', headers, body: form })
  if (!res.ok) throw new ApiError(res.status, `Schedule import failed with status ${res.status}`)
  return (await res.json()) as { activityCount: number; levelCounts: Record<string, number>; disciplines: string[] }
}

export async function getActivities(projectId: string): Promise<ScheduleActivity[]> {
  const acts = await apiFetch<ScheduleActivity[]>(`/activities?project_id=${encodeURIComponent(projectId)}`)
  activityCache.set(projectId, acts)
  return acts
}

export function getActivity(projectId: string, id: string): ScheduleActivity | undefined {
  return (activityCache.get(projectId) ?? []).find((a) => a.id === id)
}

export async function getAssignments(projectId: string): Promise<Assignment[]> {
  return apiFetch(`/assignments?project_id=${encodeURIComponent(projectId)}`)
}

export async function createAssignment(payload: {
  projectId: string
  workPackageId: string
  supervisorId: string
  includedL6Ids: string[]
  instructions?: string
}): Promise<Assignment> {
  return apiFetch('/assignments', { method: 'POST', body: JSON.stringify(payload) })
}

export async function unassign(assignmentId: string): Promise<void> {
  await apiFetch(`/assignments/${assignmentId}`, { method: 'DELETE' })
}

export async function getSupervisorWork(supervisorId: string): Promise<ScheduleActivity[]> {
  return apiFetch(`/work?supervisor_id=${encodeURIComponent(supervisorId)}`)
}

export async function getWorkers(projectId: string, attendanceDate?: string): Promise<Worker[]> {
  const date = attendanceDate ? `&attendance_date=${encodeURIComponent(attendanceDate)}` : ''
  return apiFetch(`/workers?project_id=${encodeURIComponent(projectId)}${date}`)
}

export async function getWorkerAssignments(projectId: string, workerId?: string): Promise<WorkerTaskAssignment[]> {
  const worker = workerId ? `&worker_id=${encodeURIComponent(workerId)}` : ''
  return apiFetch(`/worker-assignments?project_id=${encodeURIComponent(projectId)}${worker}`)
}

export async function assignWorkerTask(payload: {
  projectId: string
  activityId: string
  workerId: string
}): Promise<WorkerTaskAssignment> {
  return apiFetch('/worker-assignments', { method: 'POST', body: JSON.stringify(payload) })
}

export async function markWorkerAttendance(payload: {
  projectId: string
  workerId?: string
  date: string
  status: WorkerAttendanceStatus
  reason?: string
}): Promise<{ attendance: WorkerAttendance; reallocations: { activityId: string; activityName: string; fromWorkerId: string; toWorkerId: string | null; toWorkerName?: string; status: string; reason: string }[] }> {
  return apiFetch('/worker-attendance', { method: 'POST', body: JSON.stringify(payload) })
}

export async function getWorkerDashboard(projectId: string): Promise<WorkerDashboardData> {
  return apiFetch(`/workers/me/dashboard?project_id=${encodeURIComponent(projectId)}`)
}

export async function getWorkerProjects(): Promise<string[]> {
  const data = await apiFetch<{ projectIds: string[] }>('/workers/me/projects')
  return data.projectIds
}

export async function getSupervisorReports(supervisorId: string): Promise<DailyReport[]> {
  return apiFetch(`/reports?supervisor_id=${encodeURIComponent(supervisorId)}`)
}

export async function getReports(projectId: string): Promise<DailyReport[]> {
  return apiFetch(`/reports?project_id=${encodeURIComponent(projectId)}`)
}

export async function submitReport(payload: {
  projectId: string
  supervisorId: string
  source: ReportSource
  rawContent: string
  fileName?: string
  absentWorkerIds?: string[]
  absenceDate?: string
  absenceReason?: string
  entries: PreviewEntry[]
}): Promise<DailyReport & { reallocations?: ReallocationResult[] }> {
  return apiFetch('/reports', { method: 'POST', body: JSON.stringify(payload) })
}

export async function getReconciliationQueue(projectId: string): Promise<AiMatchResult[]> {
  return apiFetch(`/reconciliation/queue?project_id=${encodeURIComponent(projectId)}`)
}

export async function getAutoApprovedLog(projectId: string): Promise<AiMatchResult[]> {
  return apiFetch(`/reconciliation/auto-log?project_id=${encodeURIComponent(projectId)}`)
}

export async function decideMatch(
  matchId: string,
  action: 'ACCEPT' | 'CORRECT' | 'LINK' | 'ASK',
  _actorId: string,
  options: { activityId?: string; question?: string } = {}
): Promise<void> {
  await apiFetch(`/reconciliation/${matchId}/decide`, { method: 'POST', body: JSON.stringify({ action, ...options }) })
}

export async function getThreads(projectId: string): Promise<ConversationThread[]> {
  return apiFetch(`/threads?project_id=${encodeURIComponent(projectId)}`)
}

export async function getSupervisorThreads(supervisorId: string): Promise<ConversationThread[]> {
  return apiFetch(`/threads?supervisor_id=${encodeURIComponent(supervisorId)}`)
}

export async function getThread(id: string): Promise<ConversationThread> {
  return apiFetch(`/threads/${id}`)
}

export async function askQuestion(
  projectId: string,
  activityId: string,
  supervisorId: string,
  _actorId: string,
  text: string
): Promise<ConversationThread> {
  return apiFetch('/threads', { method: 'POST', body: JSON.stringify({ projectId, activityId, supervisorId, text }) })
}

export async function sendMessage(threadId: string, _senderId: string, text: string): Promise<Message> {
  return apiFetch(`/threads/${threadId}/messages`, { method: 'POST', body: JSON.stringify({ text }) })
}

export async function resolveThread(threadId: string, _actorId: string): Promise<void> {
  await apiFetch(`/threads/${threadId}/resolve`, { method: 'PATCH' })
}

export async function getDelays(projectId: string): Promise<DelayEvent[]> {
  return apiFetch(`/delays?project_id=${encodeURIComponent(projectId)}`)
}

export async function getAudit(): Promise<AuditEvent[]> {
  return apiFetch('/audit')
}

export async function getInsights(): Promise<InsightAggregate> {
  return apiFetch('/insights')
}

export async function getDashboard(projectId: string): Promise<DashboardData> {
  return apiFetch(`/dashboard/${projectId}`)
}

export async function getAtRiskActivities(projectId: string): Promise<{ activity: ScheduleActivity; reason: 'stale' | 'deadline' }[]> {
  return apiFetch(`/delays/at-risk?project_id=${encodeURIComponent(projectId)}`)
}

export async function resetDemo(): Promise<void> {
  await apiFetch('/dev/reset', { method: 'POST' })
}

const BACKEND_URL = API_BASE.replace(/\/api\/v1$/, '')

let backendHealth: { up: boolean; at: number } | null = null

async function isBackendUp(): Promise<boolean> {
  if (backendHealth && Date.now() - backendHealth.at < 60000) return backendHealth.up
  try {
    const res = await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(5000) })
    backendHealth = { up: res.ok, at: Date.now() }
  } catch {
    backendHealth = { up: false, at: Date.now() }
  }
  return backendHealth.up
}

interface BackendAnalyzeCandidate {
  activityId: string
  name: string
  discipline: null
  confidence: number
}

interface BackendAnalyzeEntry {
  extractedText: string
  matchedActivityId: string | null
  matchedActivityName?: string
  status: ActivityStatus | null
  actualStart?: string
  actualEnd?: string
  delayReason?: DelayReasonCode | null
  delayText?: string
  confidence: number
  keywords: string[]
  candidates: BackendAnalyzeCandidate[]
}

function bandFor(pct: number): PreviewEntry['band'] {
  return pct >= APP_CONFIG.CONFIDENCE_AUTO ? 'AUTO' : pct >= APP_CONFIG.CONFIDENCE_REVIEW ? 'REVIEW' : 'UNMATCHED'
}

async function analyzeWithBackend(rawText: string): Promise<PreviewEntry[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_text: rawText }),
      signal: AbortSignal.timeout(180000),
    })
    if (!res.ok) return null
    const d = (await res.json()) as { entries?: BackendAnalyzeEntry[] }
    if (!Array.isArray(d.entries)) return null
    return d.entries
      .filter((e) => e && typeof e.extractedText === 'string' && typeof e.confidence === 'number')
      .map((e) => ({
        tempId: uid('p'),
        extractedText: e.extractedText,
        matchedActivityId: e.matchedActivityId ?? null,
        matchedActivityName: e.matchedActivityName,
        status: e.status ?? null,
        actualStart: e.actualStart,
        actualEnd: e.actualEnd,
        delayReason: e.delayReason ?? null,
        delayText: e.delayText,
        confidence: e.confidence,
        band: bandFor(e.confidence),
        keywords: Array.isArray(e.keywords) ? e.keywords : [],
        candidates: Array.isArray(e.candidates) ? e.candidates : [],
      }))
  } catch {
    return null
  }
}

async function refreshWithBackend(entries: PreviewEntry[]): Promise<PreviewEntry[]> {
  const settled = await Promise.allSettled(
    entries.map(async (e) => {
      const res = await fetch(`${BACKEND_URL}/api/v1/execution-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_description: e.extractedText,
          discipline: 'General',
          asset_id: e.matchedActivityId ?? '',
          actual_start: e.actualStart ?? null,
          actual_end: e.actualEnd ?? null,
          status: (e.status && FRONT_STATUS_TO_BACKEND[e.status]) || 'Unknown',
          source: 'DPR',
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return e
      const d = (await res.json()) as BackendExecutionResponse
      if (!d.matched_schedule_activity_id || typeof d.confidence_score !== 'number') return e
      const pct = Math.round(d.confidence_score * 100)
      const band: PreviewEntry['band'] = bandFor(pct)
      return {
        ...e,
        matchedActivityId: d.matched_schedule_activity_id,
        matchedActivityName: d.matched_activity_description ?? e.matchedActivityName,
        confidence: pct,
        band,
        candidates: (d.top_matches ?? []).map((m) => ({
          activityId: m.schedule_activity_id,
          name: m.activity_description,
          discipline: null,
          confidence: Math.round(m.score * 100),
        })),
      }
    })
  )
  return settled.map((r, i) => (r.status === 'fulfilled' ? r.value : entries[i]))
}

const FRONT_STATUS_TO_BACKEND: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  DELAYED: 'Delayed',
  ON_HOLD: 'On Hold',
}

interface BackendTopMatch {
  schedule_activity_id: string
  activity_description: string
  score: number
}

interface BackendExecutionResponse {
  matched_schedule_activity_id: string | null
  matched_activity_description: string | null
  confidence_score: number | null
  top_matches: BackendTopMatch[]
}

export interface PipelineRiskInsight {
  type: string
  severity: string
  message: string
  reason?: string
  action?: string
  affected_activity_id?: string
  affected_activity_name?: string
}

interface PipelineActivity {
  activity_description: string
  discipline: string
  asset_id: string | null
  actual_start: string | null
  actual_end: string | null
  status: string
  percent_complete: number | null
  delay_reason: string | null
  source: string
  evidence: string
  confidence: number
  normalized_term_applied: string | null
  matched_activity_id: string
  matcher_score: number | null
  near_match: { activity_id: string; name: string | null; score: number | null } | null
}

interface PipelineResponse {
  filename: string
  source: string
  extracted_text: string
  transcribed_text?: string
  ai_result: { activities: PipelineActivity[]; predicted_risks: PipelineRiskInsight[] }
}

export interface VisualProofResult {
  activity_id: string
  photo_verified: boolean
  visual_match_confidence: number
  status: string
  reason: string
}

async function postForm<T>(path: string, form: FormData, base = API_BASE, timeoutMs = 240000): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { detail?: unknown }
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? '')
    } catch {
      detail = ''
    }
    throw new ApiError(res.status, detail || `Request failed with status ${res.status}`)
  }
  return (await res.json()) as T
}

export async function uploadVisualProof(activityId: string, file: Blob): Promise<{ activity_id: string; photo_path: string }> {
  const form = new FormData()
  form.append('activity_id', activityId)
  form.append('file', file, (file as File).name || 'photo.jpg')
  return postForm('/visual-proof/upload', form, BACKEND_URL, 60000)
}

export async function verifyVisualProof(activityId: string): Promise<VisualProofResult> {
  const form = new FormData()
  form.append('activity_id', activityId)
  return postForm('/visual-proof/verify', form, BACKEND_URL, 120000)
}

const PIPELINE_STATUS_MAP: Record<string, ActivityStatus | null> = {
  Completed: 'COMPLETED',
  'In Progress': 'IN_PROGRESS',
  'Partially Completed': 'IN_PROGRESS',
  'Not Started': 'NOT_STARTED',
  Delayed: 'DELAYED',
  Unknown: null,
}

function delayCodeFromText(text: string | null): DelayReasonCode {
  if (!text) return 'OTHER'
  const s = text.toLowerCase()
  if (/material|deliver|supply|procure|vendor/.test(s)) return 'MATERIAL'
  if (/manpower|labou?r|worker|staff|gang/.test(s)) return 'MANPOWER'
  if (/equipment|machine|crane|tool|vehicle/.test(s)) return 'EQUIPMENT'
  if (/weather|rain|heat|storm|flood/.test(s)) return 'WEATHER'
  if (/design|drawing|revis|change order/.test(s)) return 'DESIGN_CHANGE'
  if (/permit|approval|clearance|authorization/.test(s)) return 'PERMIT'
  if (/frontend|front-end|previous activity|upstream/.test(s)) return 'FRONTEND'
  return 'OTHER'
}

async function activityLookup(projectId: string): Promise<Map<string, ScheduleActivity>> {
  let acts: ScheduleActivity[]
  try {
    acts = await getActivities(projectId)
  } catch {
    acts = getDb().activities.filter((a) => a.projectId === projectId)
  }
  return new Map(acts.map((a) => [a.id, a]))
}

function mapPipelineActivities(list: PipelineActivity[], lookup: Map<string, ScheduleActivity>): PreviewEntry[] {
  return list.map((a) => {
    const matched = a.matched_activity_id && a.matched_activity_id !== 'UNMATCHED_NEW_ACTIVITY' ? a.matched_activity_id : null
    const confidence = Math.round((a.matcher_score ?? 0) * 100)
    const act = matched ? lookup.get(matched) : undefined
    const status = a.status in PIPELINE_STATUS_MAP ? PIPELINE_STATUS_MAP[a.status] : null
    const candidates: CandidateActivity[] = []
    if (matched && act) candidates.push({ activityId: act.id, name: act.name, discipline: act.discipline, confidence })
    if (a.near_match?.activity_id && typeof a.near_match.score === 'number') {
      candidates.push({
        activityId: a.near_match.activity_id,
        name: a.near_match.name ?? a.near_match.activity_id,
        discipline: null,
        confidence: Math.round(a.near_match.score * 100),
      })
    }
    return {
      tempId: uid('p'),
      extractedText: a.activity_description,
      matchedActivityId: matched,
      matchedActivityName: act?.name,
      status,
      actualStart: a.actual_start ?? undefined,
      actualEnd: a.actual_end ?? undefined,
      delayReason: status === 'DELAYED' ? delayCodeFromText(a.delay_reason) : null,
      delayText: a.delay_reason ?? undefined,
      confidence,
      band: bandFor(confidence),
      keywords: [a.discipline, a.asset_id, a.normalized_term_applied].filter((k): k is string => Boolean(k)),
      candidates,
    }
  })
}

async function postPipelineFile(kind: 'txt' | 'docx' | 'voice', blob: Blob, filename: string): Promise<PipelineResponse> {
  const form = new FormData()
  form.append('file', blob, filename)
  return postForm(`/reports/upload-${kind}`, form)
}

export interface PipelineRun {
  entries: PreviewEntry[]
  risks: PipelineRiskInsight[]
  extractedText: string
}

export const aiService = {
  async runPipeline(
    input: { kind: 'text' | 'docx' | 'voice'; text?: string; blob?: Blob; filename?: string },
    ctx: { projectId: string; supervisorId: string; source: ReportSource; language: string }
  ): Promise<PipelineRun> {
    const fallbackText = input.text ?? ''
    if (BACKEND_ANALYZE && (await isBackendUp())) {
      try {
        const blob = input.blob ?? (input.kind === 'text' ? new Blob([fallbackText], { type: 'text/plain' }) : null)
        if (blob) {
          const filename = input.filename ?? (input.kind === 'text' ? 'report.txt' : input.kind === 'voice' ? 'recording.webm' : 'report.docx')
          const res = await postPipelineFile(input.kind === 'text' ? 'txt' : input.kind, blob, filename)
          const entries = mapPipelineActivities(res.ai_result.activities ?? [], await activityLookup(ctx.projectId))
          if (entries.length > 0) {
            return { entries, risks: res.ai_result.predicted_risks ?? [], extractedText: res.extracted_text }
          }
        }
      } catch {
        // fall through to legacy analyze / mock
      }
      try {
        const legacy = await analyzeWithBackend(fallbackText)
        if (legacy && legacy.length > 0) return { entries: legacy, risks: [], extractedText: fallbackText }
      } catch {
        // fall through to mock
      }
    }
    const db = getDb()
    const allActivities = db.activities.filter((a) => a.projectId === ctx.projectId)
    const assignedActivities = allActivities.filter((a) => a.assigneeId === ctx.supervisorId && a.level === 'L6')
    const entries = analyzeReport(fallbackText, {
      projectId: ctx.projectId,
      supervisorId: ctx.supervisorId,
      source: ctx.source,
      assignedActivities,
      allActivities,
      language: ctx.language,
    })
    if (BACKEND_ANALYZE && (await isBackendUp())) {
      try {
        return { entries: await refreshWithBackend(entries), risks: [], extractedText: fallbackText }
      } catch {
        return { entries, risks: [], extractedText: fallbackText }
      }
    }
    return { entries, risks: [], extractedText: fallbackText }
  },

  async processReport(
    rawText: string,
    ctx: { projectId: string; supervisorId: string; source: ReportSource; language: string }
  ): Promise<PreviewEntry[]> {
    const run = await aiService.runPipeline({ kind: 'text', text: rawText }, ctx)
    return run.entries
  },
}
