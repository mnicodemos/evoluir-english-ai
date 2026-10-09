import { jsPDF } from "jspdf";

import { supabase } from "@/integrations/supabase/client";
import { getBusinessUnits } from "@/lib/businessCourse";
import { formatDate } from "@/lib/formatDate";
import { findLevel } from "@/lib/level";
import { savePdf } from "@/lib/pdfDownload";
import { INK, MUTED, loadLogo } from "@/lib/pdfTheme";
import { createWorkbook } from "@/lib/pdfWorkbook";
import { QUIZ_PUBLIC_FIELDS } from "@/lib/quizPublicFields";

type LessonRow = {
  id: string;
  curriculum_key: string;
  summary: string | null;
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
  explanation: string | null;
};

const MUTED_RGB: [number, number, number] = [MUTED.r, MUTED.g, MUTED.b];

/**
 * Business English workbook (user request): one unit, or the whole track,
 * with the student's own lesson content (summary, script in English and
 * Portuguese, vocabulary and quiz). Lessons not opened yet show their
 * objective, since the content is written the first time a lesson opens.
 */
export async function downloadBusinessCourse(input: { level: string; unit?: number }) {
  const level = findLevel(input.level);
  const units = getBusinessUnits(input.level).filter(
    (unit) => input.unit === undefined || unit.unit === input.unit,
  );
  const keys = units.flatMap((unit) => unit.lessons.map((lesson) => lesson.key));

  const { data: lessonData } = await supabase
    .from("lessons")
    .select("id, curriculum_key, summary, transcript, transcript_pt")
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
          .select(QUIZ_PUBLIC_FIELDS)
          .in("lesson_id", lessonIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const group = <T extends { lesson_id: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(row.lesson_id, [...(map.get(row.lesson_id) ?? []), row]);
    return map;
  };
  const cardsByLesson = group((cardsRes.data ?? []) as unknown as FlashcardRow[]);
  const quizByLesson = group((quizRes.data ?? []) as unknown as QuizRow[]);

  const single = input.unit !== undefined && units.length === 1;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const wb = createWorkbook(doc, logo, {
    brand: "Evoluir+ English AI",
    levelLabel: level.label,
    docTitle: "Business English",
  });

  wb.cover({
    title: single ? `Business English · ${units[0]!.title}` : "Business English",
    subtitle: single
      ? `${units[0]!.lessons.length} lessons: listening, reading, speaking, writing, vocabulary and grammar at work`
      : `${units.length} units · ${keys.length} lessons: meetings, e-mails, presentations, interviews, negotiation and networking`,
    footnote: `Generated on ${formatDate(new Date(), "en", "long")}`,
  });

  units.forEach((unit) => {
    wb.divider(unit.title, `${unit.lessons.length} lessons`);
    for (const lesson of unit.lessons) {
      const row = lessonByKey.get(lesson.key);
      const cards = row ? (cardsByLesson.get(row.id) ?? []) : [];
      const quiz = row ? (quizByLesson.get(row.id) ?? []) : [];
      const summary = row?.summary?.trim() ?? "";
      const transcript = row?.transcript?.trim() ?? "";
      const transcriptPt = row?.transcript_pt?.trim() ?? "";

      wb.lesson(lesson.position, lesson.title);
      wb.label(`${String(lesson.skill)} focus`);
      wb.para(lesson.objective, { size: 10 });

      if (!summary && !transcript && !cards.length && !quiz.length) {
        wb.note(
          "Not opened yet",
          "EVO writes the script, vocabulary and quiz the first time you open this lesson in the app. Download this PDF again afterwards to have it here.",
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
          wb.entry(
            index + 1,
            card.word,
            `${card.translation}${card.pronunciation ? ` (${card.pronunciation})` : ""}`,
          );
          if (card.example) wb.example(card.example);
        });
      }
      if (quiz.length) {
        wb.label("Quiz");
        quiz.forEach((q, index) => {
          wb.para(`${index + 1}. ${q.question}`, {
            size: 10,
            bold: true,
            color: [INK.r, INK.g, INK.b],
            gap: 2,
          });
          const options = Array.isArray(q.options) ? (q.options as string[]) : [];
          for (const option of options) {
            wb.para(`• ${option}`, { size: 9.5, gap: 1, indent: 18, color: [58, 63, 74] });
          }
          if (q.explanation)
            wb.para(`Why: ${q.explanation}`, { size: 9, indent: 18, color: MUTED_RGB });
        });
      }
      wb.y += 8;
    }
  });

  wb.finish();
  const suffix = single ? `-unit-${units[0]!.unit}` : "";
  return savePdf(doc, `evoluir-business-english${suffix}.pdf`);
}
