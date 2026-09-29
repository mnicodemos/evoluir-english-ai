import { describe, expect, it } from "vitest";

import {
  countsAsLearningMinutes,
  isTimestampToday,
  todayStudyMetrics,
  type StudyDayRows,
} from "./studyDay";

const dayStart = new Date(2026, 8, 29, 0, 0, 0, 0); // local midnight, 2026-09-29
const today = "2026-09-29T10:30:00.000Z";
const yesterday = "2026-09-28T10:30:00.000Z";

const rows = (overrides: Partial<StudyDayRows> = {}): StudyDayRows => ({
  lessons: [],
  cards: [],
  words: [],
  quizzes: [],
  ...overrides,
});

describe("isTimestampToday", () => {
  it("accepts a timestamp from today and rejects null, invalid and other-day values", () => {
    expect(isTimestampToday(today, dayStart)).toBe(true);
    expect(isTimestampToday(null, dayStart)).toBe(false);
    expect(isTimestampToday(undefined, dayStart)).toBe(false);
    expect(isTimestampToday("not-a-date", dayStart)).toBe(false);
    expect(isTimestampToday(yesterday, dayStart)).toBe(false);
  });
});

describe("todayStudyMetrics", () => {
  it("an opened lesson without completion does not count", () => {
    const result = todayStudyMetrics(
      rows({ lessons: [{ completed_at: null, video_completed_at: null }] }),
      dayStart,
    );
    expect(result.lessonsCompleted).toBe(0);
    expect(result.videosWatched).toBe(0);
  });

  it("a lesson completed today counts", () => {
    const result = todayStudyMetrics(
      rows({ lessons: [{ completed_at: today, video_completed_at: null }] }),
      dayStart,
    );
    expect(result.lessonsCompleted).toBe(1);
  });

  it("a lesson completed on another day does not appear as today's", () => {
    const result = todayStudyMetrics(
      rows({ lessons: [{ completed_at: yesterday, video_completed_at: null }] }),
      dayStart,
    );
    expect(result.lessonsCompleted).toBe(0);
  });

  it("a video finished today counts; a merely opened player does not", () => {
    const result = todayStudyMetrics(
      rows({
        lessons: [
          { completed_at: null, video_completed_at: today },
          { completed_at: null, video_completed_at: null },
          { completed_at: null, video_completed_at: yesterday },
        ],
      }),
      dayStart,
    );
    expect(result.videosWatched).toBe(1);
  });

  it("opened vocabulary does not increase mastered; a word mastered today counts", () => {
    const result = todayStudyMetrics(
      rows({
        words: [
          { mastery_level: 100, last_reviewed_at: today }, // mastered today
          { mastery_level: 100, last_reviewed_at: null }, // opened only, never reviewed
          { mastery_level: 100, last_reviewed_at: yesterday }, // older mastery
          { mastery_level: 40, last_reviewed_at: today }, // reviewed today, not mastered
        ],
      }),
      dayStart,
    );
    expect(result.vocabularyMastered).toBe(1);
  });

  it("a flashcard mastered today counts only after real reviews", () => {
    const result = todayStudyMetrics(
      rows({
        cards: [
          { mastery_level: 80, times_reviewed: 3, last_reviewed_at: today },
          { mastery_level: 80, times_reviewed: 0, last_reviewed_at: today },
          { mastery_level: 80, times_reviewed: 3, last_reviewed_at: yesterday },
        ],
      }),
      dayStart,
    );
    expect(result.vocabularyMastered).toBe(1);
  });

  it("quiz average covers only quizzes graded today and aggregates several of them", () => {
    const result = todayStudyMetrics(
      rows({
        quizzes: [
          { score: 80, created_at: today },
          { score: 90, created_at: today },
          { score: 100, created_at: yesterday },
        ],
      }),
      dayStart,
    );
    expect(result.quizAverage).toBe(85);
  });

  it("zero activity returns zeros everywhere", () => {
    const result = todayStudyMetrics(rows(), dayStart);
    expect(result).toEqual({
      lessonsCompleted: 0,
      videosWatched: 0,
      vocabularyMastered: 0,
      quizAverage: 0,
    });
  });

  it("a full day of activity aggregates every metric", () => {
    const result = todayStudyMetrics(
      rows({
        lessons: [
          { completed_at: today, video_completed_at: today },
          { completed_at: today, video_completed_at: null },
        ],
        cards: [{ mastery_level: 90, times_reviewed: 2, last_reviewed_at: today }],
        words: [{ mastery_level: 100, last_reviewed_at: today }],
        quizzes: [{ score: 70, created_at: today }],
      }),
      dayStart,
    );
    expect(result).toEqual({
      lessonsCompleted: 2,
      videosWatched: 1,
      vocabularyMastered: 2,
      quizAverage: 70,
    });
  });
});

describe("minutes eligibility (existing principle)", () => {
  it("counts only activities with a real learning result, never open-session telemetry", () => {
    for (const type of ["lesson", "final_test", "conversation", "listening", "writing", "vocabulary"]) {
      expect(countsAsLearningMinutes(type)).toBe(true);
    }
    for (const type of [
      "lesson_practice",
      "final_test_practice",
      "conversation_practice",
      "writing_practice",
      "listening_practice",
      "vocabulary_reading",
    ]) {
      expect(countsAsLearningMinutes(type)).toBe(false);
    }
  });
});
