import { studyToday } from "@/lib/today";

export type LatencyRow = {
  operation: string;
  created_at: string;
  success: boolean | null;
  duration_ms: number | null;
};

export type LatencyCell = { calls: number; medianMs: number | null };

export type LatencyTrend = {
  /** Study days (São Paulo), oldest first, only days with at least one call. */
  days: string[];
  operations: Array<{ operation: string; cells: Record<string, LatencyCell> }>;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(
    sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
  );
}

/**
 * Median answer time per operation and study day, so the admin can see whether
 * a speed change actually reached students. Only successful calls count toward
 * the time: a timeout or cancellation would hide a real improvement.
 */
export function latencyByDay(rows: LatencyRow[], maxDays = 14): LatencyTrend {
  const groups = new Map<string, Map<string, { calls: number; durations: number[] }>>();
  const allDays = new Set<string>();
  for (const row of rows) {
    const day = studyToday(new Date(row.created_at));
    allDays.add(day);
    let byDay = groups.get(row.operation);
    if (!byDay) groups.set(row.operation, (byDay = new Map()));
    let cell = byDay.get(day);
    if (!cell) byDay.set(day, (cell = { calls: 0, durations: [] }));
    cell.calls++;
    if (row.success !== false && typeof row.duration_ms === "number")
      cell.durations.push(row.duration_ms);
  }
  const days = [...allDays].sort().slice(-maxDays);
  const operations = [...groups.entries()]
    .map(([operation, byDay]) => {
      const cells: Record<string, LatencyCell> = {};
      for (const day of days) {
        const cell = byDay.get(day);
        if (cell) cells[day] = { calls: cell.calls, medianMs: median(cell.durations) };
      }
      return { operation, cells };
    })
    .filter((entry) => Object.keys(entry.cells).length > 0)
    .sort(
      (a, b) =>
        Object.values(b.cells).reduce((sum, cell) => sum + cell.calls, 0) -
        Object.values(a.cells).reduce((sum, cell) => sum + cell.calls, 0),
    );
  return { days, operations };
}
