import { CheckCircle2, XCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type QuizQuestion } from "@/hooks/useLearning";
import { usePersistentState } from "@/hooks/usePersistentState";
import { submitAuthoritativeQuiz } from "@/lib/pedagogy/dualWrite.functions";
import { useUiLang } from "@/lib/uiLang";

/** Multiple-choice / fill-in quiz with instant score, explanations and review advice. */
export function LessonQuiz({
  questions,
  userId,
  lessonId,
  onFinished,
}: {
  questions: QuizQuestion[];
  userId?: string | undefined;
  lessonId: string;
  onFinished?: (score: number) => void;
}) {
  const { lang } = useUiLang();
  // Answers are kept locally so leaving the lesson does not lose them.
  const [answers, setAnswers, clearAnswers] = usePersistentState<Record<string, string>>(
    `lesson-quiz-answers:${userId ?? "guest"}:${lessonId}`,
    {},
  );
  // Whether the quiz was already finished, so a completed lesson keeps showing
  // the corrections instead of an empty quiz when the student comes back.
  const [submitted, setSubmitted, clearSubmitted] = usePersistentState<boolean>(
    `lesson-quiz-submitted:${userId ?? "guest"}:${lessonId}`,
    false,
  );
  const [attemptKey, setAttemptKey, clearAttemptKey] = usePersistentState<string>(
    `lesson-quiz-attempt:${userId ?? "guest"}:${lessonId}`,
    "",
  );
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitQuiz = useServerFn(submitAuthoritativeQuiz);

  const correct = questions.filter((q) => answers[q.id] === q.correct_answer).length;
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;

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
        setSubmitted(true);
        onFinished?.(saved.score);
        return;
      }
      setSubmitted(true);
      onFinished?.(score);
    } catch (error) {
      setSaveFailed(true);
      toast.error(
        error instanceof Error
          ? error.message
          : "Your answers are safe, but progress could not be saved. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">This lesson has no quiz yet.</p>;
  }

  const PASS_SCORE = 70;

  function retake() {
    clearAnswers();
    clearSubmitted();
    clearAttemptKey();
    setAnswers({});
    setSubmitted(false);
    setAttemptKey("");
  }

  return (
    <div className="space-y-5">
      {submitted && (
        <div className="card-soft bg-primary p-6 text-primary-foreground">
          <p className="text-sm text-primary-foreground/70">Your score</p>
          <p className="text-4xl font-bold">{score}%</p>
          <p className="mt-2 text-sm text-primary-foreground/80">
            {lang === "pt"
              ? `${correct} de ${questions.length} corretas. `
              : `${correct} of ${questions.length} correct. `}
            {score >= PASS_SCORE
              ? lang === "pt"
                ? "Muito bem — você passou! Suas respostas foram salvas e você pode refazer o quiz quando quiser."
                : "Great job — you passed! Your answers are saved, and you can redo the quiz whenever you want."
              : lang === "pt"
                ? `Você precisa de pelo menos ${PASS_SCORE}% para passar. Revise as explicações abaixo e refaça o quiz.`
                : `You need at least ${PASS_SCORE}% to pass. Review the explanations below and retake the quiz.`}
          </p>
          <Button variant="secondary" className="mt-4" onClick={retake}>
            {lang === "pt" ? "Refazer o quiz" : score >= PASS_SCORE ? "Redo quiz" : "Retake quiz"}
          </Button>
        </div>
      )}

      {questions.map((q, i) => {
        const chosen = answers[q.id];
        const isCorrect = chosen === q.correct_answer;
        return (
          <div key={q.id} className="card-soft p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Question {i + 1}
            </p>
            <p className="mt-1 font-medium">{q.question}</p>
            <div className="mt-3 grid gap-2">
              {q.options.map((opt) => {
                const selected = chosen === opt;
                let style = "border-border hover:bg-secondary";
                let textColor = "";
                if (submitted && opt === q.correct_answer) {
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
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${style} ${textColor}`}
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
                <span>{q.explanation}</span>
              </p>
            )}
          </div>
        );
      })}

      {!submitted && (
        <div className="space-y-2">
          {saveFailed && (
            <p className="text-center text-sm text-destructive" role="alert">
              Your answers are saved on this device. Try saving again.
            </p>
          )}
          <Button
            className="w-full"
            disabled={Object.keys(answers).length < questions.length || saving}
            onClick={submit}
          >
            {saving ? "Saving…" : saveFailed ? "Try saving again" : "Finish quiz"}
          </Button>
        </div>
      )}
    </div>
  );
}
