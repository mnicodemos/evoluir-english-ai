import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { runProgressMutation } from "@/lib/auth-retry";
import { dualWriteQuizEvidence } from "@/lib/pedagogy/dualWrite.functions";

export type Lesson = {
  id: string;
  title: string;
  category: string;
  level: string;
  objective: string;
  video_url: string | null;
  video_duration_seconds: number;
  summary: string;
  transcript: string;
  transcript_pt: string;
  sort_order: number;
  created_at: string;
  curriculum_key?: string | null;
  unit_number?: number;
  position_in_unit?: number;
  skill?: string;
};

export type Flashcard = {
  id: string;
  lesson_id: string | null;
  word: string;
  translation: string;
  definition: string;
  pronunciation: string;
  example: string;
  difficulty: string;
  prompt: string | null;
  answer: string | null;
  card_type: string | null;
  listen_text: string | null;
  sort_order: number | null;
};

export type QuizQuestion = {
  id: string;
  lesson_id: string;
  question: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  sort_order: number;
};

export type UserLesson = {
  lesson_id: string;
  video_progress: number;
  progress: number;
  completed_at: string | null;
};

export type UserFlashcard = {
  flashcard_id: string;
  mastery_level: number;
  times_reviewed: number;
  last_rating: string | null;
  interval_days: number;
  next_review_date: string;
};

/** All lessons of the Learning Center. */
export function useLessons() {
  return useQuery({
    queryKey: ["lessons"],
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await supabase.from("lessons").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Lesson[];
    },
  });
}

/** The signed-in student's progress on every lesson. */
export function useUserLessons() {
  return useQuery({
    queryKey: ["user-lessons"],
    queryFn: async (): Promise<UserLesson[]> => {
      const { data, error } = await supabase
        .from("user_lessons")
        .select("lesson_id, video_progress, progress, completed_at");
      if (error) throw error;
      return (data ?? []) as UserLesson[];
    },
  });
}

export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const [lesson, flashcards, quiz, mine] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
        supabase
          .from("flashcards")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("sort_order")
          .order("created_at"),
        supabase.from("quizzes").select("*").eq("lesson_id", lessonId).order("sort_order"),
        supabase
          .from("user_lessons")
          .select("lesson_id, video_progress, progress, completed_at")
          .eq("lesson_id", lessonId)
          .maybeSingle(),
      ]);
      return {
        lesson: (lesson.data ?? null) as Lesson | null,
        flashcards: (flashcards.data ?? []) as Flashcard[],
        quiz: ((quiz.data ?? []) as unknown[]).map((q) => {
          const row = q as QuizQuestion & { options: unknown };
          return { ...row, options: Array.isArray(row.options) ? (row.options as string[]) : [] };
        }) as QuizQuestion[],
        userLesson: (mine.data ?? null) as UserLesson | null,
      };
    },
  });
}

/** Every flashcard available in the Learning Center. */
export function useAllFlashcards() {
  return useQuery({
    queryKey: ["all-flashcards"],
    queryFn: async (): Promise<Flashcard[]> => {
      const { data, error } = await supabase.from("flashcards").select("*");
      if (error) throw error;
      return (data ?? []) as Flashcard[];
    },
  });
}

/** Flashcards the student is studying, with their review state. */
export function useUserFlashcards() {
  return useQuery({
    queryKey: ["user-flashcards"],
    queryFn: async (): Promise<UserFlashcard[]> => {
      const { data, error } = await supabase
        .from("user_flashcards")
        .select(
          "flashcard_id, mastery_level, times_reviewed, last_rating, interval_days, next_review_date",
        );
      if (error) throw error;
      return (data ?? []) as UserFlashcard[];
    },
  });
}

export function useQuizResults() {
  return useQuery({
    queryKey: ["quiz-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_results")
        .select("id, lesson_id, score, total_questions, correct_count, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Saves how much of the video was watched (0-100). The video only counts as
 * watched when it reaches the end or the student marks it as watched.
 */
export async function saveVideoProgress(
  userId: string,
  lessonId: string,
  percent: number,
  markWatched = false,
) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const watched = markWatched || clamped >= 99;
  const { data: existing } = await runProgressMutation(() =>
    supabase
      .from("user_lessons")
      .select("video_completed_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  );
  await runProgressMutation(() =>
    supabase.from("user_lessons").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        video_progress: watched ? 100 : clamped,
        video_completed_at: watched
          ? (existing?.video_completed_at ?? new Date().toISOString())
          : null,
      },
      { onConflict: "user_id,lesson_id" },
    ),
  );
}

/** Marks the whole lesson (flashcards + quiz) as finished. Video progress stays as watched. */
export async function completeLesson(userId: string, lessonId: string) {
  const now = new Date().toISOString();
  await runProgressMutation(() =>
    supabase.from("user_lessons").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        progress: 100,
        completed_at: now,
      },
      { onConflict: "user_id,lesson_id" },
    ),
  );
}

const intervalByRating: Record<string, (prev: number) => number> = {
  hard: () => 1,
  medium: (prev) => Math.max(2, Math.round(prev * 1.6)),
  easy: (prev) => Math.max(4, Math.round(prev * 2.5)),
};

const masteryDelta: Record<string, number> = { hard: -15, medium: 10, easy: 25 };

/** Spaced-repetition update: harder cards come back sooner. */
export async function reviewFlashcard(
  userId: string,
  flashcardId: string,
  rating: "easy" | "medium" | "hard",
  current?: UserFlashcard,
) {
  const prevInterval = current?.interval_days ?? 1;
  const interval = Math.min(60, intervalByRating[rating]!(prevInterval));
  const mastery = Math.max(0, Math.min(100, (current?.mastery_level ?? 0) + masteryDelta[rating]!));
  const next = new Date(Date.now() + interval * 86400000).toISOString().slice(0, 10);

  await runProgressMutation(() =>
    supabase.from("user_flashcards").upsert(
      {
        user_id: userId,
        flashcard_id: flashcardId,
        mastery_level: mastery,
        times_reviewed: (current?.times_reviewed ?? 0) + 1,
        last_rating: rating,
        interval_days: interval,
        next_review_date: next,
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,flashcard_id" },
    ),
  );
}

export async function saveQuizResult(params: {
  userId: string;
  lessonId: string;
  score: number;
  total: number;
  correct: number;
  details: {
    question_id: string;
    question: string;
    answer: string;
    correct_answer: string;
    is_correct: boolean;
  }[];
}) {
  const { data } = await runProgressMutation(() =>
    supabase
      .from("quiz_results")
      .insert({
        user_id: params.userId,
        lesson_id: params.lessonId,
        score: params.score,
        total_questions: params.total,
        correct_count: params.correct,
        details: params.details,
      })
      .select("id")
      .single(),
  );
  try {
    await dualWriteQuizEvidence({ data: { quizResultId: data.id } });
  } catch (error) {
    console.warn("Quiz result was saved; pedagogical dual write will be retried later", error);
  }
}
