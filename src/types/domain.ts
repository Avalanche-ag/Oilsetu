export type Role = 'manager' | 'supervisor' | 'worker'
export type Lang = 'en' | 'hi'

export type Discipline =
  | 'CIVIL'
  | 'PIPING'
  | 'ELECTRICAL'
  | 'INSTRUMENTATION'
  | 'EQUIPMENT'
  | 'HSE'

export type ActivityStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELAYED'
  | 'ON_HOLD'

export type ActivityLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'

export type ReportSource = 'TEXT' | 'VOICE' | 'FILE'

export type DelayReasonCode =
  | 'MATERIAL'
  | 'MANPOWER'
  | 'EQUIPMENT'
  | 'WEATHER'
  | 'DESIGN_CHANGE'
  | 'PERMIT'
  | 'FRONTEND'
  | 'OTHER'

export type ConfidenceBand = 'AUTO' | 'REVIEW' | 'UNMATCHED'

export type AiDecision =
  | 'AUTO_APPROVED'
  | 'ACCEPTED'
  | 'CORRECTED'
  | 'LINKED'
  | 'PENDING'
  | 'ASKED'

export type ThreadStatus = 'OPEN' | 'RESOLVED'

export type DelayEventStatus = 'OPEN' | 'MITIGATED' | 'RESOLVED'

export type AuditAction =
  | 'PROJECT_CREATED'
  | 'SCHEDULE_UPLOADED'
  | 'WORK_ASSIGNED'
  | 'REPORT_SUBMITTED'
  | 'AI_PROCESSED'
  | 'AI_AUTO_APPROVED'
  | 'AI_REVIEW_ACCEPTED'
  | 'AI_CORRECTED'
  | 'AI_LINKED'
  | 'AI_ASKED'
  | 'QUESTION_ASKED'
  | 'REPLY_SENT'
  | 'THREAD_RESOLVED'
  | 'DELAY_REPORTED'
  | 'LOGIN'
  | 'WORKER_TASK_ASSIGNED'
  | 'WORKER_ATTENDANCE_UPDATED'
  | 'TASK_REALLOCATED'
  | 'TASK_UNALLOCATED'

export interface User {
  id: string
  name: string
  role: Role
  designation: string
  phone?: string
  preferredLanguage: Lang
  avatarInitials: string
}

export type WorkerAttendanceStatus = 'PRESENT' | 'ABSENT' | 'PTO' | 'LEAVE'

export interface Worker {
  id: string
  userId: string
  projectId: string
  name: string
  discipline: Discipline
  workload: number
  activeTaskCount: number
  availability: number
  status: 'ACTIVE' | 'INACTIVE'
  attendanceStatus?: WorkerAttendanceStatus | null
}

export interface WorkerAttendance {
  id: string
  projectId: string
  workerId: string
  date: string
  status: WorkerAttendanceStatus
  reason?: string | null
  reportedBy: string
  createdAt: string
}

export interface WorkerTaskAssignment {
  id: string
  projectId: string
  activityId: string
  activityName: string
  activityStatus?: ActivityStatus | null
  progressPct?: number
  workerId: string
  assignedBy: string
  assignedAt: string
  source: 'MANUAL' | 'AUTO_REALLOCATION' | 'SEED'
  replacedWorkerId?: string | null
  reason?: string | null
  status: 'ACTIVE' | 'REPLACED' | 'COMPLETED'
}

export interface ReallocationResult {
  activityId: string
  activityName: string
  fromWorkerId: string
  toWorkerId: string | null
  toWorkerName?: string
  status: 'REALLOCATED' | 'UNALLOCATED'
  reason: string
}

export interface WorkerDashboardData {
  worker: Worker
  attendance: WorkerAttendance[]
  assignments: WorkerTaskAssignment[]
  summary: { presentDays: number; absentDays: number; leaveDays: number }
}

export interface Project {
  id: string
  name: string
  code: string
  client: string
  location: string
  disciplines: Discipline[]
  startDate: string
  plannedEnd: string
  status: 'ACTIVE' | 'PLANNING' | 'CLOSED'
  createdAt: string
  scheduleFileName?: string
  scheduleUploadedAt?: string
}

