import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { useLessons, useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import {
  CORE_UNITS_PER_LEVEL,
  finalTestKey,
  finalTestLessonsRequired,
  getUnits,
  unitTestKey,
  type CurriculumLesson,
} from "@/lib/curriculum";
import { openCurriculumLesson, openFinalTest, openUnitTest } from "@/lib/curriculum.functions";
import { getLevelState } from "@/lib/level";

export type PathLesson = CurriculumLesson & {
  lessonId: string | null;
  started: boolean;
  completed: boolean;
  progress: number;
  locked: boolean;
};

export type PathUnit = { unit: number; title: string; lessons: PathLesson[]; completed: number };

export type UnitTestState = {
  unit: number;
  lessonId: string | null;
  unlocked: boolean;
  passed: boolean;
};

/**
 * The student's 30 core lessons and optional review unit, with lock state.
 * With `reviewLevel` (a level below the highest one reached) it returns that
 * level's path for review: every lesson open, the student's level unchanged.
 */
export function useLearningPath(reviewLevel?: string | null) {
  const { data: profile } = useProfile();
  const { data: lessons } = useLessons();
  const { data: mine } = useUserLessons();

  const review = !!reviewLevel;
  const level = getLevelState(reviewLevel ?? profile?.level).current.value;

  return useMemo(() => {
    const byKey = new Map(
      (lessons ?? [])
        .filter((l) => (l as { curriculum_key?: string | null }).curriculum_key)
        .map((l) => [(l as unknown as { curriculum_key: string }).curriculum_key, l]),
    );
    const stateOf = (lessonId: string | null) =>
      lessonId ? (mine ?? []).find((m) => m.lesson_id === lessonId) : undefined;

    let previousDone = true;
    const units: PathUnit[] = getUnits(level).map((unit) => {
      const list = unit.lessons.map((plan) => {
        const row = byKey.get(plan.key);
        const lessonId = (row?.id as string | undefined) ?? null;
        const state = stateOf(lessonId);
        const completed = !!state?.completed_at;
        const item: PathLesson = {
          ...plan,
          lessonId,
          started: !!state,
          completed,
          progress: completed
            ? 100
            : Math.round(((state?.video_progress ?? 0) + (state?.progress ?? 0)) / 2),
          locked: !review && !previousDone,
        };
        previousDone = completed;
        return item;
      });
      return {
        unit: unit.unit,
        title: unit.title,
        lessons: list,
        completed: list.filter((l) => l.completed).length,
      };
    });

    const all = units.flatMap((u) => u.lessons);
    const completed = all.filter((l) => l.completed).length;
    const coreLessons = all.filter((lesson) => lesson.unit <= CORE_UNITS_PER_LEVEL);
    const testRow = byKey.get(finalTestKey(level));
    const testId = (testRow?.id as string | undefined) ?? null;
    const testState = stateOf(testId);

    // One integrated Final Test per core unit, unlocked once its lessons are done.
    const unitTests: UnitTestState[] = units
      .filter((unit) => unit.unit <= CORE_UNITS_PER_LEVEL)
      .map((unit) => {
        const row = byKey.get(unitTestKey(level, unit.unit));
        const id = (row?.id as string | undefined) ?? null;
        const state = stateOf(id);
        return {
          unit: unit.unit,
          lessonId: id,
          unlocked: unit.lessons.length > 0 && unit.lessons.every((lesson) => lesson.completed),
          passed: !!state?.completed_at,
        };
      });

    return {
      level,
      review,
      units,
      lessons: all,
      completed,
      total: all.length,
      next: all.find((l) => !l.completed) ?? null,
      unitTests,
      finalTest: {
        lessonId: testId,
        // 70% of the core lessons (21 of 30) open the Final Test.
        unlocked:
          coreLessons.filter((lesson) => lesson.completed).length >=
          finalTestLessonsRequired(coreLessons.length),
        passed: !!testState?.completed_at,
      },
    };
  }, [lessons, mine, level, review]);
}

/** Opens a path lesson, asking the AI to write it the first time. */
// One opening per lesson at a time in this browser: a second tap shares it.
const openingLessons = new Map<string, Promise<{ lessonId: string }>>();
/** While the lesson is still being written, wait for it instead of failing (≈ 75 s max). */
const BUSY_WAIT_MS = 7_500;
const BUSY_WAIT_ATTEMPTS = 10;

export function useOpenPathLesson() {
  const open = useServerFn(openCurriculumLesson);
  const queryClient = useQueryClient();

  const openOnce = (key: string) => {
    const running = openingLessons.get(key);
    if (running) return running;
    const run = (async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          return (await open({ data: { key } })) as { lessonId: string };
        } catch (err) {
          const busy = err instanceof Error && /already running/i.test(err.message);
          if (!busy || attempt >= BUSY_WAIT_ATTEMPTS) throw err;
          await new Promise((r) => setTimeout(r, BUSY_WAIT_MS));
        }
      }
    })().finally(() => openingLessons.delete(key));
    openingLessons.set(key, run);
    return run;
  };

  return useMutation({
    mutationFn: openOnce,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
    },
  });
}

/** Opens the Final Test of the level, asking the AI to write it the first time. */
export function useOpenFinalTest() {
  const open = useServerFn(openFinalTest);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (level: string) => open({ data: { level } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}

/** Opens the integrated Final Test of one unit, writing it the first time. */
export function useOpenUnitTest() {
  const open = useServerFn(openUnitTest);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { level: string; unit: number }) => open({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}
