/**
 * Shared activity colors for My Progress charts.
 * Keep the same color for an activity across score lines and time bars.
 */
export const ACTIVITY_CHART_COLORS = {
  Lessons: "#EC4899",
  Vocabulary: "oklch(0.62 0.18 300)",
  // Coral (owner decision, 2026-11-01): the grey chart-1 read as disabled.
  Listening: "var(--color-dashboard-coral)",
  Reading: "var(--color-chart-2)",
  Talking: "var(--color-chart-3)",
  Writing: "var(--color-chart-4)",
  Grammar: "#EC4899",
} as const;
