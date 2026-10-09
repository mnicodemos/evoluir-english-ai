import { describe, expect, it } from "vitest";

import {
  businessLevelAllowed,
  findBusinessLesson,
  findBusinessRolePlay,
  getBusinessCourse,
  isBusinessKey,
} from "./businessCourse";
import { findCurriculumLesson } from "./curriculum";

describe("Business English track", () => {
  it("opens from B1", () => {
    expect(businessLevelAllowed("a2")).toBe(false);
    expect(businessLevelAllowed("b1")).toBe(true);
    expect(businessLevelAllowed("c2")).toBe(true);
  });

  it("has 36 lessons written at the student's level, outside the CEFR path", () => {
    const course = getBusinessCourse("b2");
    expect(course).toHaveLength(36);
    expect(new Set(course.map((lesson) => lesson.key)).size).toBe(36);
    expect(course.every((lesson) => lesson.level === "b2" && lesson.category === "business")).toBe(
      true,
    );
    expect(course.every((lesson) => isBusinessKey(lesson.key))).toBe(true);
    // Path functions never treat a Business key as a level lesson.
    expect(findCurriculumLesson(course[0]!.key)).toBeNull();
  });

  it("finds a lesson by key at the student's level, and its role-plays", () => {
    expect(findBusinessLesson("biz-u2-l4", "c1")?.title).toBe("Writing a Clear Work E-mail");
    expect(findBusinessLesson("b1-u1-l1", "b1")).toBeNull();
    expect(findBusinessRolePlay("biz-negotiation")?.scenario).toBe("professional");
    expect(findBusinessRolePlay("hotel")).toBeNull();
  });
});
