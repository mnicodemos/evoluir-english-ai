import { jsPDF } from "jspdf";

import { supabase } from "@/integrations/supabase/client";
import { findLevel } from "@/lib/level";
import { type GrammarPoint, getLevelReference } from "@/lib/levelReference";
import { savePdf } from "@/lib/pdfDownload";
import { ACCENT, INK, MUTED, loadLogo, shorten } from "@/lib/pdfTheme";
import { createWorkbook } from "@/lib/pdfWorkbook";

export type DailyReportInput = {
  name: string;
  level: string;
  lessonIds: string[];
};

const BRAND = "Evoluir+ English AI";
const MUTED_RGB: [number, number, number] = [MUTED.r, MUTED.g, MUTED.b];

/** Collects the study content of the current CEFR level only. */
async function collectDayData(userId: string, lessonIds: string[], levelValue: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.toISOString();

  const { data: levelLessons } = await supabase
    .from("lessons")
    .select("id, title, category, level, objective, summary, transcript, transcript_pt, curriculum_key")
    .in("id", lessonIds.length ? lessonIds : ["00000000-0000-0000-0000-000000000000"])
    .like("curriculum_key", `${levelValue}-%`);

  const lessonRows = levelLessons ?? [];
  const ids = lessonRows.map((l) => l.id);

  const [cards, quizzes, activities] = await Promise.all([
    ids.length
      ? supabase.from("flashcards").select("word, translation, example, lesson_id").in("lesson_id", ids)
      : Promise.resolve({
          data: [] as { word: string; translation: string; example: string | null; lesson_id: string | null }[],
        }),
    ids.length
      ? supabase.from("quiz_results").select("score").eq("user_id", userId).in("lesson_id", ids).gte("created_at", since)
      : Promise.resolve({ data: [] as { score: number }[] }),
    supabase
      .from("activities")
      .select("duration_minutes")
      .eq("user_id", userId)
      .eq("level", levelValue)
      .gte("created_at", since),
  ]);

  const quizRows = quizzes.data ?? [];

  return {
    lessons: lessonRows,
    cards: cards.data ?? [],
    quizAverage: quizRows.length
      ? Math.round(quizRows.reduce((s, q) => s + (q.score ?? 0), 0) / quizRows.length)
      : 0,
    minutes: (activities.data ?? []).reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0),
  };
}

