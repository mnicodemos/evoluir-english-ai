import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completedAdventureIds,
  ENGLISH_ADVENTURES_TOTAL,
  englishAdventureProgress,
  addStudySeconds,
  markActivityComplete,
  readCompletedActivities,
  readStudySeconds,
} from "./englishAdventuresProgress";

function installLocalStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal("window", { localStorage });
  return values;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("English Adventures progress", () => {
  it("uses 40 activities as the total", () => {
    expect(ENGLISH_ADVENTURES_TOTAL).toBe(40);
    expect(englishAdventureProgress(["a1-1", "a1-2", "a2-1", "a2-2"])).toEqual({
      completed: 4,
      total: 40,
      percent: 10,
      minutes: 0,
    });
  });

  it("keeps study time in seconds and only displays completed minutes", () => {
    installLocalStorage();
    expect(addStudySeconds("student-1", 59)).toBe(59);
    expect(readStudySeconds("student-1")).toBe(59);
    expect(englishAdventureProgress([], readStudySeconds("student-1")).minutes).toBe(0);

    expect(addStudySeconds("student-1", 1)).toBe(60);
    expect(englishAdventureProgress([], readStudySeconds("student-1")).minutes).toBe(1);
  });

  it("counts a completed adventure only once", () => {
    const ids = completedAdventureIds(["a1-1"], "a1-1");
    expect(ids).toEqual(["a1-1"]);
    expect(englishAdventureProgress(ids).percent).toBe(3);
  });

  it("stores each completed activity once and updates the 40-step total", () => {
    installLocalStorage();
    const first = markActivityComplete("student-1", "a1-welcome-mix-up:0");
    const second = markActivityComplete("student-1", "a1-welcome-mix-up:0");
    markActivityComplete("student-1", "a1-welcome-mix-up:1");

    expect(first).toEqual(["a1-welcome-mix-up:0"]);
    expect(second).toEqual(["a1-welcome-mix-up:0"]);
    expect(readCompletedActivities("student-1")).toHaveLength(2);
    expect(englishAdventureProgress(readCompletedActivities("student-1")).percent).toBe(5);
  });

  it("expands legacy completed adventures without double counting explicit activities", () => {
    const values = installLocalStorage();
    values.set("evoluir-english-adventures:student-1", JSON.stringify(["a1-welcome-mix-up"]));
    values.set(
      "evoluir-english-adventures:student-1:activities",
      JSON.stringify(["a1-welcome-mix-up:0", "a2-community-festival:0"]),
    );

    const ids = readCompletedActivities("student-1");
    expect(ids).toHaveLength(11);
    expect(englishAdventureProgress(ids).percent).toBe(28);
  });
});
