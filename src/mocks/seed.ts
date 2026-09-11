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
  ActivityStatus,
  ActivityLevel,
  Discipline,
} from '../types/domain'
import { isoOffset, daysAgoIso } from '../utils/dates'

function A(
  id: string,
  level: ActivityLevel,
  parentId: string | null,
  discipline: Discipline | null,
  name: string,
  startOffset: number,
  endOffset: number,
  extra: Partial<ScheduleActivity> = {}
): ScheduleActivity {
  return {
    id,
    projectId: 'p-001',
    level,
    parentId,
    discipline,
    name,
    plannedStart: isoOffset(startOffset),
    plannedEnd: isoOffset(endOffset),
    weightage: level === 'L6' ? 1 : 0,
    status: extra.status ?? 'NOT_STARTED',
    progressPct: extra.progressPct ?? 0,
    baselineVersion: 'v1',
    ...extra,
  }
}

function status(s: ActivityStatus): Partial<ScheduleActivity> {
  return { status: s }
}

function done(actualEndOffset: number, lastRepOffset?: number): Partial<ScheduleActivity> {
  return {
    status: 'COMPLETED',
    progressPct: 100,
    actualStart: isoOffset(actualEndOffset - 7),
    actualEnd: isoOffset(actualEndOffset),
    lastReportedAt: isoOffset(lastRepOffset ?? actualEndOffset),
  }
}

function inProgress(progress: number, startOffset: number, lastRepOffset: number): Partial<ScheduleActivity> {
  return {
    status: 'IN_PROGRESS',
    progressPct: progress,
    actualStart: isoOffset(startOffset),
    lastReportedAt: isoOffset(lastRepOffset),
  }
}

function delayed(progress: number): Partial<ScheduleActivity> {
  return {
    status: 'DELAYED',
    progressPct: progress,
  }
}

export const SEED_USERS: User[] = [
  {
    id: 'u-mgr-01',
    name: 'Priya Sharma',
    role: 'manager',
    designation: 'Head of Project Controls',
    phone: '+91-98765-43210',
    preferredLanguage: 'en',
    avatarInitials: 'PS',
  },
  {
    id: 'u-sup-01',
    name: 'Rajesh Kumar',
    role: 'supervisor',
    designation: 'Piping Supervisor',
    phone: '+91-98123-45678',
    preferredLanguage: 'hi',
    avatarInitials: 'RK',
  },
  {
    id: 'u-sup-02',
    name: 'Amit Singh',
    role: 'supervisor',
    designation: 'Mechanical & Civil Supervisor',
    phone: '+91-98234-56789',
    preferredLanguage: 'hi',
    avatarInitials: 'AS',
  },
]

export const SEED_PROJECT: Project = {
  id: 'p-001',
  name: 'CDU-3 Refinery Unit',
  code: 'CDU3',
  client: 'Indian Oil Corporation Ltd.',
  location: 'Paradip, Odisha',
  disciplines: ['CIVIL', 'PIPING', 'ELECTRICAL', 'INSTRUMENTATION', 'EQUIPMENT', 'HSE'],
  startDate: isoOffset(-250),
  plannedEnd: isoOffset(98),
  status: 'ACTIVE',
  createdAt: isoOffset(-252),
  scheduleFileName: 'CDU3_Baseline_v1.xer',
  scheduleUploadedAt: isoOffset(-250),
}

