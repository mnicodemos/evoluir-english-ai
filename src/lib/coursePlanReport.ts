import { jsPDF } from "jspdf";

import { supabase } from "@/integrations/supabase/client";
import { getUnits } from "@/lib/curriculum";
import { findLevel } from "@/lib/level";
import { getLevelReference } from "@/lib/levelReference";
import { savePdf } from "@/lib/pdfDownload";
import { ACCENT, INK, MUTED, loadLogo, shorten } from "@/lib/pdfTheme";
import { createWorkbook } from "@/lib/pdfWorkbook";

type LessonRow = {
  id: string;
  curriculum_key: string;
  summary: string | null;
  objective: string | null;
  transcript: string | null;
  transcript_pt: string | null;
};

type FlashcardRow = {
  lesson_id: string;
  word: string;
  translation: string;
  pronunciation: string | null;
  example: string | null;
};

type QuizRow = {
  lesson_id: string;
  question: string;
  options: unknown;
  correct_answer: string;
  explanation: string | null;
  sort_order: number | null;
};

const BRAND = "Evoluir+ English AI";
const MUTED_RGB: [number, number, number] = [MUTED.r, MUTED.g, MUTED.b];

/** Builds and downloads the course workbook with the full study content of the level. */
export async function downloadCoursePlan(input: { name: string; level: string }) {
  const level = findLevel(input.level);
  const units = getUnits(input.level);
  const reference = getLevelReference(input.level);
  const keys = units.flatMap((u) => u.lessons.map((l) => l.key));

  const { data: lessonData } = await supabase
    .from("lessons")
    .select("id, curriculum_key, summary, objective, transcript, transcript_pt")
    .in("curriculum_key", keys);
  const lessonRows = (lessonData ?? []) as unknown as LessonRow[];
  const lessonByKey = new Map(lessonRows.map((row) => [String(row.curriculum_key), row]));
  const lessonIds = lessonRows.map((row) => row.id);

  const [logo, cardsRes, quizRes] = await Promise.all([
    loadLogo(),
    lessonIds.length
      ? supabase
          .from("flashcards")
          .select("lesson_id, word, translation, pronunciation, example")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length
      ? supabase
          .from("quizzes")
          .select("lesson_id, question, options, correct_answer, explanation, sort_order")
          .in("lesson_id", lessonIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const cardsByLesson = new Map<string, FlashcardRow[]>();
  for (const card of (cardsRes.data ?? []) as unknown as FlashcardRow[]) {
    const list = cardsByLesson.get(card.lesson_id) ?? [];
    list.push(card);
    cardsByLesson.set(card.lesson_id, list);
  }
  const quizByLesson = new Map<string, QuizRow[]>();
  for (const q of (quizRes.data ?? []) as unknown as QuizRow[]) {
    const list = quizByLesson.get(q.lesson_id) ?? [];
    list.push(q);
    quizByLesson.set(q.lesson_id, list);
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const wb = createWorkbook(doc, logo, { brand: BRAND, levelLabel: level.label, docTitle: "Course workbook" });

  wb.cover({
    title: "Full course content",
    subtitle: "30 lessons in 5 units, grammar, vocabulary and reference material",
    footnote: `Generated on ${new Date().toLocaleDateString()}`,
  });

  // How to use
  wb.divider("How to use this workbook", `${units.length} units · 30 lessons · Final Test`);
  wb.para(
    "This workbook contains everything you will study at this level. Each unit opens with its own page, and each lesson brings the objective, the study summary, the script in English and Portuguese, the vocabulary entries and the grammar quiz.",
    { size: 10.5 },
  );
  wb.note(
    "Before starting",
    "Think about the video lessons you have just watched. Take notes while going through this material and write down everything you learn about each topic.",
  );
  wb.label("Study routine");
  wb.bullet("Watch the lesson video with the subtitles (CC) turned on.");
  wb.bullet("Read the script aloud once, then read the Portuguese version to check your understanding.");
  wb.bullet("Study the vocabulary entries and say each example out loud.");
  wb.bullet("Answer the quiz: 70% or more completes the lesson and unlocks the next one.");
  wb.bullet("After lesson 30, take the Final Test (30 questions) to move up a level.");

  // Units and lessons
  units.forEach((unit) => {
    wb.divider(`Unit ${String(unit.unit).padStart(2, "0")}: ${unit.title}`, `${unit.lessons.length} lessons`);

    for (const lesson of unit.lessons) {
      const row = lessonByKey.get(lesson.key);
      const cards = row ? (cardsByLesson.get(row.id) ?? []) : [];
      const quiz = row ? (quizByLesson.get(row.id) ?? []) : [];
      const transcript = row?.transcript?.trim() ?? "";
      const transcriptPt = row?.transcript_pt?.trim() ?? "";
      const summary = row?.summary?.trim() ?? "";
      const hasContent = Boolean(summary || transcript || cards.length || quiz.length);

      wb.lesson(lesson.position, lesson.title);
      wb.label(`${String(lesson.skill)} focus`);
      wb.para(lesson.objective, { size: 10 });

      if (!hasContent) {
        wb.note(
          "Not opened yet",
          "The AI coach writes the full script, vocabulary and quiz the first time you open this lesson. The grammar, texts and word lists of this level are in the reference part at the end of this workbook.",
        );
        continue;
      }

      if (summary) {
        wb.label("Summary");
        wb.para(summary);
      }

      if (transcript) {
        wb.label("Study script");
        wb.para(transcript);
      }
      if (transcriptPt) {
        wb.label("Português");
        wb.para(transcriptPt, { size: 9.5, color: MUTED_RGB });
      }

      if (cards.length) {
        wb.label("Vocabulary");
        cards.forEach((card, index) => {
          wb.entry(index + 1, card.word, `${card.translation}${card.pronunciation ? ` (${card.pronunciation})` : ""}`);
          if (card.example) wb.example(card.example);
        });
      }

      if (quiz.length) {
        wb.label("Grammar quiz");
        quiz.forEach((q, index) => {
          wb.para(`${index + 1}. ${q.question}`, { size: 10, bold: true, color: [INK.r, INK.g, INK.b], gap: 2 });
          const options = Array.isArray(q.options) ? (q.options as string[]) : [];
          for (const opt of options) {
            const isCorrect = opt === q.correct_answer;
            wb.para(`• ${opt}${isCorrect ? "  (correct answer)" : ""}`, {
              size: 9.5,
              gap: 1,
              indent: 18,
              color: isCorrect ? ([22, 122, 71] as [number, number, number]) : ([58, 63, 74] as [number, number, number]),
              bold: isCorrect,
            });
          }
          if (q.explanation) wb.para(`Why: ${q.explanation}`, { size: 9, indent: 18, color: MUTED_RGB });
        });
      }

      wb.y += 8;
    }
  });

  // Grammar reference
  wb.divider("Grammar", level.label);
  wb.para(reference.overview, { size: 10.5 });
  reference.grammar.forEach((point, index) => {
    wb.heading(`${index + 1}. ${point.title}`);
    wb.para(point.explanation, { size: 10 });
    wb.note("Structure", point.structure);
    for (const example of point.examples) wb.bullet(example, { size: 9.5 });
  });

  // Reading and writing
  wb.divider("Reading and writing", level.label);
  for (const reading of reference.readings) {
    wb.heading(reading.title);
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

  // Lexical reference
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

  // Final test
  wb.divider("Final Test", "30 questions · 70% to move up a level");
  wb.para(
    "The Final Test is released after lesson 30. It has 30 pure grammar questions about everything you studied in the five units of this level.",
    { size: 10.5 },
  );
  wb.label("How to prepare");
  wb.bullet("Review the grammar part of this workbook and rewrite each structure in your own words.");
  wb.bullet("Redo the quizzes of the lessons where you scored below 90%.");
  wb.bullet("Read the texts aloud and rewrite the writing model with your own information.");
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);

  wb.finish();

  return savePdf(doc, `evoluir-course-${String(input.level).toLowerCase()}.pdf`);
}
