import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PronunciationHint } from "./PronunciationHint";

describe("PronunciationHint", () => {
  it("highlights the missed letters and names the part", () => {
    const html = renderToStaticMarkup(
      <PronunciationHint target="thought" spoken="I said tought" pt />,
    );
    expect(html).toContain("Atenção ao som de: ");
    expect(html).toContain("“h”");
    expect(html.match(/text-destructive/g)).toHaveLength(1);
  });
});