export function buildSeedActivities(): ScheduleActivity[] {
  return [
    A('CDU3-L1', 'L1', null, null, 'Crude Distillation Unit-3 (CDU-3)', -250, 98),

    A('CIV-L2', 'L2', 'CDU3-L1', 'CIVIL', 'Civil & Structural Works', -220, -6),
    A('CIV-FND', 'L3', 'CIV-L2', 'CIVIL', 'Equipment & Structure Foundations', -22, 14),
    A('CIV-FND-A', 'L4', 'CIV-FND', 'CIVIL', 'Foundations — Process Area A', -22, 14),
    A('CIV-L5-101', 'L5', 'CIV-FND-A', 'CIVIL', 'Pump foundation P-101 A/B', -22, 14),
    A('CIV-L6-101A', 'L6', 'CIV-L5-101', 'CIVIL', 'Excavation P-101', -22, -12, done(-14, -14)),
    A('CIV-L6-101B', 'L6', 'CIV-L5-101', 'CIVIL', 'Rebar & formwork P-101', -11, 3, inProgress(70, -11, -2)),
    A('CIV-L6-101C', 'L6', 'CIV-L5-101', 'CIVIL', 'Baseplate grouting & leveling P-101', 4, 14, status('NOT_STARTED')),

    A('CIV-STR', 'L3', 'CIV-L2', 'CIVIL', 'Structural Steel & Pipe Racks', -163, -6),
    A('CIV-STR-01', 'L4', 'CIV-STR', 'CIVIL', 'Pipe Rack Fabrication & Erection — Zone 2', -133, -6),
    A('CIV-L5-201', 'L5', 'CIV-STR-01', 'CIVIL', 'Erect Pipe Rack Bay 5–8', -41, -6),
    A('CIV-L6-201A', 'L6', 'CIV-L5-201', 'CIVIL', 'Erect Columns Bay 5–6', -41, -27, done(-27, -27)),
    A('CIV-L6-201B', 'L6', 'CIV-L5-201', 'CIVIL', 'Erect Beams & Bracing Bay 5–6', -26, -6, inProgress(60, -26, -4)),

    A('MEC-L2', 'L2', 'CDU3-L1', 'EQUIPMENT', 'Mechanical Equipment Installation', -194, 60),
    A('ROT-L3', 'L3', 'MEC-L2', 'EQUIPMENT', 'Rotating Equipment', -102, 34),
    A('ROT-01', 'L4', 'ROT-L3', 'EQUIPMENT', 'Pumps — Process Area A', -41, 29),
    A('ROT-L5-088', 'L5', 'ROT-01', 'EQUIPMENT', 'Pump P-101A Installation & Alignment', -10, 9),
    A('ROT-L6-088', 'L6', 'ROT-L5-088', 'EQUIPMENT', 'Set Baseplate & Grout P-101A', -10, -3, done(-3, -3)),
    A('ROT-L6-089', 'L6', 'ROT-L5-088', 'EQUIPMENT', 'Pump Alignment P-101A', -3, 4, status('NOT_STARTED')),
    A('ROT-L6-090', 'L6', 'ROT-L5-088', 'EQUIPMENT', 'Coupling & Motor Install P-101A', 5, 9, status('NOT_STARTED')),
    A('ROT-L5-091', 'L5', 'ROT-01', 'EQUIPMENT', 'Pump P-101B Installation & Alignment', 9, 29, status('NOT_STARTED')),

    A('STA-L3', 'L3', 'MEC-L2', 'EQUIPMENT', 'Static Equipment', -194, 14),
    A('STA-01', 'L4', 'STA-L3', 'EQUIPMENT', 'Vessels & Columns — Area A', -133, 14),
    A('STA-L5-301', 'L5', 'STA-01', 'EQUIPMENT', 'Set Column C-201', -102, -82, done(-82, -82)),
    A('STA-L5-302', 'L5', 'STA-01', 'EQUIPMENT', 'Set Vessel V-301 & Internals', -41, -31, done(-31, -31)),

    A('PIP-L2', 'L2', 'CDU3-L1', 'PIPING', 'Piping Fabrication & Installation', -163, 70),
    A('PIP-AG', 'L3', 'PIP-L2', 'PIPING', 'Aboveground Piping', -133, 60),
    A('PIP-AG-02', 'L4', 'PIP-AG', 'PIPING', 'Aboveground Piping — Segment 24–26', -22, 34),
    A('PIP-L5-024', 'L5', 'PIP-AG-02', 'PIPING', 'Erect Line 24', -22, 2),
    A('PIP-L6-024', 'L6', 'PIP-L5-024', 'PIPING', 'Erect Line 24-XX (spool erection)', -22, 2, inProgress(80, -22, -2)),
    A('PIP-L6-024W', 'L6', 'PIP-L5-024', 'PIPING', 'Weld & NDT Line 24', -6, 2, inProgress(30, -6, -8)),
    A('PIP-L6-024T', 'L6', 'PIP-L5-024', 'PIPING', 'Hydro Test Line 24', -2, 4, status('NOT_STARTED')),

    A('PIP-L5-025', 'L5', 'PIP-AG-02', 'PIPING', 'Erect Line 25', -10, 14, status('NOT_STARTED')),
    A('PIP-L6-025', 'L6', 'PIP-L5-025', 'PIPING', 'Erect Line 25-XX (spool erection)', -10, 14, status('NOT_STARTED')),
    A('PIP-L6-025W', 'L6', 'PIP-L5-025', 'PIPING', 'Weld & NDT Line 25', -2, 14, status('NOT_STARTED')),

    A('PIP-L5-026', 'L5', 'PIP-AG-02', 'PIPING', 'Erect Line 26', -6, 19, status('NOT_STARTED')),
    A('PIP-L6-026', 'L6', 'PIP-L5-026', 'PIPING', 'Erect Line 26-XX (spool erection)', -6, 19, status('NOT_STARTED')),
    A('PIP-L6-026W', 'L6', 'PIP-L5-026', 'PIPING', 'Weld & NDT Line 26', 10, 19, status('NOT_STARTED')),

    A('PIP-AG-03', 'L4', 'PIP-AG', 'PIPING', 'Aboveground Piping — Segment 27–29', 14, 60),
    A('PIP-L5-027', 'L5', 'PIP-AG-03', 'PIPING', 'Erect Line 27', 14, 39, status('NOT_STARTED')),
    A('PIP-L5-028', 'L5', 'PIP-AG-03', 'PIPING', 'Erect Line 28', 35, 60, status('NOT_STARTED')),

    A('PIP-UG', 'L3', 'PIP-L2', 'PIPING', 'Underground Piping & Drainage', -102, 9),
    A('PIP-UG-01', 'L4', 'PIP-UG', 'PIPING', 'Firewater & Drainage Network', -102, 9),
    A('PIP-L5-030', 'L5', 'PIP-UG-01', 'PIPING', 'Lay Firewater Main — Zone 1', -102, 9),
    A('PIP-L6-030', 'L6', 'PIP-L5-030', 'PIPING', 'Trench, Lay & Bury Main — Zone 1', -72, 9, delayed(10)),

    A('ELE-L2', 'L2', 'CDU3-L1', 'ELECTRICAL', 'Electrical Installation', -133, 80),
    A('ELE-CBL', 'L3', 'ELE-L2', 'ELECTRICAL', 'Cable Trays & Cabling', -72, 70),
    A('ELE-CBL-01', 'L4', 'ELE-CBL', 'ELECTRICAL', 'Cable Tray — Substation to Process A', -72, 34),
    A('ELE-L5-401', 'L5', 'ELE-CBL-01', 'ELECTRICAL', 'Install Cable Tray Run A', -72, -6),
    A('ELE-L6-401A', 'L6', 'ELE-L5-401', 'ELECTRICAL', 'Erect Tray Sections A1–A3', -72, -34, done(-34, -34)),
    A('ELE-L6-401B', 'L6', 'ELE-L5-401', 'ELECTRICAL', 'Erect Tray Sections A4–A6', -33, -6, inProgress(50, -33, -5)),
    A('ELE-L5-402', 'L5', 'ELE-CBL-01', 'ELECTRICAL', 'Pull & Terminate LV Cables Run A', -10, 34, status('NOT_STARTED')),

    A('INS-L2', 'L2', 'CDU3-L1', 'INSTRUMENTATION', 'Instrumentation & Automation', -102, 85),
    A('INS-FD', 'L3', 'INS-L2', 'INSTRUMENTATION', 'Field Instruments', -41, 70),
    A('INS-FD-01', 'L4', 'INS-FD', 'INSTRUMENTATION', 'Instruments — Segment 24–26', -6, 55),
    A('INS-L5-501', 'L5', 'INS-FD-01', 'INSTRUMENTATION', 'Install Flow & Temp Transmitters Line 24–26', -6, 24, status('NOT_STARTED')),
    A('INS-L5-502', 'L5', 'INS-FD-01', 'INSTRUMENTATION', 'Loop Checking Line 24–26', 20, 55, status('NOT_STARTED')),

    A('HSE-L2', 'L2', 'CDU3-L1', 'HSE', 'HSE & Commissioning Support', -250, 98),
    A('HSE-PL', 'L3', 'HSE-L2', 'HSE', 'Permits & Safety', -250, 98),
    A('HSE-PL-01', 'L4', 'HSE-PL', 'HSE', 'Daily Permits & Safety Walks — Phase 3', -41, 98),
    A('HSE-L5-601', 'L5', 'HSE-PL-01', 'HSE', 'Work Permits & Toolbox Talks', -41, 98, inProgress(25, -41, -1)),
  ]
}

