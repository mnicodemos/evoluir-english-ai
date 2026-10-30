import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DoneSeal } from "@/components/DoneSeal";
import { Button } from "@/components/ui/button";
import { type QuizQuestion } from "@/hooks/useLearning";
import { usePersistentState } from "@/hooks/usePersistentState";
import { submitAuthoritativeQuiz } from "@/lib/pedagogy/dualWrite.functions";
import { quizSkillSummary } from "@/lib/quizSummary";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

type SubmittedDetail = {
  question_id: string;
  correct_answer: string;
  is_correct: boolean;
};

/** Same order every render for a question (seeded by its id), so the right answer's
 * position varies between questions even when the AI always lists it first. */
function stableShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Multiple-choice / fill-in quiz with instant score, explanations and review advice. */
export function LessonQuiz({
  questions,
  userId,
  lessonId,
  onFinished,
  lessonCompleted,
  continueTo,
}: {
  questions: QuizQuestion[];
  userId?: string | undefined;
  lessonId: string;
  onFinished?: (score: number, attemptKey: string) => void;
  /** When known false, a passed attempt saved here completes its lesson on open. */
  lessonCompleted?: boolean | undefined;
  /** Where to go once the quiz is passed (the learning path, for a lesson). */
  continueTo?: { to: "/learning"; label: string } | undefined;
}) {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  // Each retake is a new round: the questions and their options come in a new
  // order, the ones missed first (owner request, 2026-10-30: the same order
  // let a student pass by remembering positions).
  const [round, setRound] = usePersistentState<number>(
    `lesson-quiz-round:${userId ?? "guest"}:${lessonId}`,
    0,
  );
  const [missedFirst, setMissedFirst] = usePersistentState<string[]>(
    `lesson-quiz-missed:${userId ?? "guest"}:${lessonId}`,
    [],
  );
  // One question at a time behind numbered tabs, like the daily reading.
  const [current, setCurrent] = useState(0);
  // Answers are kept locally so leaving the lesson does not lose them.
  const [answers, setAnswers, clearAnswers] = usePersistentState<Record<string, string>>(
    `lesson-quiz-answers:${userId ?? "guest"}:${lessonId}`,
    {},
  );
  // Whether the quiz was already finished, so a completed lesson keeps showing
  // the corrections instead of an empty quiz when the student comes back.
  const [submitted, setSubmitted, clearSubmitted] = usePersistentState<boolean>(
    `lesson-quiz-submitted-v2:${userId ?? "guest"}:${lessonId}`,
    false,
  );
  const [attemptKey, setAttemptKey, clearAttemptKey] = usePersistentState<string>(
    `lesson-quiz-attempt:${userId ?? "guest"}:${lessonId}`,
    "",
  );
  const [submittedResult, setSubmittedResult, clearSubmittedResult] = usePersistentState<{
    score: number;
    correct: number;
    total: number;
    details: SubmittedDetail[];
  } | null>(`lesson-quiz-result:${userId ?? "guest"}:${lessonId}`, null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitQuiz = useServerFn(submitAuthoritativeQuiz);

  // A quiz passed here whose lesson never got completed (the completion call
  // failed or ran before the server-side rule) is completed once on open.
  const healTried = useRef(false);
  useEffect(() => {
    if (healTried.current || lessonCompleted !== false) return;
    if (!submitted || !attemptKey || !submittedResult || submittedResult.score < 70) return;
    healTried.current = true;
    onFinished?.(submittedResult.score, attemptKey);
  }, [lessonCompleted, submitted, attemptKey, submittedResult, onFinished]);

  const correct = submittedResult?.correct ?? 0;
  const score = submittedResult?.score ?? 0;
  const ordered = (() => {
    if (round === 0) return questions;
    const shuffled = stableShuffle(questions, `${lessonId}:${round}`);
    return [
      ...shuffled.filter((q) => missedFirst.includes(q.id)),
      ...shuffled.filter((q) => !missedFirst.includes(q.id)),
    ];
  })();

  async function submit() {
    setSaving(true);
    setSaveFailed(false);
    try {
      if (userId) {
        const stableAttemptKey = attemptKey || crypto.randomUUID();
        if (!attemptKey) setAttemptKey(stableAttemptKey);
        const saved = await submitQuiz({
          data: {
            attemptKey: stableAttemptKey,
            lessonId,
            answers: questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" })),
          },
        });
        setSubmittedResult({
          score: saved.score,
          correct: saved.correct,
          total: saved.total,
          details: saved.details.flatMap((detail) =>
            detail.question_id
              ? [
                  {
                    question_id: detail.question_id,
                    correct_answer: detail.correct_answer,
                    is_correct: detail.is_correct,
                  },
                ]
              : [],
          ),
        });
        healTried.current = true;
        setSubmitted(true);
        setCurrent(0);
        onFinished?.(saved.score, stableAttemptKey);
        return;
      }
      throw new Error(t("Sign in to save and grade this quiz."));
    } catch (error) {
      setSaveFailed(true);
      toast.error(
        error instanceof Error
          ? error.message
          : t("Your answers are safe, but progress could not be saved. Try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("This lesson has no quiz yet.")}</p>;
  }

  const PASS_SCORE = 70;
  const passed = submitted && score >= PASS_SCORE;

  function retake() {
    setMissedFirst(
      (submittedResult?.details ?? []).filter((d) => !d.is_correct).map((d) => d.question_id),
    );
    setRound(round + 1);
    clearAnswers();
    clearSubmitted();
    clearAttemptKey();
    clearSubmittedResult();
    setAnswers({});
    setSubmitted(false);
    setAttemptKey("");
    setSubmittedResult(null);
    setCurrent(0);
  }

  function choose(questionId: string, option: string, index: number) {
    const next = { ...answers, [questionId]: option };
    setAnswers(next);
    // Answering moves to the next open question, like the daily reading.
    const open = ordered.findIndex((q, i) => i > index && !next[q.id]);
    const anyOpen = open >= 0 ? open : ordered.findIndex((q) => !next[q.id]);
    if (anyOpen >= 0) window.setTimeout(() => setCurrent(anyOpen), 250);
  }

  // What to review, by skill (owner request, 2026-10-30: the result gave a
  // score and loose explanations, not a direction).
  const summary = submitted
    ? quizSkillSummary(
        ordered.map((q) => ({
          skill: q.pedagogical_skill ?? null,
          right: submittedResult?.details.find((d) => d.question_id === q.id)?.is_correct === true,
        })),
      )
    : [];
  const weak = summary.filter((row) => row.weak);
  const answeredCount = ordered.filter((q) => answers[q.id]).length;
  const index = Math.min(current, ordered.length - 1);
  const q = ordered[index]!;
  const chosen = answers[q.id];
  const detail = submittedResult?.details.find((item) => item.question_id === q.id);
  const isCorrect = detail?.is_correct === true;

  return (
    <div className="space-y-4">
      {submitted && (
        <div className="card-soft p-5 sm:p-6">
          <div className="flex items-center gap-3">
            {passed ? <DoneSeal /> : null}
            <div>
              <p className="text-sm text-muted-foreground">{t("Your score")}</p>
              <p className="text-4xl font-bold tabular-nums">{score}%</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-foreground/80">
            <span>{correct}</span> <span>{t("of")}</span> <span>{questions.length}</span>{" "}
            <span>{t("correct.")}</span>{" "}
            {passed
              ? t(
                  "Great job — you passed! Your answers are saved, and you can redo the quiz whenever you want.",
                )
              : t(
                  "You need at least 70% to pass. Review the explanations and retake the quiz: the questions come in a new order, the ones you missed first.",
                )}
          </p>
          {summary.length > 1 ? (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {summary.map((row) => (
                <span key={row.skill} className={cn(row.weak && "text-amber-400")}>
                  <span>{t(row.label)}</span>{" "}
                  <span className="tabular-nums">
                    {row.right}/{row.total}
                  </span>
                </span>
              ))}
            </p>
          ) : null}
          {weak.length ? (
            <p className="mt-2 text-sm">
              <span>{t("To review")}:</span>{" "}
              <span className="font-semibold">{weak.map((row) => t(row.label)).join(", ")}</span>
              <span>.</span>{" "}
              <Link to="/teacher" className="font-semibold text-brand-green hover:underline">
                {t("Practise it with the AI Teacher")}
              </Link>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant={passed ? "outline" : "default"} onClick={retake}>
              {passed ? t("Redo quiz") : t("Retake quiz")}
            </Button>
            {passed && continueTo ? (
              <Button asChild>
                <Link to={continueTo.to}>
                  {t(continueTo.label)} <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div className="card-soft break-words p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("Questions")}>
          {ordered.map((item, i) => {
            const answered = !!answers[item.id];
            const result = submittedResult?.details.find((d) => d.question_id === item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === i}
                aria-label={`${t("Question")} ${i + 1}`}
                onClick={() => setCurrent(i)}
                className={cn(
                  "grid size-8 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                  submitted && result?.is_correct
                    ? "border-brand-green bg-brand-green/15 text-brand-green"
                    : submitted && result
                      ? "border-destructive/60 bg-destructive/10 text-destructive"
                      : answered
                        ? "border-brand-green/50 bg-brand-green/10 text-foreground"
                        : "border-border text-muted-foreground",
                  index === i && "ring-2 ring-brand-green/60 ring-offset-1 ring-offset-background",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{t("Question")}</span> <span>{index + 1}</span>
        </p>
        <p className="mt-1 font-medium" translate="no">
          {q.question}
        </p>
        <div className="mt-3 grid gap-2">
          {stableShuffle(q.options, round === 0 ? q.id : `${q.id}:${round}`).map((opt) => {
            const selected = chosen === opt;
            let style = "border-border hover:bg-secondary";
            let textColor = "";
            if (submitted && opt === detail?.correct_answer) {
              style = "border-success bg-success/10";
              textColor = "text-success";
            } else if (submitted && selected) {
              style = "border-destructive bg-destructive/10";
              textColor = "text-destructive";
            } else if (selected) {
              style = "border-primary bg-secondary";
            }
            return (
              <button
                key={opt}
                type="button"
                translate="no"
                disabled={submitted}
                onClick={() => choose(q.id, opt, index)}
                className={`min-h-11 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${style} ${textColor}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {submitted && (
          <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            {isCorrect ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[oklch(0.55_0.14_158)]" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-[oklch(0.6_0.16_25)]" />
            )}
            <span translate="no">{q.explanation}</span>
          </p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={index === 0}
            onClick={() => setCurrent(index - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> {t("Previous")}
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {index + 1}/{ordered.length}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={index >= ordered.length - 1}
            onClick={() => setCurrent(index + 1)}
          >
            {t("Next")} <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!submitted && (
        <div className="space-y-2">
          {saveFailed && (
            <p className="text-center text-sm text-destructive" role="alert">
              {t("Your answers are saved on this device. Try saving again.")}
            </p>
          )}
          <Button
            className="w-full"
            disabled={answeredCount < questions.length || saving}
            onClick={submit}
          >
            {saving
              ? t("Saving…")
              : saveFailed
                ? t("Try saving again")
                : answeredCount < questions.length
                  ? `${t("Finish quiz")} · ${answeredCount}/${questions.length}`
                  : t("Finish quiz")}
          </Button>
        </div>
      )}
    </div>
  );
}