/** Builds and downloads the personal progress workbook of the current level. */
export async function downloadDailyReport(userId: string, input: DailyReportInput) {
  const level = findLevel(input.level);
  const [data, logo] = await Promise.all([collectDayData(userId, input.lessonIds, level.value), loadLogo()]);
  const reference = getLevelReference(level.value);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const wb = createWorkbook(doc, logo, { brand: BRAND, levelLabel: level.label, docTitle: "Progress workbook" });

  wb.cover({
    title: "Your progress",
    subtitle: "What you studied, your vocabulary and the reference of your level",
    footnote: `Generated on ${new Date().toLocaleDateString()}`,
  });

  // Part 1 — progress
  wb.divider("Progress", new Date().toLocaleDateString());

  const chips: [string, string][] = [
    ["Lessons", `${data.lessons.length}`],
    ["Minutes", `${data.minutes}`],
    ["Quiz average", `${data.quizAverage}%`],
  ];
  const chipW = (wb.contentW - 16) / 3;
  chips.forEach(([label, value], i) => {
    const x = wb.margin + i * (chipW + 8);
    doc.setFillColor(244, 246, 248);
    doc.roundedRect(x, wb.y, chipW, 48, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(value, x + 12, wb.y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label.toUpperCase(), x + 12, wb.y + 38);
  });
  wb.y += 70;

  wb.heading("What you studied");
  if (data.lessons.length === 0) {
    wb.para("No lesson was completed at this level yet.", { size: 10, color: MUTED_RGB });
  }
  data.lessons.forEach((lesson, index) => {
    wb.lesson(index + 1, shorten(lesson.title, 62));
    wb.label(`${String(lesson.category)} · ${String(lesson.level)}`);
    if (lesson.objective) wb.para(shorten(lesson.objective, 220), { size: 10 });
    if (lesson.summary) wb.para(shorten(lesson.summary, 600), { size: 9.5, color: MUTED_RGB });
  });

  // Part 2 — vocabulary
  wb.divider("Vocabulary", "Words and expressions you have studied");
  const selectedCards = data.cards.slice(0, 40);
  if (selectedCards.length === 0) {
    wb.para("No vocabulary was recorded at this level yet.", { size: 10, color: MUTED_RGB });
  }
  selectedCards.forEach((card, index) => {
    wb.entry(index + 1, card.word, card.translation);
    if (card.example) wb.example(card.example);
  });

  // Part 3 — practice
  wb.divider("Practice", "A 5-minute active recall routine");
  const practice: Array<[string, string]> = [
    ["1 minute", "Say the key words aloud twice. Focus on clarity, not speed."],
    ["2 minutes", "Choose three words and create one personal sentence with each."],
    ["1 minute", "Explain the main idea of your last lesson without reading your notes."],
    ["1 minute", "Open Smart Review and test what you can remember."],
  ];
  for (const [time, task] of practice) {
    wb.space(70);
    doc.setFillColor(244, 246, 248);
    doc.roundedRect(wb.margin, wb.y, wb.contentW, 50, 7, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text(time, wb.margin + 14, wb.y + 20);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(doc.splitTextToSize(task, wb.contentW - 110), wb.margin + 96, wb.y + 18);
    wb.y += 60;
  }

  wb.heading("My three sentences");
  doc.setDrawColor(210, 214, 222);
  for (let i = 1; i <= 3; i += 1) {
    wb.space(46);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`${i}.`, wb.margin, wb.y + 12);
    doc.line(wb.margin + 20, wb.y + 14, pageW - wb.margin, wb.y + 14);
    wb.y += 42;
  }

  // Part 4 — grammar of the level
  wb.divider("Grammar", level.label);
  wb.para(reference.overview, { size: 10.5 });
  reference.grammar.forEach((point: GrammarPoint, index: number) => {
    wb.heading(`${index + 1}. ${point.title}`);
    wb.para(point.explanation, { size: 10 });
    wb.note("Structure", point.structure);
    for (const example of point.examples) wb.bullet(example, { size: 9.5 });
  });

  // Part 5 — reading and writing
  wb.divider("Reading and writing", level.label);
  for (const reading of reference.readings) {
    wb.heading(shorten(reading.title, 70));
    wb.para(reading.text, { size: 10 });
    wb.label("Português");
    wb.para(reading.pt, { size: 9.5, color: MUTED_RGB });
  }
  wb.heading(reference.writingModel.title);
  for (const block of reference.writingModel.text.split("\n")) {
    if (!block.trim()) {
      wb.y += 4;
      continue;
    }
    wb.para(block, { size: 9.5, gap: 3 });
  }
  wb.label("How to write it");
  for (const note of reference.writingModel.notes) wb.bullet(note, { size: 9.5 });

  // Part 6 — lexical reference
  wb.divider("Reference", "Phrasal verbs · Linking words · Irregular verbs");
  wb.heading(`Phrasal verbs · ${level.label}`);
  reference.phrasalVerbs.forEach((item, index) => {
    wb.entry(index + 1, item.term, item.pt);
    wb.example(item.example);
  });

  wb.heading(`Linking words · ${level.label}`);
  reference.linkingWords.forEach((item, index) => {
    wb.entry(index + 1, item.term, item.pt);
    wb.example(item.example);
  });

  wb.heading(`Irregular verbs · ${level.label}`);
  wb.row(["Base", "Past", "Participle", "PT"], { header: true });
  for (const verb of reference.irregularVerbs) {
    wb.space(30);
    wb.row([verb.base, verb.past, verb.participle, shorten(verb.pt, 24)]);
    wb.para(shorten(verb.example, 95), { size: 9, color: MUTED_RGB, gap: 3 });
  }

  wb.heading("Useful phrases for speaking");
  reference.speakingPhrases.forEach((item, index) => {
    wb.entry(index + 1, item.term, item.pt);
    wb.example(item.example);
  });

  // Part 7 — scripts of the lessons studied
  wb.divider("Scripts", "Read and listen again");
  for (const lesson of data.lessons) {
    wb.heading(shorten(lesson.title, 70));
    const paragraphs = String(lesson.transcript ?? "")
      .split(/\n+/)
      .filter(Boolean);
    if (paragraphs.length === 0) {
      wb.para("No script is available for this lesson.", { size: 9.5, color: MUTED_RGB });
    }
    for (const block of paragraphs) wb.para(block, { size: 10 });
  }

  wb.finish();

  return savePdf(doc, `evoluir-progress-${level.value}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
