import { jsPDF } from "jspdf";

import { getLeague, DAYS_PER_LEAGUE } from "@/components/LeagueBadge";
import { supabase } from "@/integrations/supabase/client";
import { findLevel } from "@/lib/level";
import { savePdf } from "@/lib/pdfDownload";
import { drawCover, drawFooters, drawHeader, loadLogo, shorten } from "@/lib/pdfTheme";

export type LeagueReportInput = {
  name: string;
  level: string;
  streakDays: number;
};

/** Collects everything the student studied in the days of the league that just closed. */
async function collectLeagueData(userId: string) {
  const since = new Date(Date.now() - DAYS_PER_LEAGUE * 24 * 60 * 60 * 1000).toISOString();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("level")
    .eq("id", userId)
    .maybeSingle();
  const level = profileRow?.level ?? "b1";


  const [lessons, quizzes, words, activities, progress] = await Promise.all([
    supabase
      .from("user_lessons")
      .select("completed_at, progress, lessons(title, category, level, objective, summary)")
      .eq("user_id", userId)
      .gte("updated_at", since)
      .order("updated_at", { ascending: true }),
    supabase.from("quiz_results").select("score, created_at").eq("user_id", userId).gte("created_at", since),
    supabase
      .from("user_vocabulary")
      .select("mastery_level, last_reviewed_at, vocabulary(word, translation)")
      .eq("user_id", userId)
      .gte("mastery_level", 75),
    supabase
      .from("activities")
      .select("activity_type, duration_minutes, created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
      supabase
        .from("progress")
        .select("speaking_score, writing_score, reading_score, grammar_score, listening_score")
        .eq("user_id", userId)
        .eq("level", level)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
  ]);

  const lessonRows = (lessons.data ?? []).filter((r) => r.lessons);
  const quizRows = quizzes.data ?? [];
  const minutes = (activities.data ?? []).reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0);

  return {
    lessons: lessonRows,
    completedLessons: lessonRows.filter((r) => r.completed_at).length,
    quizAverage: quizRows.length
      ? Math.round(quizRows.reduce((s, q) => s + (q.score ?? 0), 0) / quizRows.length)
      : 0,
    quizCount: quizRows.length,
    words: (words.data ?? []).filter((w) => w.vocabulary).slice(0, 40),
    minutes,
    sessions: (activities.data ?? []).length,
    scores: progress.data,
  };
}

/** Builds and downloads a personalised PDF with the content of the league's 15 days. */
export async function downloadLeagueReport(userId: string, input: LeagueReportInput) {
  const [data, logo] = await Promise.all([collectLeagueData(userId), loadLogo()]);
  const league = getLeague(input.streakDays);
  const level = findLevel(input.level);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string) => {
    ensureSpace(40);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 24, 33);
    doc.text(text, margin, y);
    y += 6;
    doc.setDrawColor(210, 214, 222);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  const body = (text: string, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(45, 50, 60);
    const lines = doc.splitTextToSize(text, pageW - margin * 2 - indent);
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, margin + indent, y);
      y += 14;
    }
  };

  drawCover(doc, logo, {
    title: "Evoluir+ English AI",
    subtitle: `${league.name} league report`,
    meta: `${level.label}  ·  ${DAYS_PER_LEAGUE} days of study`,
    footnote: `${input.name || "Student"}  ·  ${new Date().toLocaleDateString()}`,
  });
  doc.addPage();

  drawHeader(doc, logo, {
    title: "Evoluir+ English AI",
    subtitle: `${league.name} league report - ${DAYS_PER_LEAGUE} days of study`,
    meta: `${input.name || "Student"}  ·  ${level.label}  ·  ${new Date().toLocaleDateString()}`,
    margin,
  });
  y = 152;

  heading(`Your ${DAYS_PER_LEAGUE} days in numbers`);
  const stats: [string, string][] = [
    ["Lessons completed", `${data.completedLessons}`],
    ["Study minutes", `${data.minutes} min`],
    ["Study sessions", `${data.sessions}`],
    ["Quizzes taken", `${data.quizCount}`],
    ["Quiz average", `${data.quizAverage}%`],
    ["Words mastered", `${data.words.length}`],
    ["Talking score", `${data.scores?.speaking_score ?? 0}%`],
    ["Writing score", `${data.scores?.writing_score ?? 0}%`],
    ["Reading score", `${data.scores?.reading_score ?? 0}%`],
    ["Listening score", `${data.scores?.listening_score ?? 0}%`],
  ];
  const colW = (pageW - margin * 2) / 2;
  stats.forEach(([label, value], i) => {
    if (i % 2 === 0) ensureSpace(22);
    const x = margin + (i % 2) * colW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(90, 96, 108);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 24, 33);
    doc.text(value, x + colW - 60, y);
    if (i % 2 === 1) y += 18;
  });
  if (stats.length % 2 === 1) y += 18;

  heading("Lessons you studied");
  if (data.lessons.length === 0) {
    body("No lessons were opened in this league. Start a lesson to fill your next report.");
  } else {
    for (const row of data.lessons) {
      const lesson = row.lessons!;
      ensureSpace(46);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 24, 33);
      doc.text(
        `${row.completed_at ? "[done] " : "[in progress] "}${lesson.title}`,
        margin,
        y,
      );
      y += 14;
      body(`${lesson.category} · ${String(lesson.level).toUpperCase()} · ${lesson.objective || ""}`.trim(), 10);
      if (lesson.summary) body(shorten(lesson.summary, 260), 10);
      y += 6;
    }
  }

  heading("Vocabulary you mastered");
  if (data.words.length === 0) {
    body("No words reached mastery yet. Review your flashcards to add words here.");
  } else {
    for (const w of data.words) {
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(20, 24, 33);
      doc.text(w.vocabulary!.word, margin + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 86, 98);
      doc.text(`- ${w.vocabulary!.translation}`, margin + 170, y);
      y += 15;
    }
  }

  heading("What comes next");
  body(
    league.nextIn > 0
      ? `Keep your streak alive for ${league.nextIn} more days to reach the next league. Finish all lessons of ${level.label} and pass the Final Test with 70% or more to move up.`
      : `You reached the top league. Close it with an overall average of 70% or more to move up from ${level.label} to the next CEFR level.`,
  );

  drawFooters(doc, `Evoluir+ English AI · ${league.name} league`, margin);

  return savePdf(doc, `evoluir-${league.name.toLowerCase()}-league-report.pdf`);
}
