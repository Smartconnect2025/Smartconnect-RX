/**
 * Period-window resolution for the Pay-on-Terms reconciliation report.
 *
 * The owner wants each scheduled email to cover ONE specific date window
 * (e.g. "yesterday", "the previous week", "the previous calendar month")
 * rather than a cumulative snapshot of everything currently outstanding.
 *
 * All windows are defined in US Eastern wall-clock time (handles EST/EDT
 * automatically) so that a "day" never gets split mid-business-day.
 *
 * The returned `start` is INCLUSIVE and `end` is EXCLUSIVE — i.e. the SQL
 * filter is `submitted_at >= start AND submitted_at < end`.
 */

const ZONE = "America/New_York";

export type PotFrequency =
  | "off"
  | "daily"
  | "weekly_monday"
  | "weekly_friday"
  | "monthly_first";

export interface PeriodWindow {
  /** Inclusive start (UTC instant of midnight Eastern on the start day). */
  start: Date;
  /** Exclusive end (UTC instant of midnight Eastern on the day after the last day). */
  end: Date;
  /** Human-readable label, e.g. "Apr 26, 2026 (US Eastern)". */
  label: string;
  /** Short token for the subject line, e.g. "Apr 26", "Apr 20 → Apr 26", "April 2026". */
  shortLabel: string;
  /** Which frequency family this window represents. */
  kind: "daily" | "weekly" | "monthly" | "custom";
}

/** Date-component view of a UTC instant rendered in Eastern time. */
function easternParts(d: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0=Sun..6=Sat
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

/**
 * Add `delta` days (positive or negative) to an Eastern calendar date.
 * Uses pure calendar arithmetic via `Date.UTC` so it is immune to DST —
 * adding 1 day to "Fall-Back Saturday" never lands you on the same day,
 * and subtracting 1 day from "Spring-Forward Monday" never overshoots.
 */
export function easternDateAddDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Returns the UTC instant corresponding to midnight (00:00) on the given
 * Eastern calendar day. Robust to EST/EDT (DST) by trial: try UTC offsets
 * 4h and 5h and pick the one that round-trips cleanly.
 */
export function easternMidnightUtc(year: number, month: number, day: number): Date {
  for (const hourOffset of [4, 5]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hourOffset, 0, 0));
    const parts = easternParts(candidate);
    if (parts.year === year && parts.month === month && parts.day === day) {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONE,
        hour: "2-digit",
        hour12: false,
      });
      const hourMap: Record<string, string> = {};
      for (const p of fmt.formatToParts(candidate)) hourMap[p.type] = p.value;
      // "24" can show up for midnight in some runtimes — accept either.
      if (hourMap.hour === "00" || hourMap.hour === "24") return candidate;
    }
  }
  // Fallback to EST if both probes fail (should never happen).
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtEasternDate(d: Date): string {
  const p = easternParts(d);
  return `${MONTH_SHORT[p.month - 1]} ${p.day}, ${p.year}`;
}

function fmtEasternDateShort(d: Date): string {
  const p = easternParts(d);
  return `${MONTH_SHORT[p.month - 1]} ${p.day}`;
}

/**
 * Compute the canonical scheduled window for `frequency` evaluated at `now`.
 *
 *  - daily          → previous Eastern calendar day
 *  - weekly_monday  → previous 7 days ending today (so cron firing Monday
 *                     reports Mon..Sun of the past week)
 *  - weekly_friday  → previous 7 days ending today (so cron firing Friday
 *                     reports Fri..Thu of the past week)
 *  - monthly_first  → previous calendar month
 *  - off / unknown  → falls back to "today so far" (one-shot manual default)
 */
