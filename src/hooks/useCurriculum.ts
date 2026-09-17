import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { useLessons, useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { CORE_UNITS_PER_LEVEL, finalTestKey, getUnits, type CurriculumLesson } from "@/lib/curriculum";
import { openCurriculumLesson, openFinalTest } from "@/lib/curriculum.functions";
import { getLevelState } from "@/lib/level";

export type PathLesson = CurriculumLesson & {
  lessonId: string | null;
  started: boolean;
  completed: boolean;
  progress: number;
  locked: boolean;
};

export type PathUnit = { unit: number; title: string; lessons: PathLesson[]; completed: number };

/** The student's 30 core lessons and optional review unit, with lock state. */
export function useLearningPath() {
  const { data: profile } = useProfile();
  const { data: lessons } = useLessons();
  const { data: mine } = useUserLessons();

  const level = getLevelState(profile?.level).current.value;

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
          progress: completed ? 100 : Math.round(((state?.video_progress ?? 0) + (state?.progress ?? 0)) / 2),
          locked: !previousDone,
        };
        previousDone = completed;
        return item;
      });
      return { unit: unit.unit, title: unit.title, lessons: list, completed: list.filter((l) => l.completed).length };
    });

    const all = units.flatMap((u) => u.lessons);
    const completed = all.filter((l) => l.completed).length;
    const coreLessons = all.filter((lesson) => lesson.unit <= CORE_UNITS_PER_LEVEL);
    const testRow = byKey.get(finalTestKey(level));
    const testId = (testRow?.id as string | undefined) ?? null;
    const testState = stateOf(testId);

    return {
      level,
      units,
      lessons: all,
      completed,
      total: all.length,
      next: all.find((l) => !l.completed) ?? null,
      finalTest: {
        lessonId: testId,
        unlocked: coreLessons.every((lesson) => lesson.completed),
        passed: !!testState?.completed_at,
      },
    };
  }, [lessons, mine, level]);
}

/** Opens a path lesson, asking the AI to write it the first time. */
export function useOpenPathLesson() {
  const open = useServerFn(openCurriculumLesson);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string) => open({ data: { key } }),
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
