import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookA, ChevronDown, Loader2, PenLine, Send, SpellCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";
import type { WritingHelpKind } from "@/lib/writingHelp";
import { askWritingHelp } from "@/lib/writingHelp.functions";

const QUICK: { kind: Exclude<WritingHelpKind, "ask">; label: string; icon: typeof PenLine }[] = [
  { kind: "start", label: "How do I start?", icon: PenLine },
  { kind: "words", label: "Words I can use", icon: BookA },
  { kind: "check", label: "Check my last sentence", icon: SpellCheck },
];

/**
 * "Ask EVO for help" under the Writing box (user request, 2026-10-22): three
 * quick asks and a free question, answered by the AI Teacher in the language on
 * screen. EVO gives hints, words or one corrected sentence, never the whole
 * answer, so the correction still measures the student's own text.
 */
export function WritingHelp({ task, draft }: { task: string; draft: string }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const ask = useServerFn(askWritingHelp);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ ask: string; reply: string }[]>([]);

  const help = useMutation({
    mutationFn: (input: { kind: WritingHelpKind; label: string; question?: string }) =>
      ask({
        data: { kind: input.kind, task, draft, question: input.question ?? "", lang },
      }),
    onSuccess: (result, input) => {
      setAnswers((current) => [{ ask: input.label, reply: result.reply }, ...current].slice(0, 3));
      if (input.kind === "ask") setQuestion("");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        t(
          /today's AI limit|month's AI limit/i.test(message)
            ? "You reached today's AI Teacher limit. Please try again tomorrow."
            : /already running|wait a moment|busy/i.test(message)
              ? "Your previous message is still being answered. Wait a few seconds and send it again."
              : "EVO could not answer this message. Please send it again.",
        ),
      );
    },
  });

  return (
    <div className="mt-4 rounded-xl border border-border bg-white/[0.02]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium"
      >
        <Sparkles className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
        <span className="flex-1">{t("Ask EVO for help")}</span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-3">
          <div className="flex flex-wrap gap-2">
            {QUICK.map((item) => (
              <Button
                key={item.kind}
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={help.isPending || (item.kind === "check" && !draft.trim())}
                onClick={() => help.mutate({ kind: item.kind, label: t(item.label) })}
              >
                <item.icon className="size-3.5" aria-hidden="true" />
                {t(item.label)}
              </Button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const clean = question.trim();
              if (clean && !help.isPending)
                help.mutate({ kind: "ask", label: clean, question: clean });
            }}
          >
            <Input
              value={question}
              maxLength={500}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t("Ask anything, in Portuguese or English")}
              aria-label={t("Ask EVO for help")}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!question.trim() || help.isPending}
              aria-label={t("Send message")}
              className="shrink-0"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </form>
          {help.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("EVO is thinking…")}
            </p>
          ) : null}
          {answers.map((answer, index) => (
            <div key={`${answer.ask}-${index}`} className="flex items-start gap-2.5">
              <EvoAvatar decorative className="size-8 shrink-0" />
              <div className="min-w-0 rounded-lg bg-secondary/60 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">{answer.ask}</p>
                <p translate="no" className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {answer.reply}
                </p>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            {t("EVO gives hints, never your whole text. Uses your AI Teacher daily limit.")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