export const SEED_ASSIGNMENTS: Assignment[] = [
  {
    id: 'a-001',
    projectId: 'p-001',
    workPackageId: 'PIP-AG-02',
    supervisorId: 'u-sup-01',
    includedL6Ids: ['PIP-L6-024', 'PIP-L6-024W', 'PIP-L6-024T', 'PIP-L6-025', 'PIP-L6-025W', 'PIP-L6-026', 'PIP-L6-026W'],
    instructions: 'Focus on spool erection sequence 24→26; report daily by 18:00 hrs.',
    assignedAt: daysAgoIso(28),
    status: 'ACTIVE',
  },
  {
    id: 'a-002',
    projectId: 'p-001',
    workPackageId: 'ROT-01',
    supervisorId: 'u-sup-02',
    includedL6Ids: ['ROT-L6-088', 'ROT-L6-089', 'ROT-L6-090'],
    instructions: 'Complete P-101A alignment before 15 Sep. Report blockers immediately.',
    assignedAt: daysAgoIso(27),
    status: 'ACTIVE',
  },
  {
    id: 'a-003',
    projectId: 'p-001',
    workPackageId: 'CIV-FND-A',
    supervisorId: 'u-sup-02',
    includedL6Ids: ['CIV-L6-101A', 'CIV-L6-101B', 'CIV-L6-101C'],
    instructions: 'Maintain rebar & concrete curing records.',
    assignedAt: daysAgoIso(26),
    status: 'ACTIVE',
  },
  {
    id: 'a-004',
    projectId: 'p-001',
    workPackageId: 'PIP-UG-01',
    supervisorId: 'u-sup-01',
    includedL6Ids: ['PIP-L6-030'],
    instructions: 'Track firewater spool delivery daily.',
    assignedAt: daysAgoIso(25),
    status: 'ACTIVE',
  },
]

