import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Flag,
  ListChecks,
  Loader2,
  MessageCircle,
  Plus,
  Repeat,
  Send,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { EvoAvatar } from "@/components/EvoAvatar";
import { LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLife } from "@/hooks/useLife";
import {
  coachShareText,
  whatsappShareUrl,
  type LifeCoachAction,
  type LifeCoachMessage,
} from "@/lib/life";
import { addGoalMilestone, addLifeHabit, askLifeCoach, saveLifeTask } from "@/lib/life.functions";
import { readStorage, writeStorage } from "@/lib/safeStorage";

const STORAGE_KEY = "life-coach-chat";
const SUGGESTIONS = [
  "Break my main goal into small steps",
  "Help me choose today's three priorities",
  "Suggest one habit to start this week",
];

type ChatEntry = LifeCoachMessage & { actions?: LifeCoachAction[] };

function readChat(): ChatEntry[] {
  try {
    const raw = readStorage(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatEntry[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-20) : [];
  } catch {
    return [];
  }
}

/**
 * Life Coach (the owner's Life+ AI coach): practical help with goals, the day's
 * routine and habits, in the student's language; each reply may suggest up to
 * three actions added with one tap. The chat stays on this device.
 */
export function CoachSection() {
  const { t, lang } = useLifeT();
  const { data, isLoading, refresh } = useLife();
  const ask = useServerFn(askLifeCoach);
  const addTask = useServerFn(saveLifeTask);
  const addHabit = useServerFn(addLifeHabit);
  const addMilestone = useServerFn(addGoalMilestone);
  const [messages, setMessages] = useState<ChatEntry[]>(readChat);
  const [input, setInput] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);

  const copyReply = async (index: number, reply: string) => {
    try {
      await navigator.clipboard.writeText(coachShareText(reply));
      setCopied(index);
      window.setTimeout(() => setCopied((current) => (current === index ? null : current)), 2000);
    } catch {
      toast.error(t("The answer could not be copied."));
    }
  };

  const keep = (next: ChatEntry[]) => {
    setMessages(next);
    writeStorage(STORAGE_KEY, JSON.stringify(next.slice(-20)));
  };

  const turn = useMutation({
    mutationFn: (message: string) =>
      ask({
        data: {
          lang,
          message,
          history: messages.map(({ role, content }) => ({ role, content })).slice(-8),
        },
      }),
    onSuccess: (reply, message) => {
      keep([
        ...messages,
        { role: "user", content: message },
        { role: "assistant", content: reply.reply, actions: reply.actions },
      ]);
    },
    onError: (error) => {
      setInput((value) => value || "");
      toast.error(
        t(
          error instanceof Error && /busy|running|wait/i.test(error.message)
            ? "Your previous message is still being answered. Wait a few seconds and send it again."
            : "EVO could not answer this message. Please send it again.",
        ),
      );
    },
  });

  const apply = useMutation({
    mutationFn: async (action: LifeCoachAction) => {
      if (action.type === "task")
        await addTask({
          data: { title: action.title, day: data!.today, priority: action.priority, goalId: null },
        });
      else if (action.type === "habit")
        await addHabit({ data: { title: action.title, frequency: action.frequency } });
      else await addMilestone({ data: { goalId: action.goalId, title: action.title } });
    },
    onSuccess: (_result, action) => {
      setAdded((current) => new Set(current).add(`${action.type}:${action.title}`));
      refresh();
    },
    onError: (error) =>
      toast.error(t(error instanceof Error ? error.message : "It could not be added.")),
  });

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || turn.isPending) return;
    setInput("");
    turn.mutate(clean);
  };

  if (isLoading || !data) return null;
  // The one page shows a single Premium invitation for these sections.
  if (!data.premium) return null;

  const ACTION_ICON = { task: ListChecks, habit: Repeat, milestone: Flag } as const;
  const ACTION_LABEL = {
    task: "Add task",
    habit: "Add habit",
    milestone: "Add milestone",
  } as const;

  return (
    <section
      id="coach"
      className="card-soft scroll-mt-4 flex flex-col gap-4 p-4 sm:p-5 xl:p-6"
      aria-labelledby="life-coach-title"
    >
      <LifeSectionTitle
        id="life-coach-title"
        icon={Sparkles}
        accent="amber"
        title={t("Life Coach")}
        subtitle={t("Plan your day and goals with EVO")}
      />
      {/* One page (user request): the conversation scrolls inside the card. */}
      <div className="flex max-h-[32rem] flex-col gap-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <EvoAvatar decorative className="size-10" />
              <p className="text-sm">
                {t("Hi! I am EVO, your Life Coach. What would you like to plan or improve today?")}
              </p>
            </div>
            <div className="grid gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  disabled={turn.isPending}
                  onClick={() => send(t(suggestion))}
                  className="h-auto min-h-11 justify-start whitespace-normal py-2.5 text-left"
                >
                  {t(suggestion)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <Message key={`${message.role}-${index}`} from={message.role}>
            {message.role === "user" ? (
              <span className="ml-auto text-xs font-medium text-muted-foreground">{t("You")}</span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <EvoAvatar decorative className="size-7 ring-1" />
                {t("Life Coach")}
              </span>
            )}
            <MessageContent className={message.role === "assistant" ? "max-w-prose" : undefined}>
              <MessageResponse>{message.content}</MessageResponse>
            </MessageContent>
            {/* Copy or forward EVO's answer on WhatsApp (user request); the
                student picks the contact in WhatsApp itself. */}
            {message.role === "assistant" ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyReply(index, message.content)}
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied === index ? (
                    <Check className="text-brand-green" aria-hidden="true" />
                  ) : (
                    <Copy aria-hidden="true" />
                  )}
                  {copied === index ? t("Copied") : t("Copy")}
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <a
                    href={whatsappShareUrl(coachShareText(message.content))}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("Send on WhatsApp")}
                  >
                    <MessageCircle className="text-[#25D366]" aria-hidden="true" />
                    {"WhatsApp"}
                  </a>
                </Button>
              </div>
            ) : null}
            {message.actions?.length ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {message.actions.map((action) => {
                  const key = `${action.type}:${action.title}`;
                  const Icon = ACTION_ICON[action.type];
                  const done = added.has(key);
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      disabled={done || apply.isPending}
                      onClick={() => apply.mutate(action)}
                      className="h-auto min-h-8 gap-1.5 whitespace-normal py-1 text-left text-xs"
                    >
                      {done ? (
                        <Check className="size-3.5 text-brand-green" aria-hidden="true" />
                      ) : (
                        <Plus className="size-3.5" aria-hidden="true" />
                      )}
                      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">{t(ACTION_LABEL[action.type])}: </span>
                      <span translate="no">{action.title}</span>
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </Message>
        ))}

        {turn.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("EVO is thinking…")}
          </p>
        ) : null}
      </div>

      <form
        className="flex items-end gap-2 border-t border-border pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          maxLength={1000}
          rows={2}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
          placeholder={t("Write to your Life Coach")}
          aria-label={t("Write to your Life Coach")}
          className="min-h-11 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || turn.isPending}
          aria-label={t("Send message")}
          className="size-11 shrink-0 bg-brand-green text-sidebar hover:bg-brand-green/90"
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </form>
      {messages.length ? (
        <button
          type="button"
          onClick={() => keep([])}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t("New conversation")}
        </button>
      ) : null}
    </section>
  );
}
