// Retention for the owner: how many students come back after signing up.
// Pure rules over São Paulo dates (yyyy-mm-dd), so the Admin numbers are
// testable without the database.
//
// A student "was active" on a day when anything they did was recorded that day
// (an activity, a finished lesson or an AI reply). Opening the app without
// doing anything leaves no trace and does not count.

export type RetentionStudent = { id: string; joined: string };

export type Rate = { eligible: number; returned: number; percent: number | null };

export type RetentionCohort = {
  weekStart: string;
  size: number;
  d1: Rate;
  week1: Rate;
  week2: Rate;
};

export type RetentionReport = {
  students: number;
  activeToday: number;
  active7: number;
  active30: number;
  d1: Rate;
  week1: Rate;
  week2: Rate;
  /** Joined at least 2 days ago and never did anything after the signup day. */
  neverReturned: Rate;
  cohorts: RetentionCohort[];
};

const DAY_MS = 86_400_000;

/** [eligible, returned] */
type Tally = [number, number];

function toTime(day: string) {
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: string, days: number) {
  return new Date(toTime(day) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

/** Monday of the week of `day`. */
export function weekStart(day: string) {
  const weekday = new Date(toTime(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

function rate(eligible: number, returned: number): Rate {
  return {
    eligible,
    returned,
    percent: eligible ? Math.round((returned / eligible) * 100) : null,
  };
}

/** Whether the student was active on any day `from`..`to` days after joining. */
function activeBetween(days: Set<string> | undefined, joined: string, from: number, to: number) {
  if (!days) return false;
  for (const day of days) {
    const offset = daysBetween(joined, day);
    if (offset >= from && offset <= to) return true;
  }
  return false;
}

/**
 * - D1: active on the day after signing up (needs that day to be over).
 * - Week 1: came back on any day 1–7 after signing up.
 * - Week 2: still around the following week, days 8–14.
 */
export function retentionReport(
  students: RetentionStudent[],
  activeDays: Map<string, Set<string>>,
  today: string,
  weeks = 8,
): RetentionReport {
  const windowStart = weekStart(addDays(today, -7 * (weeks - 1)));
  const counts: Record<"d1" | "week1" | "week2" | "never", Tally> = {
    d1: [0, 0],
    week1: [0, 0],
    week2: [0, 0],
    never: [0, 0],
  };
  const cohorts = new Map<string, { size: number; d1: Tally; week1: Tally; week2: Tally }>();
  let activeToday = 0;
  let active7 = 0;
  let active30 = 0;

  for (const student of students) {
    const days = activeDays.get(student.id);
    const recent = (span: number) =>
      [...(days ?? [])].some((day) => {
        const ago = daysBetween(day, today);
        return ago >= 0 && ago < span;
      });
    if (days?.has(today)) activeToday += 1;
    if (recent(7)) active7 += 1;
    if (recent(30)) active30 += 1;

    if (student.joined < windowStart) continue;
    const age = daysBetween(student.joined, today);
    const key = weekStart(student.joined);
    const cohort = cohorts.get(key) ?? {
      size: 0,
      d1: [0, 0] as Tally,
      week1: [0, 0] as Tally,
      week2: [0, 0] as Tally,
    };
    cohort.size += 1;
    const track = (
      bucket: Tally,
      cohortBucket: Tally,
      minAge: number,
      from: number,
      to: number,
    ) => {
      if (age < minAge) return;
      const back = activeBetween(days, student.joined, from, to);
      bucket[0] += 1;
      cohortBucket[0] += 1;
      if (back) {
        bucket[1] += 1;
        cohortBucket[1] += 1;
      }
    };
    track(counts.d1, cohort.d1, 2, 1, 1);
    track(counts.week1, cohort.week1, 8, 1, 7);
    track(counts.week2, cohort.week2, 15, 8, 14);
    if (age >= 2) {
      counts.never[0] += 1;
      if (!activeBetween(days, student.joined, 1, Number.MAX_SAFE_INTEGER)) counts.never[1] += 1;
    }
    cohorts.set(key, cohort);
  }

  return {
    students: students.length,
    activeToday,
    active7,
    active30,
    d1: rate(counts.d1[0], counts.d1[1]),
    week1: rate(counts.week1[0], counts.week1[1]),
    week2: rate(counts.week2[0], counts.week2[1]),
    neverReturned: rate(counts.never[0], counts.never[1]),
    cohorts: [...cohorts.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([start, cohort]) => ({
        weekStart: start,
        size: cohort.size,
        d1: rate(cohort.d1[0], cohort.d1[1]),
        week1: rate(cohort.week1[0], cohort.week1[1]),
        week2: rate(cohort.week2[0], cohort.week2[1]),
      })),
  };
}

export type FirstConversation = {
  /** Spoke to EVO within 24 h of signing up (among students who joined over 24 h ago). */
  firstDay: Rate;
  /** Median minutes from signing up to the first spoken answer, among those who spoke. */
  medianMinutes: number | null;
};

/**
 * How fast new students reach their first conversation with EVO: the goal of
 * the onboarding is under 2 minutes after the plan is created.
 */
export function firstConversationStats(
  students: { id: string; joinedAt: string }[],
  firstAnswerAt: Map<string, string>,
  now: Date,
): FirstConversation {
  const DAY = 24 * 60 * 60 * 1000;
  let eligible = 0;
  let spoke = 0;
  const minutes: number[] = [];
  for (const student of students) {
    const joined = Date.parse(student.joinedAt);
    const first = firstAnswerAt.get(student.id);
    const elapsed = first ? Date.parse(first) - joined : null;
    if (elapsed !== null && elapsed >= 0) minutes.push(elapsed / 60_000);
    if (now.getTime() - joined < DAY) continue;
    eligible += 1;
    if (elapsed !== null && elapsed >= 0 && elapsed <= DAY) spoke += 1;
  }
  minutes.sort((a, b) => a - b);
  const middle = minutes.length / 2;
  const median = minutes.length
    ? minutes.length % 2
      ? minutes[Math.floor(middle)]!
      : (minutes[middle - 1]! + minutes[middle]!) / 2
    : null;
  return {
    firstDay: rate(eligible, spoke),
    medianMinutes: median === null ? null : Math.round(median),
  };
}
