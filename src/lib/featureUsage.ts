/**
 * Admin → Retenção "Uso dos recursos" (owner request, 2026-10-31: measure the
 * features added since 24/10 to decide what to keep and where to put content):
 * for each feature, how many students used it and how many times, in the last
 * 7 and 30 days. Admins are left out, like the other retention numbers.
 */

export const FEATURE_USAGE = [
  { id: "extra_video", label: "Vídeos extras e shorts assistidos" },
  { id: "video_like", label: "Curtidas nos shorts" },
  { id: "video_comment", label: "Comentários nos shorts" },
  { id: "lesson_media", label: "Áudio ou vídeo da lição ouvido até o fim" },
  { id: "flashcards", label: "Cards revisados (última revisão no período)" },
  { id: "quiz", label: "Quizzes enviados (lição, unidade e Teste Final)" },
  { id: "daily_reading", label: "Leitura do dia concluída" },
  { id: "conversation", label: "Conversas com a EVO com relatório" },
] as const;

export type FeatureId = (typeof FEATURE_USAGE)[number]["id"];

export type FeatureEvent = { feature: FeatureId; userId: string; at: string };

export type FeatureUsageRow = {
  id: FeatureId;
  label: string;
  /** False when the feature's table could not be read (e.g. a migration not applied). */
  available: boolean;
  students7: number;
  uses7: number;
  students30: number;
  uses30: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function featureUsageReport(
  events: FeatureEvent[],
  options: { adminIds: Set<string>; unavailable?: Set<FeatureId>; now?: Date },
): FeatureUsageRow[] {
  const now = (options.now ?? new Date()).getTime();
  const since7 = now - 7 * DAY_MS;
  const since30 = now - 30 * DAY_MS;
  return FEATURE_USAGE.map(({ id, label }) => {
    const students7 = new Set<string>();
    const students30 = new Set<string>();
    let uses7 = 0;
    let uses30 = 0;
    for (const event of events) {
      if (event.feature !== id || options.adminIds.has(event.userId)) continue;
      const at = Date.parse(event.at);
      if (!Number.isFinite(at) || at < since30 || at > now) continue;
      uses30 += 1;
      students30.add(event.userId);
      if (at >= since7) {
        uses7 += 1;
        students7.add(event.userId);
      }
    }
    return {
      id,
      label,
      available: !options.unavailable?.has(id),
      students7: students7.size,
      uses7,
      students30: students30.size,
      uses30,
    };
  });
}
