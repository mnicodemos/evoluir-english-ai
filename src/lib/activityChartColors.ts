/**
 * Shared activity colors for My Progress charts.
 * Keep the same color for an activity across score lines and time bars.
 */
export const ACTIVITY_CHART_COLORS = {
  Lessons: "var(--color-primary)",
  Vocabulary: "oklch(0.62 0.18 300)",
  Listening: "var(--color-chart-1)",
  Reading: "var(--color-chart-2)",
  Talking: "var(--color-chart-3)",
  Writing: "var(--color-chart-4)",
  Grammar: "var(--color-primary)",
} as const;
