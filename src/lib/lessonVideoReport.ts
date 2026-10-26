/**
 * Admin → Vídeos (audit, 2026-10-25): for every curriculum lesson of a level,
 * the video the owner approved and the videos students actually got, most
 * used first. Pure, so it is tested; the server reads the rows.
 */
import type { CurriculumLesson } from "./curriculum";
import { youtubeVideoId } from "./lessonVideoDisplay";

export type LessonVideoRow = {
  curriculum_key: string | null;
  video_url: string | null;
  video_duration_seconds: number | null;
};

export type ApprovedVideoRow = {
  curriculum_key: string;
  video_url: string;
  video_seconds: number | null;
  /** Null when the app chose it ("Buscar vídeos do nível"), not the owner. */
  approved_by?: string | null;
};

export type LessonVideoReportItem = {
  key: string;
  unit: number;
  unitTitle: string;
  position: number;
  title: string;
  objective: string;
  skill: string;
  approved: { url: string; id: string; seconds: number | null; auto: boolean } | null;
  used: { url: string; id: string; seconds: number | null; lessons: number }[];
};

export function lessonVideoReport(
  curriculum: CurriculumLesson[],
  approved: ApprovedVideoRow[],
  lessons: LessonVideoRow[],
): LessonVideoReportItem[] {
  return curriculum.map((plan) => {
    const counts = new Map<
      string,
      { url: string; id: string; seconds: number | null; lessons: number }
    >();
    for (const row of lessons) {
      if (row.curriculum_key !== plan.key || !row.video_url) continue;
      const id = youtubeVideoId(row.video_url);
      if (!id) continue;
      const entry = counts.get(id) ?? {
        url: row.video_url,
        id,
        seconds: row.video_duration_seconds || null,
        lessons: 0,
      };
      entry.lessons += 1;
      counts.set(id, entry);
    }
    const mine = approved.find((row) => row.curriculum_key === plan.key);
    const approvedId = mine ? youtubeVideoId(mine.video_url) : null;
    return {
      key: plan.key,
      unit: plan.unit,
      unitTitle: plan.unitTitle,
      position: plan.position,
      title: plan.title,
      objective: plan.objective,
      skill: plan.skill,
      approved:
        mine && approvedId
          ? {
              url: mine.video_url,
              id: approvedId,
              seconds: mine.video_seconds,
              auto: mine.approved_by === null,
            }
          : null,
      used: [...counts.values()].sort((a, b) => b.lessons - a.lessons),
    };
  });
}

/** The one stored form of a YouTube link, or null when it is not one. */
export function canonicalYoutubeUrl(input: string): string | null {
  const id = youtubeVideoId(input.trim());
  if (!id || !/^[A-Za-z0-9_-]{11}/.test(id)) return null;
  return `https://www.youtube.com/watch?v=${id.slice(0, 11)}`;
}

export type VideoInfo = { title?: string; author_name?: string } | null | undefined;

function durationText(seconds: number | null): string {
  if (!seconds) return "duração ?";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The level's lessons and their videos as plain text (owner request,
 * 2026-10-25: paste it into the chat so the fit of each video can be judged by
 * its title, channel and length; Claude's environment cannot reach YouTube).
 */
export function lessonVideoListText(
  level: string,
  items: LessonVideoReportItem[],
  infoOf: (id: string) => VideoInfo,
): string {
  const lines = [`Vídeos das lições · nível ${level.toUpperCase()}`, ""];
  for (const item of items) {
    lines.push(`U${item.unit} L${item.position} · ${item.title} (${item.skill}) [${item.key}]`);
    lines.push(`  Objetivo: ${item.objective}`);
    const videos = [
      ...(item.approved
        ? [{ ...item.approved, note: item.approved.auto ? "escolhido pelo app" : "aprovado" }]
        : []),
      ...item.used
        .filter((video) => video.id !== item.approved?.id)
        .map((video) => ({
          ...video,
          note: `${video.lessons} ${video.lessons === 1 ? "aluno" : "alunos"}`,
        })),
    ];
    if (videos.length === 0) lines.push("  (nenhum vídeo ainda)");
    for (const video of videos) {
      const info = infoOf(video.id);
      lines.push(
        `  - ${info?.title ?? "título indisponível"} · ${info?.author_name ?? "canal ?"} · ${durationText(video.seconds)} · ${video.note} · ${video.url}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
