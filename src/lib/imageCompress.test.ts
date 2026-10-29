import { describe, expect, it } from "vitest";

import { ADMIN_IMAGE_MAX_WIDTH, dataUrlBytes, fitWidth } from "./imageCompress";

describe("fitWidth", () => {
  it("shrinks a wide photo to the slot's width and keeps its shape", () => {
    expect(fitWidth(4000, 3000, ADMIN_IMAGE_MAX_WIDTH.desktop)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("never enlarges a small image", () => {
    expect(fitWidth(300, 300, ADMIN_IMAGE_MAX_WIDTH["evo-avatar"])).toEqual({
      width: 300,
      height: 300,
    });
  });
});

describe("dataUrlBytes", () => {
  it("counts the bytes behind the base64 text", () => {
    expect(dataUrlBytes("data:image/png;base64,QUJD")).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,QUI=")).toBe(2);
    expect(dataUrlBytes("data:image/png;base64,QQ==")).toBe(1);
  });
});
