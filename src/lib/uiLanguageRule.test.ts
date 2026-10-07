import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { uiPt } from "./uiDictionary";

/**
 * Language rule: the student's interface follows the chosen language. Screen
 * text is written in English and translated through uiPt; English stays only
 * in learning content (lessons, vocabulary, AI replies), which never comes
 * from literals in these files. Admin screens (owner only) and the public
 * Portuguese pages are outside the rule.
 */
const SKIP_DIRS = ["src/components/ui", "src/components/ai-elements"];
const SKIP_FILES = [
  /Admin[A-Za-z]*\.tsx$/,
  /routes\/_authenticated\/admin\.tsx$/,
  /routes\/index\.tsx$/,
  /routes\/auth\.tsx$/,
  /routes\/reset-password\.tsx$/,
  /routes\/(terms|privacy|legal|contact)[^/]*\.tsx$/,
  /components\/Legal[A-Za-z]*\.tsx$/,
  /components\/home\//,
  /\.test\.tsx$/,
];
/** Brand names, units and symbols read the same in both languages. */
const SAME_IN_BOTH = new Set([
  "EVO",
  "EVO ·",
  "Evoluir",
  "English AI",
  "Evoluir+",
  "XP",
  "min",
  "US /",
  "UK /",
  "Marcelo",
  "evoluirmaisoficial@hotmail.com",
]);
const ATTRS = new Set(["title", "aria-label", "placeholder"]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.includes(path) ? [] : tsxFiles(path);
    return path.endsWith(".tsx") && !SKIP_FILES.some((rule) => rule.test(path)) ? [path] : [];
  });
}

function decode(text: string) {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function untranslated(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const check = (raw: string) => {
    const text = decode(raw);
    // Portuguese written straight into a screen would also show in English mode.
    if (/[ãõçáéíóúâêôà]/i.test(text)) found.push(`${text} (write it in English + uiPt)`);
    else if (/[A-Za-z]{2}/.test(text) && !SAME_IN_BOTH.has(text) && !uiPt[text]) found.push(text);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) check(node.text);
    if (
      ts.isJsxAttribute(node) &&
      ATTRS.has(node.name.getText()) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      check(node.initializer.text);
    }
    if (
      ts.isCallExpression(node) &&
      ["t", "translate"].includes(node.expression.getText()) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      check(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("interface language rule", () => {
  it("every student-screen text has a Portuguese translation", () => {
    const missing = tsxFiles("src").flatMap((file) =>
      untranslated(file).map((text) => `${file}: ${text}`),
    );
    expect(missing).toEqual([]);
  });
});