function matchBase(
  id: string,
  entryId: string,
  reportId: string,
  overrides: Partial<AiMatchResult> = {}
): AiMatchResult {
  return {
    id,
    reportEntryId: entryId,
    reportId,
    projectId: 'p-001',
    extractedActivity: '',
    matchedActivityId: null,
    matchedActivityName: '',
    status: null,
    confidence: 0,
    band: 'AUTO',
    keywords: [],
    candidates: [],
    source: 'TEXT',
    createdAt: isoOffset(0),
    decision: 'AUTO_APPROVED',
    ...overrides,
  }
}

export const SEED_REPORTS: DailyReport[] = [
  {
    id: 'r-101',
    projectId: 'p-001',
    supervisorId: 'u-sup-01',
    reportDate: daysAgoIso(3),
    submittedAt: `${daysAgoIso(3)}T18:12:00`,
    source: 'TEXT',
    rawContent: 'Line 24 erection 60% done. Welding started on first spools.',
    entries: [
      {
        id: 're-101a',
        reportId: 'r-101',
        extractedText: 'Line 24 erection 60% done.',
        status: 'IN_PROGRESS',
        actualStart: isoOffset(-22),
        delayReason: null,
      },
      {
        id: 're-101b',
        reportId: 'r-101',
        extractedText: 'Welding started on first spools.',
        status: 'IN_PROGRESS',
        actualStart: daysAgoIso(3),
        delayReason: null,
      },
    ],
  },
  {
    id: 'r-102',
    projectId: 'p-001',
    supervisorId: 'u-sup-01',
    reportDate: daysAgoIso(2),
    submittedAt: `${daysAgoIso(2)}T17:45:00`,
    source: 'VOICE',
    rawContent: 'Line 24 eighty percent erected. Line 25 material staged at laydown yard.',
    entries: [
      {
        id: 're-102a',
        reportId: 'r-102',
        extractedText: 'Line 24 eighty percent erected.',
        status: 'IN_PROGRESS',
        actualStart: isoOffset(-22),
        delayReason: null,
      },
      {
        id: 're-102b',
        reportId: 'r-102',
        extractedText: 'Line 25 material staged at laydown yard.',
        status: 'IN_PROGRESS',
        actualStart: daysAgoIso(2),
        delayReason: null,
        adjusted: true,
      },
    ],
  },
  {
    id: 'r-201',
    projectId: 'p-001',
    supervisorId: 'u-sup-02',
    reportDate: daysAgoIso(3),
    submittedAt: `${daysAgoIso(3)}T19:05:00`,
    source: 'TEXT',
    rawContent: 'P-101A baseplate grouted and curing.',
    entries: [
      {
        id: 're-201a',
        reportId: 'r-201',
        extractedText: 'P-101A baseplate grouted and curing.',
        status: 'COMPLETED',
        actualEnd: daysAgoIso(3),
        delayReason: null,
      },
    ],
  },
  {
    id: 'r-202',
    projectId: 'p-001',
    supervisorId: 'u-sup-02',
    reportDate: daysAgoIso(2),
    submittedAt: `${daysAgoIso(2)}T18:30:00`,
    source: 'FILE',
    fileName: 'SiteDiary_Day47.pdf',
    rawContent: 'Site diary day 47. Rebar work on P-101 foundation 70 percent complete. Some work done near tank farm area.',
    entries: [
      {
        id: 're-202a',
        reportId: 'r-202',
        extractedText: 'Rebar work on P-101 foundation 70 percent complete.',
        status: 'IN_PROGRESS',
        actualStart: isoOffset(-11),
        delayReason: null,
      },
      {
        id: 're-202b',
        reportId: 'r-202',
        extractedText: 'Some work done near tank farm area.',
        status: null,
        delayReason: null,
      },
    ],
  },
]

