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
import { isBusinessKey } from "@/lib/businessCourse";
import { openBusinessLesson } from "@/lib/businessCourse.functions";
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
    // Units whose lessons are all completed, for the review unit's own rule.
    const unitsDone = new Set<number>();
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
          // A review lesson opens once the units it reviews are done (owner
          // request, 2026-10-26: Review I after Units 1-2, Review II after
          // Units 3-5, the Test after 1-5), not after the lesson before it.
          locked:
            !review &&
            (plan.reviewUnits.length > 0
              ? !reviewUnitsDone(plan.reviewUnits, unitsDone)
              : !previousDone),
        };
        previousDone = completed;
        return item;
      });
      if (list.length > 0 && list.every((lesson) => lesson.completed)) unitsDone.add(unit.unit);
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
      // The level's progress counts only the 30 core lessons, the same base as
      // the Final Test rule (21 of 30); the optional review unit stays apart
      // (user report: "5/33" beside "21 of the 30 lessons" read as a mistake).
      coreCompleted: coreLessons.filter((lesson) => lesson.completed).length,
      coreTotal: coreLessons.length,
      next: nextPathLesson(all),
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
  const openPath = useServerFn(openCurriculumLesson);
  const openBusiness = useServerFn(openBusinessLesson);
  // Business English lessons open (and are repaired) through their own track.
  const open = (input: { data: { key: string } }) =>
    isBusinessKey(input.data.key) ? openBusiness(input) : openPath(input);
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

/** True when every unit a review lesson covers has all its lessons completed. */
/**
 * The lesson the path suggests next: an open review lesson comes first, so
 * Review I follows Unit 2 and Review II follows Unit 5 (owner decision,
 * 2026-10-26: the review matters in the sequence); otherwise the first lesson
 * not done yet, in order.
 */
export function nextPathLesson<
  T extends { completed: boolean; locked: boolean; reviewUnits: number[] },
>(lessons: T[]): T | null {
  // Review I is the one intentional interruption after Units 1–2.
  const reviewOne = lessons.find(
    (lesson) =>
      lesson.reviewUnits.length === 2 &&
      lesson.reviewUnits[0] === 1 &&
      lesson.reviewUnits[1] === 2 &&
      !lesson.locked &&
      !lesson.completed,
  );
  if (reviewOne) return reviewOne;

  // Once Review I is complete, resume the core curriculum before considering
  // later reviews. Review II and the review test belong after Units 3–5.
  const nextCoreLesson = lessons.find(
    (lesson) => lesson.reviewUnits.length === 0 && !lesson.completed && !lesson.locked,
  );
  if (nextCoreLesson) return nextCoreLesson;

  const nextUnlockedReview = lessons.find(
    (lesson) => lesson.reviewUnits.length > 0 && !lesson.locked && !lesson.completed,
  );
  if (nextUnlockedReview) return nextUnlockedReview;

  return lessons.find((lesson) => !lesson.completed) ?? null;
}

export function reviewUnitsDone(reviewUnits: number[], unitsDone: Set<number>) {
  return reviewUnits.every((unit) => unitsDone.has(unit));
}
