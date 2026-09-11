import type { ScheduleActivity, Discipline, ActivityLevel, Project } from '../types/domain'
import { isoOffset } from '../utils/dates'

const DISCIPLINE_NAMES: Record<Discipline, string> = {
  CIVIL: 'Civil & Structural',
  PIPING: 'Piping',
  ELECTRICAL: 'Electrical',
  INSTRUMENTATION: 'Instrumentation',
  EQUIPMENT: 'Mechanical Equipment',
  HSE: 'HSE',
}

export function generateSchedule(project: Project): ScheduleActivity[] {
  const activities: ScheduleActivity[] = []
  const startDays = 0
  const endDays = Math.round((new Date(project.plannedEnd).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))
  const totalDays = Math.max(30, endDays)

  activities.push(createActivity(`${project.code}-L1`, 'L1', null, null, project.name, project.id, startDays, endDays, 0))

  const l2Span = Math.floor(totalDays / project.disciplines.length)
  project.disciplines.forEach((disc, i) => {
    const l2Start = startDays + i * l2Span
    const l2End = l2Start + l2Span
    const l2Id = `${project.code}-${disc}-L2`
    activities.push(createActivity(l2Id, 'L2', `${project.code}-L1`, disc, DISCIPLINE_NAMES[disc], project.id, l2Start, l2End, 0))

    const l3Start = l2Start + 5
    const l3End = l2End - 5
    const l3Id = `${project.code}-${disc}-L3`
    activities.push(createActivity(l3Id, 'L3', l2Id, disc, `${DISCIPLINE_NAMES[disc]} Execution`, project.id, l3Start, l3End, 0))

    const l4Span = Math.floor((l3End - l3Start) / 2)
    ;[1, 2].forEach((area) => {
      const l4Start = l3Start + (area - 1) * l4Span
      const l4End = Math.min(l4Start + l4Span, l3End)
      const l4Id = `${project.code}-${disc}-A${area}`
      activities.push(createActivity(l4Id, 'L4', l3Id, disc, `Area ${area} — ${DISCIPLINE_NAMES[disc]}`, project.id, l4Start, l4End, 0))

      const l5Span = Math.floor((l4End - l4Start) / 2)
      ;[1, 2].forEach((wp) => {
        const l5Start = l4Start + (wp - 1) * l5Span
        const l5End = Math.min(l5Start + l5Span, l4End)
        const l5Id = `${project.code}-${disc}-A${area}-WP${wp}`
        activities.push(createActivity(l5Id, 'L5', l4Id, disc, `Work Package ${wp} — Area ${area}`, project.id, l5Start, l5End, 0))

        const l6Span = Math.floor((l5End - l5Start) / 2)
        ;[1, 2].forEach((step) => {
          const l6Start = l5Start + (step - 1) * l6Span
          const l6End = Math.min(l6Start + l6Span, l5End)
          const l6Id = `${project.code}-${disc}-A${area}-WP${wp}-S${step}`
          activities.push(createActivity(l6Id, 'L6', l5Id, disc, `Step ${step} — ${DISCIPLINE_NAMES[disc]}`, project.id, l6Start, l6End, 1))
        })
      })
    })
  })

  return activities
}

function createActivity(
  id: string,
  level: ActivityLevel,
  parentId: string | null,
  discipline: Discipline | null,
  name: string,
  projectId: string,
  startOffset: number,
  endOffset: number,
  weightage: number
): ScheduleActivity {
  return {
    id,
    projectId,
    level,
    parentId,
    discipline,
    name,
    plannedStart: isoOffset(startOffset),
    plannedEnd: isoOffset(endOffset),
    weightage,
    status: 'NOT_STARTED',
    progressPct: 0,
    baselineVersion: 'v1',
  }
}
