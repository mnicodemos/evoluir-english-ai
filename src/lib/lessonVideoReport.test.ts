import { describe, expect, it } from "vitest";

import { getCurriculum } from "./curriculum";
import { canonicalYoutubeUrl, lessonVideoListText, lessonVideoReport } from "./lessonVideoReport";

describe("lesson video report", () => {
  it("lists every lesson with the approved video and the videos students got", () => {
    const curriculum = getCurriculum("a1");
    const key = curriculum[0]!.key;
    const report = lessonVideoReport(
      curriculum,
      [
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
          video_seconds: 240,
        },
      ],
      [
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=BBBBBBBBBBB",
          video_duration_seconds: 300,
        },
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=BBBBBBBBBBB",
          video_duration_seconds: 300,
        },
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=CCCCCCCCCCC",
          video_duration_seconds: 0,
        },
        {
          curriculum_key: "other",
          video_url: "https://www.youtube.com/watch?v=DDDDDDDDDDD",
          video_duration_seconds: 1,
        },
      ],
    );
    expect(report).toHaveLength(curriculum.length);
    expect(report[0]!.approved?.id).toBe("AAAAAAAAAAA");
    expect(report[0]!.used.map((video) => [video.id, video.lessons])).toEqual([
      ["BBBBBBBBBBB", 2],
      ["CCCCCCCCCCC", 1],
    ]);
    expect(report[0]!.used[1]!.seconds).toBeNull();
    expect(report[1]!.approved).toBeNull();
  });

  it("stores one form of a YouTube link", () => {
    expect(canonicalYoutubeUrl("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(canonicalYoutubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(canonicalYoutubeUrl("https://vimeo.com/123")).toBeNull();
  });
});

describe("lesson video list text", () => {
  const item = {
    key: "a1-u1-l1",
    unit: 1,
    unitTitle: "Hello",
    position: 1,
    title: "Greetings",
    objective: "Say hello",
    skill: "talking",
    approved: {
      url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
      id: "AAAAAAAAAAA",
      seconds: 270,
      auto: false,
    },
    used: [
      {
        url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
        id: "AAAAAAAAAAA",
        seconds: 270,
        lessons: 3,
      },
      {
        url: "https://www.youtube.com/watch?v=BBBBBBBBBBB",
        id: "BBBBBBBBBBB",
        seconds: null,
        lessons: 1,
      },
    ],
  };

  it("lists each lesson with its approved and used videos once", () => {
    const text = lessonVideoListText("a1", [item], (id) =>
      id === "AAAAAAAAAAA"
        ? { title: "Basic greetings", author_name: "BBC Learning English" }
        : null,
    );
    expect(text).toContain("nível A1");
    expect(text).toContain("U1 L1 · Greetings (talking) [a1-u1-l1]");
    expect(text).toContain("Basic greetings · BBC Learning English · 4:30 · aprovado");
    expect(text).toContain("título indisponível · canal ? · duração ? · 1 aluno");
    expect(text.match(/AAAAAAAAAAA/g)).toHaveLength(1);
  });

  it("says when a lesson has no video yet", () => {
    const text = lessonVideoListText("b2", [{ ...item, approved: null, used: [] }], () => null);
    expect(text).toContain("(nenhum vídeo ainda)");
  });
});

describe("videos chosen by the app", () => {
  it("tells the app's choice from the owner's approval", () => {
    const [plan] = getCurriculum("a1");
    const report = lessonVideoReport(
      [plan!],
      [
        {
          curriculum_key: plan!.key,
          video_url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
          video_seconds: 200,
          approved_by: null,
        },
      ],
      [],
    );
    expect(report[0]!.approved?.auto).toBe(true);
    expect(lessonVideoListText("a1", report, () => null)).toContain("escolhido pelo app");
  });
});
