
describe("item-level calibration (phase 20)", () => {
  it("never reads a score above the level of the practised item", () => {
    expect(calibrateCefrToItemLevel("C2", "A1")).toBe("A1");
    expect(calibrateCefrToItemLevel("C1", "B1")).toBe("B1");
  });

  it("keeps the score band when it is at or below the item level", () => {
    expect(calibrateCefrToItemLevel("A2", "B2")).toBe("A2");
    expect(calibrateCefrToItemLevel("B2", "B2")).toBe("B2");
  });

  it("leaves legacy evidence without an item level untouched", () => {
    expect(calibrateCefrToItemLevel("C2", null)).toBe("C2");
  });

  it("normalises stored and legacy level labels", () => {
    expect(itemLevelFromStoredLevel("b1")).toBe("B1");
    expect(itemLevelFromStoredLevel("intermediate")).toBe(itemLevelFromStoredLevel("b1"));
    expect(measuredCefr("nonsense")).toBeNull();
  });
});