export interface ScheduleActivity {
  id: string
  projectId: string
  level: ActivityLevel
  parentId: string | null
  discipline: Discipline | null
  name: string
  plannedStart: string
  plannedEnd: string
  weightage: number
  status: ActivityStatus
  assigneeId?: string
  baselineVersion: string
  actualStart?: string
  actualEnd?: string
  lastReportedAt?: string
  progressPct: number
}

export interface Assignment {
  id: string
  projectId: string
  workPackageId: string
  supervisorId: string
  includedL6Ids: string[]
  instructions?: string
  assignedAt: string
  status: 'ACTIVE' | 'COMPLETED'
}

export interface DailyReport {
  id: string
  projectId: string
  supervisorId: string
  reportDate: string
  submittedAt: string
  source: ReportSource
  rawContent: string
  fileName?: string
  entries: ReportEntry[]
}

export interface ReportEntry {
  id: string
  reportId: string
  extractedText: string
  status: ActivityStatus | null
  actualStart?: string
  actualEnd?: string
  delayReason?: DelayReasonCode | null
  delayText?: string
  adjusted?: boolean
}

export interface CandidateActivity {
  activityId: string
  name: string
  discipline: Discipline | null
  confidence: number
}

export interface AiMatchResult {
  id: string
  reportEntryId: string
  reportId: string
  projectId: string
  extractedActivity: string
  matchedActivityId: string | null
  matchedActivityName?: string
  status: ActivityStatus | null
  actualStart?: string
  actualEnd?: string
  delayReason?: DelayReasonCode | null
  delayText?: string
  confidence: number
  band: ConfidenceBand
  keywords: string[]
  candidates: CandidateActivity[]
  source: ReportSource
  createdAt: string
  decision: AiDecision
  decidedBy?: string
  decidedAt?: string
}

export interface ConversationThread {
  id: string
  projectId: string
  activityId: string | null
  supervisorId: string
  openedBy: string
  subject: string
  status: ThreadStatus
  createdAt: string
  messages: Message[]
}

export interface Message {
  id: string
  threadId: string
  senderId: string
  text: string
  sentAt: string
}

export interface DelayEvent {
  id: string
  projectId: string
  activityId: string
  reasonCode: DelayReasonCode
  reasonText?: string
  reportedAt: string
  status: DelayEventStatus
  daysImpact: number
}

export interface AuditEvent {
  id: string
  actorId: string
  action: AuditAction
  entityType: string
  entityId: string
  descriptionParams: Record<string, string | number>
  timestamp: string
}

export interface DashboardData {
  overallProgress: number
  plannedProgress: number
  completedCount: number
  totalCount: number
  openDelays: number
  pendingReviews: number
  awaitingReply: number
  daysRemaining: number
  disciplineProgress: { discipline: Discipline | null; progress: number; planned: number; colorClass: string }[]
  delayedActivities: { activity: ScheduleActivity; daysLate: number; reason?: string }[]
  recentAudit: AuditEvent[]
  progressTrend: { label: string; planned: number; actual: number }[]
}

export interface InsightAggregate {
  plannedVsActual: { discipline: Discipline; planned: number; actual: number }[]
  delayReasons: { code: DelayReasonCode; count: number }[]
  productivity: { month: string; planned: number; actual: number }[]
  topDelayed: { name: string; occurrences: number; avgDaysLate: number }[]
  disciplineOnTime: { discipline: Discipline; onTimePct: number }[]
  patterns: { id: string; titleKey: string; bodyKey: string }[]
}

export interface PreviewEntry {
  tempId: string
  extractedText: string
  matchedActivityId: string | null
  matchedActivityName?: string
  status: ActivityStatus | null
  actualStart?: string
  actualEnd?: string
  delayReason?: DelayReasonCode | null
  delayText?: string
  confidence: number
  band: ConfidenceBand
  keywords: string[]
  candidates: CandidateActivity[]
}

export interface NewProjectInput {
  name: string
  code: string
  client: string
  location: string
  disciplines: Discipline[]
  startDate: string
  plannedEnd: string
}
