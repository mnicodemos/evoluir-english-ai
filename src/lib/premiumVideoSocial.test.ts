import { describe, expect, it } from "vitest";

import { checkComment, commentAuthorName } from "./premiumVideoSocial";

describe("video comments", () => {
  it("names a student by first name and initial", () => {
    expect(commentAuthorName("Marcelo Nicodemos")).toBe("Marcelo N.");
    expect(commentAuthorName("  ana  maria  silva ")).toBe("ana S.");
    expect(commentAuthorName("Leo")).toBe("Leo");
    expect(commentAuthorName(null)).toBe("Student");
  });

  it("keeps a plain comment and folds its spaces", () => {
    expect(checkComment("  Great   tip!\n Thanks ")).toEqual({
      ok: true,
      body: "Great tip! Thanks",
    });
  });

  it("refuses empty, long, links and contact details", () => {
    expect(checkComment("   ").ok).toBe(false);
    expect(checkComment("a".repeat(501)).ok).toBe(false);
    expect(checkComment("see https://x.com").ok).toBe(false);
    expect(checkComment("go to mysite.com.br").ok).toBe(false);
    expect(checkComment("call me 11 99999-8888").ok).toBe(false);
    expect(checkComment("follow @someone_here").ok).toBe(false);
    expect(checkComment("mail me at a@b.com").ok).toBe(false);
  });

  it("allows short numbers like times and scores", () => {
    expect(checkComment("I watched it 3 times, 10/10").ok).toBe(true);
  });
});