export const SEED_AI_MATCHES: AiMatchResult[] = [
  matchBase('aim-101a', 're-101a', 'r-101', {
    extractedActivity: 'Line 24 erection 60% done.',
    matchedActivityId: 'PIP-L6-024',
    matchedActivityName: 'Erect Line 24-XX (spool erection)',
    status: 'IN_PROGRESS',
    actualStart: isoOffset(-22),
    confidence: 89,
    band: 'REVIEW',
    keywords: ['line 24', 'erection'],
    candidates: [
      { activityId: 'PIP-L6-024', name: 'Erect Line 24-XX (spool erection)', discipline: 'PIPING', confidence: 89 },
      { activityId: 'PIP-L6-024W', name: 'Weld & NDT Line 24', discipline: 'PIPING', confidence: 67 },
    ],
    source: 'TEXT',
    createdAt: `${daysAgoIso(3)}T18:12:00`,
    decision: 'ACCEPTED',
    decidedBy: 'u-mgr-01',
    decidedAt: `${daysAgoIso(3)}T18:30:00`,
  }),
  matchBase('aim-101b', 're-101b', 'r-101', {
    extractedActivity: 'Welding started on first spools.',
    matchedActivityId: 'PIP-L6-024W',
    matchedActivityName: 'Weld & NDT Line 24',
    status: 'IN_PROGRESS',
    actualStart: daysAgoIso(3),
    confidence: 84,
    band: 'REVIEW',
    keywords: ['welding', 'spools'],
    candidates: [
      { activityId: 'PIP-L6-024W', name: 'Weld & NDT Line 24', discipline: 'PIPING', confidence: 84 },
      { activityId: 'PIP-L6-025W', name: 'Weld & NDT Line 25', discipline: 'PIPING', confidence: 61 },
    ],
    source: 'TEXT',
    createdAt: `${daysAgoIso(3)}T18:12:00`,
    decision: 'ACCEPTED',
    decidedBy: 'u-mgr-01',
    decidedAt: `${daysAgoIso(3)}T18:30:00`,
  }),
  matchBase('aim-102a', 're-102a', 'r-102', {
    extractedActivity: 'Line 24 eighty percent erected.',
    matchedActivityId: 'PIP-L6-024',
    matchedActivityName: 'Erect Line 24-XX (spool erection)',
    status: 'IN_PROGRESS',
    actualStart: isoOffset(-22),
    confidence: 91,
    band: 'AUTO',
    keywords: ['line 24', 'erected'],
    candidates: [],
    source: 'VOICE',
    createdAt: `${daysAgoIso(2)}T17:45:00`,
    decision: 'AUTO_APPROVED',
  }),
  matchBase('aim-102b', 're-102b', 'r-102', {
    extractedActivity: 'Line 25 material staged at laydown yard.',
    matchedActivityId: 'PIP-L6-025',
    matchedActivityName: 'Erect Line 25-XX (spool erection)',
    status: 'IN_PROGRESS',
    actualStart: daysAgoIso(2),
    confidence: 71,
    band: 'REVIEW',
    keywords: ['line 25', 'material'],
    candidates: [
      { activityId: 'PIP-L6-025', name: 'Erect Line 25-XX (spool erection)', discipline: 'PIPING', confidence: 71 },
      { activityId: 'PIP-L6-025W', name: 'Weld & NDT Line 25', discipline: 'PIPING', confidence: 58 },
    ],
    source: 'VOICE',
    createdAt: `${daysAgoIso(2)}T17:45:00`,
    decision: 'PENDING',
  }),
  matchBase('aim-201a', 're-201a', 'r-201', {
    extractedActivity: 'P-101A baseplate grouted and curing.',
    matchedActivityId: 'ROT-L6-088',
    matchedActivityName: 'Set Baseplate & Grout P-101A',
    status: 'COMPLETED',
    actualEnd: daysAgoIso(3),
    confidence: 93,
    band: 'AUTO',
    keywords: ['baseplate', 'grouted'],
    candidates: [],
    source: 'TEXT',
    createdAt: `${daysAgoIso(3)}T19:05:00`,
    decision: 'AUTO_APPROVED',
  }),
  matchBase('aim-202a', 're-202a', 'r-202', {
    extractedActivity: 'Rebar work on P-101 foundation 70 percent complete.',
    matchedActivityId: 'CIV-L6-101B',
    matchedActivityName: 'Rebar & formwork P-101',
    status: 'IN_PROGRESS',
    actualStart: isoOffset(-11),
    confidence: 87,
    band: 'REVIEW',
    keywords: ['rebar', 'p-101', 'foundation'],
    candidates: [
      { activityId: 'CIV-L6-101B', name: 'Rebar & formwork P-101', discipline: 'CIVIL', confidence: 87 },
      { activityId: 'CIV-L6-101C', name: 'Baseplate grouting & leveling P-101', discipline: 'CIVIL', confidence: 72 },
    ],
    source: 'FILE',
    createdAt: `${daysAgoIso(2)}T18:30:00`,
    decision: 'ACCEPTED',
    decidedBy: 'u-mgr-01',
    decidedAt: `${daysAgoIso(2)}T18:45:00`,
  }),
  matchBase('aim-202b', 're-202b', 'r-202', {
    extractedActivity: 'Some work done near tank farm area.',
    matchedActivityId: null,
    confidence: 41,
    band: 'UNMATCHED',
    keywords: [],
    candidates: [],
    source: 'FILE',
    createdAt: `${daysAgoIso(2)}T18:30:00`,
    decision: 'PENDING',
  }),
]