export function resolveScheduledWindow(
  frequency: string,
  now: Date,
): PeriodWindow {
  const todayE = easternParts(now);
  const todayStartUtc = easternMidnightUtc(todayE.year, todayE.month, todayE.day);

  if (frequency === "daily") {
    const yE = easternDateAddDays(todayE.year, todayE.month, todayE.day, -1);
    const start = easternMidnightUtc(yE.year, yE.month, yE.day);
    const end = todayStartUtc;
    return {
      start,
      end,
      label: `${fmtEasternDate(start)} (US Eastern)`,
      shortLabel: fmtEasternDateShort(start),
      kind: "daily",
    };
  }

  if (frequency === "weekly_monday" || frequency === "weekly_friday") {
    const sE = easternDateAddDays(todayE.year, todayE.month, todayE.day, -7);
    const lastE = easternDateAddDays(todayE.year, todayE.month, todayE.day, -1);
    const start = easternMidnightUtc(sE.year, sE.month, sE.day);
    const lastIncluded = easternMidnightUtc(lastE.year, lastE.month, lastE.day);
    return {
      start,
      end: todayStartUtc,
      label: `${fmtEasternDate(start)} → ${fmtEasternDate(lastIncluded)} (US Eastern)`,
      shortLabel: `${fmtEasternDateShort(start)} → ${fmtEasternDateShort(lastIncluded)}`,
      kind: "weekly",
    };
  }

  if (frequency === "monthly_first") {
    const end = easternMidnightUtc(todayE.year, todayE.month, 1);
    const prevMonth = todayE.month === 1 ? 12 : todayE.month - 1;
    const prevYear = todayE.month === 1 ? todayE.year - 1 : todayE.year;
    const start = easternMidnightUtc(prevYear, prevMonth, 1);
    return {
      start,
      end,
      label: `${MONTH_NAMES[prevMonth - 1]} ${prevYear} (US Eastern)`,
      shortLabel: `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`,
      kind: "monthly",
    };
  }

  // off / unknown — degrade to "today so far" so a manual default still works.
  return {
    start: todayStartUtc,
    end: now,
    label: `${fmtEasternDate(todayStartUtc)} so far (US Eastern)`,
    shortLabel: `${fmtEasternDateShort(todayStartUtc)} (partial)`,
    kind: "custom",
  };
}

/**
 * Build a window from explicit From / To dates supplied by the admin in the
 * Send Now dialog. `fromYmd` / `toYmd` are "YYYY-MM-DD" strings interpreted
 * in Eastern time. `toYmd` is INCLUSIVE on the calling side, but the
 * returned window's `end` is the exclusive midnight of the day AFTER toYmd.
 */
export function windowFromYmdRange(fromYmd: string, toYmd: string): PeriodWindow {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  if (![fy, fm, fd, ty, tm, td].every((n) => Number.isFinite(n))) {
    throw new Error(`Invalid From/To dates: ${fromYmd} / ${toYmd}`);
  }
  const start = easternMidnightUtc(fy, fm, fd);
  // end = midnight at start of (toYmd + 1 calendar day) so toYmd is fully
  // INCLUDED. Use calendar arithmetic so DST "fall-back" days (25-hour days)
  // don't collapse the window to zero length.
  const dA = easternDateAddDays(ty, tm, td, 1);
  const end = easternMidnightUtc(dA.year, dA.month, dA.day);

  if (end.getTime() <= start.getTime()) {
    throw new Error("From date must be on or before To date");
  }

  const startLabel = fmtEasternDate(start);
  const endLabel = fmtEasternDate(easternMidnightUtc(ty, tm, td));
  const sameDay = fromYmd === toYmd;
  return {
    start,
    end,
    label: sameDay ? `${startLabel} (US Eastern)` : `${startLabel} → ${endLabel} (US Eastern)`,
    shortLabel: sameDay
      ? fmtEasternDateShort(start)
      : `${fmtEasternDateShort(start)} → ${fmtEasternDateShort(easternMidnightUtc(ty, tm, td))}`,
    kind: "custom",
  };
}

/**
 * Format a UTC instant as a Y-M-D string in Eastern time. Used by the UI to
 * pre-fill the From/To pickers with the right local date.
 */
export function easternYmd(d: Date): string {
  const p = easternParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
