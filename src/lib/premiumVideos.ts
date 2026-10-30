import { findCurriculumLesson, type CurriculumLesson } from "@/lib/curriculum";

/**
 * Premium extra videos (owner request, 2026-10-31): one Vimeo video per
 * curriculum lesson, on their own page for Premium students. Stored in
 * premium_lesson_videos (migration 0100), read only through the server.
 */
export type PremiumVideoRow = {
  curriculum_key: string;
  video_url: string;
  title: string | null;
};

export type PremiumVideo = {
  key: string;
  level: string;
  unit: number;
  unitTitle: string;
  position: number;
  lessonTitle: string;
  title: string;
  /** Null for a free student: the link is handed out only to Premium. */
  url: string | null;
};

/** A curriculum lesson key that can hold an extra video (never the review Test). */
export function premiumVideoLesson(key: string): CurriculumLesson | null {
  const lesson = findCurriculumLesson(key);
  return lesson && !lesson.isReviewTest ? lesson : null;
}

/** Rows to the page's list, in study order; rows of unknown lessons are dropped. */
export function premiumVideoList(rows: PremiumVideoRow[], withLinks: boolean): PremiumVideo[] {
  return rows
    .flatMap((row) => {
      const lesson = premiumVideoLesson(row.curriculum_key);
      if (!lesson) return [];
      return [
        {
          key: lesson.key,
          level: lesson.level,
          unit: lesson.unit,
          unitTitle: lesson.unitTitle,
          position: lesson.position,
          lessonTitle: lesson.title,
          title: row.title?.trim() || lesson.title,
          url: withLinks ? row.video_url : null,
        },
      ];
    })
    .sort((a, b) =>
      a.level === b.level
        ? a.unit - b.unit || a.position - b.position
        : a.level.localeCompare(b.level),
    );
}