export const SEED_THREADS: ConversationThread[] = [
  {
    id: 't-001',
    projectId: 'p-001',
    activityId: 'ROT-L6-089',
    supervisorId: 'u-sup-02',
    openedBy: 'u-mgr-01',
    subject: 'Pump alignment status',
    status: 'OPEN',
    createdAt: `${daysAgoIso(1)}T09:30:00`,
    messages: [
      {
        id: 'm-001',
        threadId: 't-001',
        senderId: 'u-mgr-01',
        text: 'What is the current status of pump P-101A alignment? Planned finish is 15 September.',
        sentAt: `${daysAgoIso(1)}T09:30:00`,
      },
    ],
  },
  {
    id: 't-002',
    projectId: 'p-001',
    activityId: 'CIV-L6-101A',
    supervisorId: 'u-sup-02',
    openedBy: 'u-mgr-01',
    subject: 'P-101 excavation delay',
    status: 'RESOLVED',
    createdAt: `${daysAgoIso(15)}T10:00:00`,
    messages: [
      {
        id: 'm-002',
        threadId: 't-002',
        senderId: 'u-mgr-01',
        text: 'Why was excavation P-101 delayed by 3 days?',
        sentAt: `${daysAgoIso(15)}T10:00:00`,
      },
      {
        id: 'm-003',
        threadId: 't-002',
        senderId: 'u-sup-02',
        text: 'Rain water accumulation in pit, dewatering pump arranged.',
        sentAt: `${daysAgoIso(14)}T08:15:00`,
      },
      {
        id: 'm-004',
        threadId: 't-002',
        senderId: 'u-mgr-01',
        text: 'Noted. Please catch up on rebar schedule.',
        sentAt: `${daysAgoIso(13)}T11:20:00`,
      },
      {
        id: 'm-005',
        threadId: 't-002',
        senderId: 'u-sup-02',
        text: 'Yes, extra gang deployed from tomorrow.',
        sentAt: `${daysAgoIso(12)}T07:45:00`,
      },
    ],
  },
]

export const SEED_DELAYS: DelayEvent[] = [
  {
    id: 'd-001',
    projectId: 'p-001',
    activityId: 'PIP-L6-030',
    reasonCode: 'MATERIAL',
    reasonText: 'Pipe spools for firewater main not delivered.',
    reportedAt: `${daysAgoIso(4)}T18:00:00`,
    status: 'OPEN',
    daysImpact: 4,
  },
  {
    id: 'd-002',
    projectId: 'p-001',
    activityId: 'CIV-L6-101A',
    reasonCode: 'WEATHER',
    reasonText: 'Rain water accumulation delayed pit excavation.',
    reportedAt: `${daysAgoIso(15)}T10:00:00`,
    status: 'RESOLVED',
    daysImpact: 3,
  },
]

function audit(
  id: string,
  actorId: string,
  action: AuditEvent['action'],
  entityType: string,
  entityId: string,
  params: Record<string, string | number>,
  timestamp: string
): AuditEvent {
  return { id, actorId, action, entityType, entityId, descriptionParams: params, timestamp }
}

