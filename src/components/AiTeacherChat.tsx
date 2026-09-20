import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { loadTeacherSession, teacherTurn } from "@/lib/aiTeacher.functions";
import {
  buildTeacherHistory,
  parseStoredMessages,
  teacherErrorMessage,
  validateTeacherMessage,
  TEACHER_MESSAGE_MAX,
  type TeacherChatMessage,
} from "@/lib/teacherChat";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";

const suggestions = [
  "Explain a grammar topic",
  "Practice vocabulary",
  "Correct my English",
  "Let's practice conversation",
];

const quickActions = ["Practise this", "Explain another way"];

const MODE_LABEL: Record<string, string> = {
  EXPLAIN: "Explaining",
  PRACTICE: "Practising",
  CORRECT: "Correcting",
  EXAMPLE: "Examples",
  REVIEW: "Reviewing",
  CONVERSATION: "Conversation",
};

const errorCopy: Record<string, string> = {
  offline: "You seem to be offline. Check your connection and try again.",
  quota: "You have reached your AI usage limit for now. Please try again later.",
  auth: "Your session expired. Please sign in again.",
  network: "The teacher is unavailable right now. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

export function AiTeacherChat({ lessonId }: { lessonId?: string }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<TeacherChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const session = useQuery({
    queryKey: ["teacher-session", lessonId ?? null],
    queryFn: () => loadTeacherSession({ data: lessonId ? { lessonId } : {} }),
    staleTime: 5 * 60 * 1000,
  });

  // Hydrate the last conversation once, so the student continues where they stopped.
  useEffect(() => {
    if (started || !session.data?.conversation) return;
    const stored = parseStoredMessages(session.data.conversation.messages);
    if (stored.length === 0) return;
    setMessages(stored);
    setConversationId(session.data.conversation.id);
    setStarted(true);
  }, [session.data, started]);

  const turn = useMutation({
    mutationFn: async (message: string) =>
      teacherTurn({
        data: {
          message,
          ...(conversationId ? { conversationId } : {}),
          ...(lessonId ? { lessonId } : {}),
          history: buildTeacherHistory(messages),
        },
      }),
    onSuccess: (result) => {
      if (result.conversationId) setConversationId(result.conversationId);
      setMode(result.mode ?? null);
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      void queryClient.invalidateQueries({ queryKey: ["teacher-session"] });
    },
    onError: (err) => {
      setError(errorCopy[teacherErrorMessage(err)] ?? errorCopy["unknown"]!);
      setMessages((prev) => (prev.at(-1)?.role === "user" ? prev.slice(0, -1) : prev));
    },
  });

  function send(raw: string) {
    const { ok, value } = validateTeacherMessage(raw);
    if (!ok || turn.isPending) return;
    setError(null);
    setStarted(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: value }]);
    turn.mutate(value);
  }

  function newConversation() {
    setMessages([]);
    setConversationId(undefined);
    setInput("");
    setError(null);
    setStarted(true);
    inputRef.current?.focus();
  }

  const ctx = session.data?.context;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("AI Teacher")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("Practice English with your personal AI teacher")}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={newConversation}>
          <Plus className="size-4" aria-hidden="true" />
          {t("New conversation")}
        </Button>
      </header>

      {(ctx?.cefrLevel || ctx?.focusSkill || ctx?.lessonTitle) && (
        <div className="flex flex-wrap items-center gap-2" aria-label={t("Your context")}>
          {ctx.cefrLevel && (
            <Badge variant="secondary">
              {t("Level")}: {ctx.cefrLevel}
            </Badge>
          )}
          {ctx.focusSkill && (
            <Badge variant="secondary">
              {t("Focus")}: {ctx.focusSkill}
            </Badge>
          )}
          {ctx.lessonTitle && <Badge variant="outline">{ctx.lessonTitle}</Badge>}
          {mode && <Badge variant="outline">{t(MODE_LABEL[mode] ?? mode)}</Badge>}
        </div>
      )}

      <Card className="flex h-[min(60dvh,38rem)] min-h-[20rem] flex-col overflow-hidden p-0 sm:h-[min(62dvh,42rem)] sm:min-h-[22.5rem]">
        <Conversation className="flex-1">
          <ConversationContent className="gap-6 p-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-4">
                <Message from="assistant">
                  <MessageContent>
                    <MessageResponse>
                      {t("Hi! I'm your AI Teacher. What would you like to practice today?")}
                    </MessageResponse>
                  </MessageContent>
                </Message>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => send(suggestion)}
                      disabled={turn.isPending}
                    >
                      {t(suggestion)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <Message key={`${message.role}-${index}`} from={message.role}>
                <span className="text-xs font-medium text-muted-foreground group-[.is-user]:ml-auto">
                  {message.role === "user" ? t("You") : t("AI Teacher")}
                </span>
                <MessageContent>
                  <MessageResponse>{message.content}</MessageResponse>
                </MessageContent>
              </Message>
            ))}

            {messages.at(-1)?.role === "assistant" && !turn.isPending && (
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <Button key={action} variant="outline" size="sm" onClick={() => send(action)}>
                    {t(action)}
                  </Button>
                ))}
              </div>
            )}

            {turn.isPending && (
              <div aria-live="polite" className="text-sm">
                <Shimmer>{t("Teacher is thinking...")}</Shimmer>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {t(error)}
              </p>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <form
          className="flex items-end gap-2 border-t bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <label className="sr-only" htmlFor="teacher-message">
            {t("Type your message")}
          </label>
          <Textarea
            id="teacher-message"
            ref={inputRef}
            value={input}
            maxLength={TEACHER_MESSAGE_MAX}
            rows={2}
            placeholder={t("Type your message...")}
            disabled={turn.isPending}
            onChange={(event) => setInput(event.target.value)}
            onFocus={(event) => {
              window.setTimeout(() => event.currentTarget.scrollIntoView({ block: "center" }), 150);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            className="min-h-[52px] scroll-mb-32 resize-none"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t("Send message")}
            disabled={turn.isPending || !validateTeacherMessage(input).ok}
          >
            <Send className="size-4" aria-hidden="true" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
