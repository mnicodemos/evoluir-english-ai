import { describe, expect, it } from "vitest";

import {
  CORE_LESSONS_PER_LEVEL,
  finalTestKey,
  finalTestLessonsRequired,
  findCurriculumLesson,
  getCoreCurriculum,
  getCurriculum,
  isFinalTestKey,
  isUnitTestKey,
  normalizeLevel,
  unitTestKey,
} from "./curriculum";

describe("curriculum rules", () => {
  it("opens the Final Test at 70% of the 30 core lessons (21)", () => {
    expect(CORE_LESSONS_PER_LEVEL).toBe(30);
    expect(finalTestLessonsRequired()).toBe(21);
    expect(finalTestLessonsRequired(getCoreCurriculum("a1").length)).toBe(21);
  });

  it("keeps 30 core lessons and 3 review activities per level", () => {
    for (const level of ["a1", "a2", "b1", "b2", "c1", "c2"]) {
      expect(getCoreCurriculum(level)).toHaveLength(30);
      expect(getCurriculum(level)).toHaveLength(33);
      expect(getCoreCurriculum(level).every((lesson) => lesson.unit <= 5)).toBe(true);
    }
  });

  it("gives every lesson a unique key that finds it again", () => {
    const lessons = getCurriculum("b1");
    expect(new Set(lessons.map((lesson) => lesson.key)).size).toBe(lessons.length);
    for (const lesson of lessons)
      expect(findCurriculumLesson(lesson.key)?.title).toBe(lesson.title);
  });

  it("tells Final Test and unit test keys apart from lessons", () => {
    expect(finalTestKey("A2")).toBe("a2-final");
    expect(isFinalTestKey("a2-final")).toBe(true);
    expect(unitTestKey("a2", 3)).toBe("a2-u3-test");
    expect(isUnitTestKey("a2-u3-test")).toBe(true);
    const lessonKey = getCurriculum("a2")[0]!.key;
    expect(isFinalTestKey(lessonKey)).toBe(false);
    expect(isUnitTestKey(lessonKey)).toBe(false);
  });

  it("falls back to B1 for an unknown level", () => {
    expect(normalizeLevel("unknown")).toBe("b1");
    expect(normalizeLevel(null)).toBe("b1");
  });
});