export function buildSeedAudit(): AuditEvent[] {
  return [
    audit('ae-001', 'u-mgr-01', 'PROJECT_CREATED', 'Project', 'p-001', { project: 'CDU-3 Refinery Unit' }, `${isoOffset(-252)}T10:00:00`),
    audit('ae-002', 'u-mgr-01', 'SCHEDULE_UPLOADED', 'Project', 'p-001', { file: 'CDU3_Baseline_v1.xer', count: buildSeedActivities().length }, `${isoOffset(-250)}T11:30:00`),
    audit('ae-003', 'u-mgr-01', 'WORK_ASSIGNED', 'Assignment', 'a-001', { package: 'Aboveground Piping — Segment 24–26', supervisor: 'Rajesh Kumar' }, daysAgoIso(28)),
    audit('ae-004', 'u-mgr-01', 'WORK_ASSIGNED', 'Assignment', 'a-002', { package: 'Pumps — Process Area A', supervisor: 'Amit Singh' }, daysAgoIso(27)),
    audit('ae-005', 'u-mgr-01', 'WORK_ASSIGNED', 'Assignment', 'a-003', { package: 'Foundations — Process Area A', supervisor: 'Amit Singh' }, daysAgoIso(26)),
    audit('ae-006', 'u-mgr-01', 'WORK_ASSIGNED', 'Assignment', 'a-004', { package: 'Firewater & Drainage Network', supervisor: 'Rajesh Kumar' }, daysAgoIso(25)),
    audit('ae-007', 'u-mgr-01', 'QUESTION_ASKED', 'Thread', 't-002', { activity: 'CIV-L6-101A' }, `${daysAgoIso(15)}T10:00:00`),
    audit('ae-008', 'u-sup-02', 'REPLY_SENT', 'Thread', 't-002', { actor: 'Amit Singh' }, `${daysAgoIso(14)}T08:15:00`),
    audit('ae-009', 'u-mgr-01', 'REPLY_SENT', 'Thread', 't-002', { actor: 'Priya Sharma' }, `${daysAgoIso(13)}T11:20:00`),
    audit('ae-010', 'u-sup-02', 'REPLY_SENT', 'Thread', 't-002', { actor: 'Amit Singh' }, `${daysAgoIso(12)}T07:45:00`),
    audit('ae-011', 'u-sup-02', 'THREAD_RESOLVED', 'Thread', 't-002', {}, `${daysAgoIso(12)}T07:46:00`),
    audit('ae-012', 'u-sup-01', 'REPORT_SUBMITTED', 'Report', 'r-101', { supervisor: 'Rajesh Kumar', source: 'Text' }, `${daysAgoIso(3)}T18:12:00`),
    audit('ae-013', 'u-sup-01', 'AI_PROCESSED', 'Report', 'r-101', { matched: 2, flagged: 0 }, `${daysAgoIso(3)}T18:12:01`),
    audit('ae-014', 'u-mgr-01', 'AI_REVIEW_ACCEPTED', 'AiMatch', 'aim-101a', { activity: 'PIP-L6-024' }, `${daysAgoIso(3)}T18:30:00`),
    audit('ae-015', 'u-mgr-01', 'AI_REVIEW_ACCEPTED', 'AiMatch', 'aim-101b', { activity: 'PIP-L6-024W' }, `${daysAgoIso(3)}T18:31:00`),
    audit('ae-016', 'u-sup-01', 'REPORT_SUBMITTED', 'Report', 'r-102', { supervisor: 'Rajesh Kumar', source: 'Voice' }, `${daysAgoIso(2)}T17:45:00`),
    audit('ae-017', 'u-sup-01', 'AI_PROCESSED', 'Report', 'r-102', { matched: 1, flagged: 1 }, `${daysAgoIso(2)}T17:45:01`),
    audit('ae-018', 'u-sup-01', 'AI_AUTO_APPROVED', 'AiMatch', 'aim-102a', { extracted: 'Line 24 eighty percent erected.', activity: 'PIP-L6-024', confidence: 91 }, `${daysAgoIso(2)}T17:45:02`),
    audit('ae-019', 'u-sup-02', 'REPORT_SUBMITTED', 'Report', 'r-201', { supervisor: 'Amit Singh', source: 'Text' }, `${daysAgoIso(3)}T19:05:00`),
    audit('ae-020', 'u-sup-02', 'AI_PROCESSED', 'Report', 'r-201', { matched: 1, flagged: 0 }, `${daysAgoIso(3)}T19:05:01`),
    audit('ae-021', 'u-sup-02', 'AI_AUTO_APPROVED', 'AiMatch', 'aim-201a', { extracted: 'P-101A baseplate grouted', activity: 'ROT-L6-088', confidence: 93 }, `${daysAgoIso(3)}T19:05:02`),
    audit('ae-022', 'u-sup-02', 'REPORT_SUBMITTED', 'Report', 'r-202', { supervisor: 'Amit Singh', source: 'Document' }, `${daysAgoIso(2)}T18:30:00`),
    audit('ae-023', 'u-sup-02', 'AI_PROCESSED', 'Report', 'r-202', { matched: 1, flagged: 1 }, `${daysAgoIso(2)}T18:30:01`),
    audit('ae-024', 'u-mgr-01', 'AI_REVIEW_ACCEPTED', 'AiMatch', 'aim-202a', { activity: 'CIV-L6-101B' }, `${daysAgoIso(2)}T18:45:00`),
    audit('ae-025', 'u-mgr-01', 'QUESTION_ASKED', 'Thread', 't-001', { activity: 'ROT-L6-089' }, `${daysAgoIso(1)}T09:30:00`),
  ]
}

