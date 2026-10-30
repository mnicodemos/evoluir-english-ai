import { describe, expect, it } from "vitest";

import { canonicalVimeoUrl } from "./lessonVideoReport";

describe("canonicalVimeoUrl", () => {
  it("canonicalizes supported Vimeo links for administrator entry", () => {
    expect(canonicalVimeoUrl("https://vimeo.com/1239966935")).toBe("https://vimeo.com/1239966935");
    expect(canonicalVimeoUrl("https://player.vimeo.com/video/1239966935?h=abc")).toBe(
      "https://vimeo.com/1239966935?h=abc",
    );
    expect(canonicalVimeoUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(canonicalVimeoUrl("javascript:alert(1)")).toBeNull();
  });
});
