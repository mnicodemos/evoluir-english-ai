import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Flag,
  Flower2,
  ListChecks,
  Loader2,
  Plus,
  Repeat,
  Scale,
  Send,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { notifyLife } from "@/components/life/LifeNotification";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { EvoAvatar } from "@/components/EvoAvatar";
import { CopyButton, WhatsAppButton } from "@/components/ShareActions";
import { LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLife } from "@/hooks/useLife";
import { coachShareText, type LifeCoachAction, type LifeCoachMessage } from "@/lib/life";
import { addGoalMilestone, addLifeHabit, askLifeCoach, saveLifeTask } from "@/lib/life.functions";
import { readStorage, writeStorage } from "@/lib/safeStorage";

const STORAGE_KEY = "life-coach-chat";
const QUICK_PROMPTS = [
  {
    label: "What should I prioritize today?",
    prompt:
      "Look at my current goals, tasks and habits. Tell me the most important thing to prioritize today, explain briefly why, and give me one realistic first action.",
  },
  {
    label: "Break my goal into steps",
    prompt:
      "Help me break my most important active goal into small, realistic steps. Use my goals and today's context, and suggest the first action I can take today.",
  },
  {
    label: "I'm short on time today",
    prompt:
      "I am short on time today. Help me choose a realistic minimum version of my plan: one essential action, what can wait, and a short time estimate for each.",
  },
  {
    label: "Feedback on a real situation",
    prompt:
      "I want feedback on a real situation. Ask me one focused question about what happened, then help me understand my options and choose a constructive next step. Do not assume details I have not shared.",
  },
] as const;

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
      notifyLife(
        t(
          error instanceof Error && /busy|running|wait/i.test(error.message)
            ? "Your previous message is still being answered. Wait a few seconds and send it again."
            : "EVO could not answer this message. Please send it again.",
        ),
        "error",
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
      notifyLife(t(error instanceof Error ? error.message : "It could not be added."), "error"),
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
      <div className="life-coach-messages scroll-quiet flex max-h-[32rem] flex-col gap-4 overflow-y-auto pr-1 xl:min-h-0 xl:max-h-none xl:flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <EvoAvatar decorative className="size-10" />
              <p className="text-sm">
                {t("Hi! I am EVO, your Life Coach. What would you like to plan or improve today?")}
              </p>
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
                <CopyButton text={coachShareText(message.content)} />
                <WhatsAppButton text={coachShareText(message.content)} />
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

      <nav
        aria-label={t("Life Coach quick actions")}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {QUICK_PROMPTS.map((item) => (
          <Button
            key={item.label}
            type="button"
            size="sm"
            variant="outline"
            disabled={turn.isPending}
            onClick={() => send(item.prompt)}
            className="h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-xs"
          >
            {t(item.label)}
          </Button>
        ))}
        <a
          href="#meditation"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Flower2 className="size-3.5" aria-hidden="true" />
          {t("2-minute breathing before focus")}
        </a>
        <Link
          to="/life/decisions"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Scale className="size-3.5" aria-hidden="true" />
          {t("Help me make a decision")}
        </Link>
      </nav>

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