export const SEED_INSIGHTS: InsightAggregate = {
  plannedVsActual: [
    { discipline: 'CIVIL', planned: 42, actual: 46 },
    { discipline: 'PIPING', planned: 60, actual: 67 },
    { discipline: 'EQUIPMENT', planned: 30, actual: 31 },
    { discipline: 'ELECTRICAL', planned: 45, actual: 44 },
    { discipline: 'INSTRUMENTATION', planned: 25, actual: 27 },
    { discipline: 'HSE', planned: 12, actual: 12 },
  ],
  delayReasons: [
    { code: 'MATERIAL', count: 34 },
    { code: 'PERMIT', count: 21 },
    { code: 'MANPOWER', count: 18 },
    { code: 'WEATHER', count: 12 },
    { code: 'EQUIPMENT', count: 9 },
    { code: 'DESIGN_CHANGE', count: 6 },
  ],
  productivity: [
    { month: 'Apr', planned: 100, actual: 92 },
    { month: 'May', planned: 100, actual: 95 },
    { month: 'Jun', planned: 100, actual: 88 },
    { month: 'Jul', planned: 100, actual: 91 },
    { month: 'Aug', planned: 100, actual: 94 },
    { month: 'Sep', planned: 100, actual: 96 },
  ],
  topDelayed: [
    { name: 'Spool erection (large bore)', occurrences: 14, avgDaysLate: 5 },
    { name: 'Cable pulling', occurrences: 9, avgDaysLate: 3 },
    { name: 'Equipment unloading & staging', occurrences: 7, avgDaysLate: 4 },
    { name: 'Hydro test', occurrences: 6, avgDaysLate: 2 },
    { name: 'Foundation pour', occurrences: 5, avgDaysLate: 3 },
  ],
  disciplineOnTime: [
    { discipline: 'HSE', onTimePct: 92 },
    { discipline: 'EQUIPMENT', onTimePct: 84 },
    { discipline: 'ELECTRICAL', onTimePct: 78 },
    { discipline: 'INSTRUMENTATION', onTimePct: 74 },
    { discipline: 'CIVIL', onTimePct: 71 },
    { discipline: 'PIPING', onTimePct: 63 },
  ],
  patterns: [
    { id: 'pat-1', titleKey: 'insights.pattern1Title', bodyKey: 'insights.pattern1Body' },
    { id: 'pat-2', titleKey: 'insights.pattern2Title', bodyKey: 'insights.pattern2Body' },
    { id: 'pat-3', titleKey: 'insights.pattern3Title', bodyKey: 'insights.pattern3Body' },
    { id: 'pat-4', titleKey: 'insights.pattern4Title', bodyKey: 'insights.pattern4Body' },
  ],
}

export function recomputeRollups(activities: ScheduleActivity[]): void {
  const byParent = new Map<string, ScheduleActivity[]>()
  activities.forEach((a) => {
    if (!a.parentId) return
    const list = byParent.get(a.parentId) ?? []
    list.push(a)
    byParent.set(a.parentId, list)
  })

  const order = ['L6', 'L5', 'L4', 'L3', 'L2', 'L1'] as ActivityLevel[]

  order.forEach((level) => {
    activities
      .filter((a) => a.level === level)
      .forEach((parent) => {
        const children = byParent.get(parent.id) ?? []
        if (children.length === 0) return
        parent.progressPct = Math.round(children.reduce((sum, c) => sum + c.progressPct, 0) / children.length)
        parent.status = rollup(children.map((c) => c.status))
      })
  })
}

function rollup(statuses: ActivityStatus[]): ActivityStatus {
  if (statuses.every((s) => s === 'COMPLETED')) return 'COMPLETED'
  if (statuses.some((s) => s === 'DELAYED')) return 'DELAYED'
  if (statuses.some((s) => s === 'ON_HOLD')) return 'ON_HOLD'
  if (statuses.some((s) => s === 'IN_PROGRESS')) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

export function applyAssignments(activities: ScheduleActivity[], assignments: Assignment[]): void {
  activities.forEach((a) => {
    a.assigneeId = undefined
  })
  assignments.forEach((asgn) => {
    asgn.includedL6Ids.forEach((id) => {
      const act = activities.find((a) => a.id === id)
      if (act) act.assigneeId = asgn.supervisorId
    })
  })
}
