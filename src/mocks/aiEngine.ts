import type { PreviewEntry, ScheduleActivity, ReportSource, ActivityStatus, DelayReasonCode, CandidateActivity } from '../types/domain'
import { APP_CONFIG } from '../config/constants'
import { isoOffset } from '../utils/dates'

interface EngineContext {
  projectId: string
  supervisorId: string
  source: ReportSource
  assignedActivities: ScheduleActivity[]
  allActivities: ScheduleActivity[]
  language: string
}

export function analyzeReport(rawText: string, ctx: EngineContext): PreviewEntry[] {
  const sentences = splitSentences(rawText)
  return sentences
    .map((sentence) => analyzeSentence(sentence.trim(), ctx))
    .filter((entry): entry is PreviewEntry => Boolean(entry))
}

function splitSentences(text: string): string[] {
  return text
    .replace(/[।]/g, '.')
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
}

function analyzeSentence(sentence: string, ctx: EngineContext): PreviewEntry | null {
  const lower = sentence.toLowerCase()

  if (contains(lower, ['line 24', 'लाइन 24'])) {
    return buildEntry(sentence, 'PIP-L6-024', 'Erect Line 24-XX (spool erection)', 'PIPING', 'COMPLETED', 96, ['line 24', 'spool', 'erection'], ctx)
  }

  if (contains(lower, ['line 25', 'लाइन 25']) && contains(lower, ['staged', 'stage', 'material', 'सामग्री'])) {
    return buildEntry(sentence, 'PIP-L6-025', 'Erect Line 25-XX (spool erection)', 'PIPING', 'IN_PROGRESS', 71, ['line 25', 'material'], ctx, [
      { activityId: 'PIP-L6-025', name: 'Erect Line 25-XX (spool erection)', discipline: 'PIPING', confidence: 71 },
      { activityId: 'PIP-L6-025W', name: 'Weld & NDT Line 25', discipline: 'PIPING', confidence: 58 },
    ])
  }

  if (contains(lower, ['line 25', 'लाइन 25'])) {
    return buildEntry(sentence, 'PIP-L6-025', 'Erect Line 25-XX (spool erection)', 'PIPING', 'IN_PROGRESS', 92, ['line 25', 'started'], ctx)
  }

  if (contains(lower, ['line 26', 'लाइन 26'])) {
    return buildEntry(sentence, 'PIP-L6-026', 'Erect Line 26-XX (spool erection)', 'PIPING', 'DELAYED', 95, ['line 26', 'delayed', 'material'], ctx, [], 'MATERIAL')
  }

  if (contains(lower, ['alignment', 'align', 'अलाइनमेंट', 'अलाइन'])) {
    return buildEntry(sentence, null, '', 'EQUIPMENT', 'IN_PROGRESS', 74, ['pump', 'alignment'], ctx, [
      { activityId: 'ROT-L6-089', name: 'Pump Alignment P-101A', discipline: 'EQUIPMENT', confidence: 74 },
      { activityId: 'CIV-L6-101C', name: 'Baseplate grouting & leveling P-101', discipline: 'CIVIL', confidence: 61 },
    ])
  }

  if (contains(lower, ['tank', 'टैंक', 'tank farm', 'टैंक फार्म'])) {
    return buildEntry(sentence, null, '', null, null, 41, [], ctx)
  }

  if (contains(lower, ['p-101', 'p101', 'foundation', 'rebar', 'baseplate', 'grout'])) {
    const candidate = ctx.assignedActivities.find((a) => a.id === 'CIV-L6-101B') ?? ctx.assignedActivities[0]
    return buildEntry(sentence, candidate?.id ?? null, candidate?.name ?? 'P-101 foundation work', 'CIVIL', 'IN_PROGRESS', 87, ['p-101', 'foundation'], ctx, candidate ? [
      { activityId: candidate.id, name: candidate.name, discipline: candidate.discipline, confidence: 87 },
    ] : [])
  }

  if (contains(lower, ['delay', 'delayed', 'late', 'देरी', 'late'])) {
    return buildEntry(sentence, null, '', null, 'DELAYED', 68, ['delay'], ctx, [], 'OTHER')
  }

  if (contains(lower, ['complete', 'completed', 'पूरा', 'ho gaya', 'हो गया', 'done', 'finish'])) {
    const candidate = pickCandidate(ctx.assignedActivities, 'IN_PROGRESS')
    return buildEntry(sentence, candidate?.id ?? null, candidate?.name ?? '', candidate?.discipline ?? null, 'COMPLETED', candidate ? 76 : 55, candidate ? ['complete'] : [], ctx, candidate ? [
      { activityId: candidate.id, name: candidate.name, discipline: candidate.discipline, confidence: 76 },
    ] : [])
  }

  if (contains(lower, ['start', 'started', 'shuru', 'शुरू', 'begin'])) {
    const candidate = pickCandidate(ctx.assignedActivities, 'NOT_STARTED')
    return buildEntry(sentence, candidate?.id ?? null, candidate?.name ?? '', candidate?.discipline ?? null, 'IN_PROGRESS', candidate ? 73 : 48, candidate ? ['start'] : [], ctx, candidate ? [
      { activityId: candidate.id, name: candidate.name, discipline: candidate.discipline, confidence: 73 },
    ] : [])
  }

  return buildEntry(sentence, null, '', null, null, 38, [], ctx)
}

function contains(lower: string, keywords: string[]): boolean {
  return keywords.some((k) => lower.includes(k))
}

function pickCandidate(assigned: ScheduleActivity[], targetStatus: 'IN_PROGRESS' | 'NOT_STARTED'): ScheduleActivity | null {
  const filtered = assigned.filter((a) => a.level === 'L6' && a.status === targetStatus)
  return filtered[0] ?? assigned.filter((a) => a.level === 'L6')[0] ?? null
}

function buildEntry(
  extractedText: string,
  matchedId: string | null,
  matchedName: string,
  discipline: 'CIVIL' | 'PIPING' | 'ELECTRICAL' | 'INSTRUMENTATION' | 'EQUIPMENT' | 'HSE' | null,
  status: ActivityStatus | null,
  confidence: number,
  keywords: string[],
  ctx: EngineContext,
  candidates: CandidateActivity[] = [],
  delayReason: DelayReasonCode | null = null
): PreviewEntry {
  const activity = matchedId ? ctx.allActivities.find((a) => a.id === matchedId) : undefined
  const finalName = activity?.name ?? matchedName
  const finalDiscipline = activity?.discipline ?? discipline

  const band = confidence >= APP_CONFIG.CONFIDENCE_AUTO ? 'AUTO' : confidence >= APP_CONFIG.CONFIDENCE_REVIEW ? 'REVIEW' : 'UNMATCHED'

  let actualStart: string | undefined
  let actualEnd: string | undefined
  const today = isoOffset(0)

  if (status === 'COMPLETED') actualEnd = today
  if (status === 'IN_PROGRESS') actualStart = today
  if (status === 'DELAYED') actualStart = today

  return {
    tempId: crypto.randomUUID(),
    extractedText,
    matchedActivityId: activity?.id ?? matchedId,
    matchedActivityName: finalName,
    status,
    actualStart,
    actualEnd,
    delayReason,
    delayText: delayReason ? extractedText : undefined,
    confidence,
    band,
    keywords,
    candidates: candidates.length ? candidates : band === 'REVIEW' && matchedId ? [
      { activityId: matchedId, name: finalName, discipline: finalDiscipline, confidence },
    ] : [],
  }
}
