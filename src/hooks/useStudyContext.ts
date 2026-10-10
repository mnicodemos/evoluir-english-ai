import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useProfile } from "@/hooks/useProfile";
import { fetchUserVocabularyMastery } from "@/hooks/useUserVocabularyMastery";
import { supabase } from "@/integrations/supabase/client";
import { todayStudyMetrics } from "@/lib/studyDay";

export type StudySnapshot = {
  lessonsCompleted: number;
  lessonsTotal: number;
  videosWatched: number;
  vocabularyMastered: number;
  quizAverage: number;
  // Today's Progress metrics: same sources and thresholds as above, but only
  // rows with a completion timestamp from today count. The cumulative fields
  // stay untouched for AI context (VoiceCoach / AI Speaking).
  todayLessonsCompleted: number;
  todayVideosWatched: number;
  todayVocabularyMastered: number;
  todayQuizAverage: number;
  weakWords: string[];
  weakLessons: string[];
  commonErrors: string[];
};

/** Aggregates lessons, videos, flashcards and quizzes for the current level — used by the dashboard and AI Speaking. */
export function useStudySnapshot() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["study-snapshot", profile?.id, profile?.level],
    enabled: !!profile,
    queryFn: async (): Promise<StudySnapshot> => {
      const level = profile!.level;
      const { data: levelLessons } = await supabase
        .from("lessons")
        .select("id, title")
        .like("curriculum_key", `${level}-%`);
      const lessons = levelLessons ?? [];
      const lessonIds = new Set(lessons.map((l) => l.id));
      const lessonTitle = new Map(lessons.map((l) => [l.id, l.title]));

      const [userLessons, userCards, masteredWords, results, lp, levelCards, levelWords] =
        await Promise.all([
          supabase
            .from("user_lessons")
            .select("lesson_id, video_progress, video_completed_at, completed_at")
            .eq("user_id", profile!.id),
          supabase
            .from("user_flashcards")
            .select("flashcard_id, mastery_level, last_rating, times_reviewed, last_reviewed_at")
            .eq("user_id", profile!.id),
          fetchUserVocabularyMastery(queryClient),
          supabase
            .from("quiz_results")
            .select("lesson_id, score, created_at")
            .eq("user_id", profile!.id)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("learning_profile")
            .select("common_errors")
            .eq("user_id", profile!.id)
            .maybeSingle(),
          lessons.length
            ? supabase
                .from("flashcards")
                .select("id, word")
                .in(
                  "lesson_id",
                  lessons.map((l) => l.id),
                )
            : Promise.resolve({ data: [] }),
          supabase.from("vocabulary").select("id, level, lesson_id"),
        ]);

      const levelCardIds = new Set((levelCards.data ?? []).map((c) => c.id));
      // A word belongs to this level when it is tagged with the level. Words without a tag
      // fall back to the lesson link, but a tag always wins so mastered words never leak
      // into another level when the student changes level.
      const levelWordIds = new Set(
        (levelWords.data ?? [])
          .filter((w) => (w.level ? w.level === level : w.lesson_id && lessonIds.has(w.lesson_id)))
          .map((w) => w.id),
      );

      // Only cards the student actually answered and mastered count (restricted to this level's lessons).
      const cardsRows = (userCards.data ?? []).filter((card) =>
        levelCardIds.has(card.flashcard_id),
      );
      const masteredCardIds = new Set(
        cardsRows
          .filter((card) => card.times_reviewed > 0 && card.mastery_level >= 70)
          .map((card) => card.flashcard_id),
      );
      const weakIds = cardsRows
        .filter((c) => c.mastery_level < 50 || c.last_rating === "hard")
        .map((c) => c.flashcard_id);
      const cardWord = new Map((levelCards.data ?? []).map((c) => [c.id, c.word]));
      const weakWords = Array.from(
        new Set(weakIds.map((id) => cardWord.get(id) ?? "").filter(Boolean)),
      ).slice(0, 8);

      const quizRows = (results.data ?? []).filter(
        (r) => r.lesson_id && lessonIds.has(r.lesson_id),
      );
      const quizAverage = quizRows.length
        ? Math.round(quizRows.reduce((sum, r) => sum + r.score, 0) / quizRows.length)
        : 0;

      const weakLessons = Array.from(
        new Set(
          quizRows
            .filter((r) => r.score < 70 && r.lesson_id)
            .map((r) => lessonTitle.get(r.lesson_id as string) ?? "")
            .filter(Boolean),
        ),
      ).slice(0, 3);

      const myLessons = (userLessons.data ?? []).filter((l) => lessonIds.has(l.lesson_id));

      // Today's Progress: each metric needs a completion timestamp from today —
      // opening a screen never counts. Unlike the level totals above, it counts
      // every lesson done today, Business English and level reviews included
      // (user request), since a timestamp from today never leaks another level.
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const today = todayStudyMetrics(
        {
          lessons: (userLessons.data ?? []).map((l) => ({
            completed_at: l.completed_at ?? null,
            video_completed_at: l.video_completed_at ?? null,
          })),
          cards: (userCards.data ?? []).map((c) => ({
            mastery_level: c.mastery_level ?? 0,
            times_reviewed: c.times_reviewed ?? 0,
            last_reviewed_at: c.last_reviewed_at ?? null,
          })),
          words: masteredWords.map((w) => ({
            mastery_level: w.mastery_level,
            last_reviewed_at: w.last_reviewed_at,
          })),
          quizzes: (results.data ?? []).map((q) => ({
            score: q.score,
            created_at: q.created_at ?? null,
          })),
        },
        dayStart,
      );

      return {
        lessonsCompleted: myLessons.filter((l) => l.completed_at).length,
        lessonsTotal: lessons.length,
        videosWatched: myLessons.filter((l) => l.video_completed_at || l.video_progress >= 99)
          .length,
        vocabularyMastered:
          masteredCardIds.size +
          masteredWords.filter((w) => levelWordIds.has(w.word_id) && w.mastery_level >= 75).length,
        quizAverage,
        todayLessonsCompleted: today.lessonsCompleted,
        todayVideosWatched: today.videosWatched,
        todayVocabularyMastered: today.vocabularyMastered,
        todayQuizAverage: today.quizAverage,
        weakWords,
        weakLessons,
        commonErrors: (lp.data?.common_errors ?? []).slice(-5),
      };
    },
  });
}

/** Short text summary of the study history sent to AI Speaking. */
export function buildStudyContext(s?: StudySnapshot | null) {
  if (!s) return undefined;
  const lines = [
    `Lessons completed: ${s.lessonsCompleted}/${s.lessonsTotal}. Videos watched: ${s.videosWatched}.`,
    `Average quiz score: ${s.quizAverage}%. Words mastered: ${s.vocabularyMastered}.`,
  ];
  if (s.weakLessons.length)
    lines.push(`Lessons with a low quiz score: ${s.weakLessons.join(", ")}.`);
  if (s.weakWords.length)
    lines.push(`Words the student finds difficult: ${s.weakWords.join(", ")}.`);
  if (s.commonErrors.length) lines.push(`Recurring mistakes: ${s.commonErrors.join("; ")}.`);
  return lines.join("\n");
}
