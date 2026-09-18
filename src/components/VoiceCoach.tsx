import { useQueryClient } from "@tanstack/react-query";

import {
  Briefcase,
  Coffee,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Plane,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { useOverallAverage } from "@/hooks/useVocabularyProgress";
import { buildStudyContext, useStudySnapshot } from "@/hooks/useStudyContext";
import { supabase } from "@/integrations/supabase/client";
import { coachOpenerMessages, coachReplyMessages, type ConversationReport } from "@/lib/ai-prompts";
import { aiChat } from "@/lib/aiChat.functions";
import { getLevelState } from "@/lib/level";
import { speakEnglish, stopSpeaking } from "@/lib/speech";
import { takeSpeechBlocks } from "@/lib/speechChunks";
import { streamCoachReply } from "@/lib/coach-stream";

import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
} from "@/lib/voice-recorder";
import { finishTalkingLegacy } from "@/lib/legacyActivity.functions";
import { useServerFn } from "@tanstack/react-start";

type ChatMessage = { role: "user" | "assistant"; content: string };
type VoiceState = "idle" | "recording" | "sending" | "transcribing" | "thinking" | "speaking";


const scenarios = [
  {
    id: "everyday",
    label: "Everyday English",
    hint: "Family, friends, routine",
    icon: Coffee,
    fallbackOpeners: [
      "Hi! Great to see you again. How was your day today?",
      "Hey! Imagine we're neighbours chatting over coffee. What did you do last weekend?",
      "Hello! Let's talk about your routine. What is the first thing you do every morning?",
      "Hi there! Tell me about your family. Who do you spend the most time with?",
      "Hey! Let's chat about food. What did you cook or eat yesterday?",
      "Hi! Picture us meeting at a friend's birthday party. What do you usually talk about at parties?",
    ],
  },
  {
    id: "professional",
    label: "Professional English",
    hint: "Meetings, interviews, networking",
    icon: Briefcase,
    fallbackOpeners: [
      "Welcome! Let's warm up for work situations. Can you tell me what you do and what a typical week looks like?",
      "Hi! Imagine I'm interviewing you for your dream job. Tell me a little about yourself.",
      "Hello! You're about to start a team meeting. Can you give a quick status update on your current project?",
      "Hi! We just met at a networking event. What do you do, and why do you like it?",
      "Welcome! You need to ask your manager for a day off. How would you start that conversation?",
      "Hi! A new colleague just joined your team. How would you welcome them and explain your work?",
    ],
  },
  {
    id: "travel",
    label: "Travel English",
    hint: "Airport, hotel, restaurant",
    icon: Plane,
    fallbackOpeners: [
      "Let's travel! You just landed and you're at the check-in desk of your hotel. What do you say to the receptionist?",
      "Ready for a trip? You're at the airport and your flight is delayed. What do you ask at the information desk?",
      "Let's go! You're at a restaurant in New York. How do you order your meal?",
      "Imagine you're lost in London. Stop a stranger and ask for directions to the nearest station.",
      "You're checking out of your hotel and noticed a wrong charge on the bill. What do you say?",
      "You just met another traveller on a train. Introduce yourself and ask about their trip.",
    ],
  },
] as const;

const OPENERS_STORAGE_KEY = "ai-talking-openers-v2";

/** Every topic already used, so the AI never opens with the same subject twice. */
function loadUsedOpeners(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OPENERS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function rememberOpener(opener: string): string[] {
  const next = [...loadUsedOpeners().filter((line) => line !== opener), opener].slice(-40);
  try {
    window.localStorage.setItem(OPENERS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — repetition guard just won't persist.
  }
  return next;
}

/** A different scenario each day, so the daily subject always changes. */
function scenarioOfTheDay(offset = 0) {
  const day = Math.floor(Date.now() / 86400000);
  return scenarios[(day + offset) % scenarios.length]!;
}

async function transcribe(audio: Blob): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again to use voice conversation.");
  const form = new FormData();
  form.append("file", audio, "recording.wav");
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Transcription failed (${response.status}).`);
  }

  let buffer = "";
  let transcript = "";
  const consume = (event: string) => {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      try {
        const payload = JSON.parse(line.slice(5).trim()) as {
          type?: string;
          delta?: string;
          text?: string;
        };
        if (payload.type === "transcript.text.delta") transcript += payload.delta ?? "";
        if (payload.type === "transcript.text.done" && payload.text) transcript = payload.text;
      } catch {
        // Ignore keep-alive events.
      }
    }
  };
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    events.forEach(consume);
  }
  if (buffer.trim()) consume(buffer);
  if (!transcript.trim()) throw new Error("I couldn't hear that clearly. Please try again.");
  return transcript.trim();
}

export function VoiceCoach({ lessonTopic }: { lessonTopic?: string | undefined }) {
  const { data: profile } = useProfile();
  const { data: snapshot } = useStudySnapshot();
  const queryClient = useQueryClient();
  const minutesSpent = useTimeSpent();
  useLogTimeOnExit({
    timer: minutesSpent,
    profile,
    type: "conversation_practice",
    title: "Speaking practice",
  });
  const { data: overall } = useOverallAverage();
  // The conversation always follows the CEFR level the student actually reached.
  const cefrLevel = getLevelState(profile?.level).current.value;
  const [scenario, setScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [report, setReport] = useState<ConversationReport | null>(null);
  const [finishing, setFinishing] = useState(false);
  const talkingOperationKey = useRef(crypto.randomUUID());
  const finishTalking = useServerFn(finishTalkingLegacy);
  const mounted = useRef(true);
  const topicOffset = useRef(0);
  const speechQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelVoiceRecording();
      stopSpeaking();
    };
  }, []);
  useEffect(() => {
    if (!lessonTopic || scenario) return;
    const opener = `Great, you just finished the lesson "${lessonTopic}". Let's practise it in a real conversation. Can you use what you learned in a sentence about your week?`;
    setScenario("everyday");
    setMessages([{ role: "assistant", content: opener }]);
    void playResponse(opener);
  }, [lessonTopic, scenario]);

  // The AI always opens the conversation and chooses the subject itself.
  const started = useRef(false);
  useEffect(() => {
    if (lessonTopic || started.current) return;
    started.current = true;
    void start(0);
  }, [lessonTopic]);

  async function playResponse(text: string) {
    setVoiceState("speaking");
    try {
      await speakEnglish(text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The response could not be played.");
    } finally {
      if (mounted.current) setVoiceState((current) => (current === "speaking" ? "idle" : current));
    }
  }

  function queueSpeech(text: string) {
    speechQueue.current = speechQueue.current
      .then(async () => {
        if (!mounted.current) return;
        setVoiceState("speaking");
        await speakEnglish(text, { cache: "memory" });
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "The response could not be played.");
      });
  }

  /** Starts a conversation with a subject picked by the AI. `offset` asks for another subject. */
  async function start(offset = 0) {
    const selected = scenarioOfTheDay(offset);
    stopSpeaking();
    setScenario(selected.id);
    setReport(null);
    setMessages([]);
    setVoiceState("thinking");
    const used = loadUsedOpeners();
    let opener: string;
    try {
      const text = await aiChat({
        data: {
          messages: coachOpenerMessages(
            selected.id,
            cefrLevel,
            profile?.goal ?? "conversation",
            buildStudyContext(snapshot),
            used,
          ),
          jsonMode: false,
          operation: "talking",
        },
      });
      opener = text.trim();
      if (!opener) throw new Error("empty opener");
    } catch {
      const fresh = selected.fallbackOpeners.filter((line) => !used.includes(line));
      const pool = fresh.length ? fresh : selected.fallbackOpeners;
      opener =
        pool[Math.floor(Math.random() * pool.length)] ??
        "Hi! Let's chat in English. How are you today?";
    }
    rememberOpener(opener);
    if (!mounted.current) return;
    setMessages([{ role: "assistant", content: opener }]);
    await playResponse(opener);
  }

  async function toggleRecording() {
    if (!scenario || voiceState === "thinking" || voiceState === "transcribing") return;
    if (voiceState === "speaking") {
      stopSpeaking();
      setVoiceState("idle");
    }
    if (voiceState === "idle" || voiceState === "speaking") {
      try {
        await startVoiceRecording();
        setVoiceState("recording");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The microphone could not start.");
      }
      return;
    }

    setVoiceState("transcribing");
    try {
      const audio = await stopVoiceRecording();
      const text = await transcribe(audio);
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setVoiceState("thinking");
      let streamedReply = "";
      let phraseBuffer = "";
      const replyIndex = next.length;
      setMessages([...next, { role: "assistant", content: "" }]);
      const raw = await streamCoachReply(
        coachReplyMessages(
          scenario,
          cefrLevel,
          profile?.goal ?? "conversation",
          buildStudyContext(snapshot),
          next.slice(-8),
        ),
        (delta) => {
          streamedReply += delta;
          phraseBuffer += delta;
          if (mounted.current) {
            setMessages((current) =>
              current.map((message, index) =>
                index === replyIndex ? { ...message, content: streamedReply } : message,
              ),
            );
          }
          const split = takeCompletePhrases(phraseBuffer);
          phraseBuffer = split.rest;
          split.phrases.forEach(queueSpeech);
        },
      );
      const reply = raw.trim();
      if (phraseBuffer.trim()) queueSpeech(phraseBuffer.trim());
      const updated: ChatMessage[] = [...next, { role: "assistant", content: reply }];
      setMessages(updated);
      await speechQueue.current;
      if (mounted.current) setVoiceState("idle");
    } catch (error) {
      if (mounted.current) setVoiceState("idle");
      toast.error(
        error instanceof Error ? error.message : "AI Talking could not hear or answer you.",
      );
    }
  }

  async function finish() {
    if (!profile || !scenario) return;
    if (messages.filter((message) => message.role === "user").length < 3) {
      toast.error("Answer at least three times before finishing the session.");
      return;
    }
    stopSpeaking();
    setVoiceState("idle");
    setFinishing(true);
    try {
      const result = await finishTalking({
        data: {
          operationKey: talkingOperationKey.current,
          scenario: scenario as "everyday" | "professional" | "travel",
          messages,
          minutes: minutesSpent(1),
        },
      });
      setReport(result);
      const scored = result.fluency > 0 || result.grammar > 0 || result.vocabulary > 0;
      if (!scored)
        toast.error("We could not score this session, so your Talking progress was not changed.");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate your report.");
    } finally {
      setFinishing(false);
    }
  }

  if (!scenario) {
    return (
      <>
        <h1 className="text-3xl font-bold">AI Talking</h1>
        <p className="mt-2 text-muted-foreground">
          Starting a new conversation… the AI is choosing today's subject.
        </p>
        <div className="mt-7 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> <Shimmer>Preparing your topic…</Shimmer>
        </div>
      </>
    );
  }

  const userAnswers = messages.filter((message) => message.role === "user").length;
  const hasEnoughAnswers = userAnswers >= 3;
  const isProcessingAnswer =
    voiceState === "recording" || voiceState === "transcribing" || voiceState === "thinking";
  const canFinish = hasEnoughAnswers && !isProcessingAnswer && !finishing;
  const statusText =
    voiceState === "recording"
      ? "Listening… tap again when you finish"
      : voiceState === "transcribing"
        ? "Understanding your English…"
        : voiceState === "thinking"
          ? "Preparing a reply…"
          : voiceState === "speaking"
            ? "AI Talking is speaking…"
            : "Tap the microphone and speak in English";

  const newTopic = () => {
    cancelVoiceRecording();
    topicOffset.current += 1;
    void start(topicOffset.current);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">AI Talking</h1>
          <p className="max-w-full text-sm leading-snug text-muted-foreground">
            Voice conversation · the AI chooses today's subject
          </p>
        </div>
      </div>

      {userAnswers === 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <span className="text-muted-foreground">Don't like today's topic?</span>
          <Button size="sm" variant="outline" disabled={isProcessingAnswer} onClick={newTopic}>
            New topic
          </Button>
        </div>
      )}

      <section className="card-soft flex h-[58vh] min-h-[430px] flex-col overflow-hidden">
        <Conversation>
          <ConversationContent className="gap-5 p-5">
            {messages.map((message, index) => (
              <Message key={`${message.role}-${index}`} from={message.role}>
                <MessageContent
                  className={
                    message.role === "user" ? "bg-primary text-primary-foreground" : undefined
                  }
                >
                  <MessageResponse>{message.content}</MessageResponse>
                </MessageContent>
              </Message>
            ))}
            {voiceState === "transcribing" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>Transcribing your answer…</Shimmer>
                </MessageContent>
              </Message>
            )}
            {voiceState === "thinking" && !messages.at(-1)?.content && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>Preparing the first sentence…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border bg-background p-4 text-center">
          <p className="mb-3 min-h-5 text-sm text-muted-foreground" aria-live="polite">
            {statusText}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              size="icon"
              variant="outline"
              aria-label="Replay the last AI response"
              disabled={
                (voiceState !== "idle" && voiceState !== "speaking") ||
                !messages.some((message) => message.role === "assistant")
              }
              onClick={() => {
                const last = [...messages]
                  .reverse()
                  .find((message) => message.role === "assistant");
                if (last) void playResponse(last.content);
              }}
              className={
                voiceState === "speaking"
                  ? "bg-success text-success-foreground hover:bg-success/90"
                  : ""
              }
            >
              <Volume2 />
            </Button>

            <Button
              size="icon"
              aria-label={voiceState === "recording" ? "Stop recording" : "Start recording"}
              onClick={toggleRecording}
              disabled={voiceState === "thinking" || voiceState === "transcribing"}
              className={`size-16 rounded-full ${voiceState === "recording" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
            >
              {voiceState === "recording" ? (
                <MicOff className="size-7" />
              ) : voiceState === "thinking" || voiceState === "transcribing" ? (
                <Loader2 className="size-7 animate-spin" />
              ) : (
                <Mic className="size-7" />
              )}
            </Button>
            <span className="size-9" aria-hidden="true" />
          </div>
        </div>
      </section>

      <div className="space-y-1.5 text-center">
        <Button
          className="w-full"
          size="lg"
          variant="outline"
          onClick={finish}
          disabled={!canFinish}
        >
          {finishing ? <Loader2 className="animate-spin" /> : <Sparkles />}{" "}
          <span>Finish session and get my report</span>
        </Button>
        <p className="text-xs text-muted-foreground">
          {hasEnoughAnswers ? (
            <span className="text-success font-medium">
              Ready — get your personalized feedback.
            </span>
          ) : (
            <>
              <span>Speak at least 3 answers to unlock your report</span>{" "}
              <span>{`(${Math.min(userAnswers, 3)}/3).`}</span>
            </>
          )}
        </p>
      </div>

      {report && (
        <section className="card-soft animate-rise p-6">
          <h2 className="text-lg font-semibold">Talking report</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {[
              { label: "Fluency", value: report.fluency },
              { label: "Grammar", value: report.grammar },
              { label: "Vocabulary", value: report.vocabulary },
            ].map((score) => (
              <div key={score.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{score.label}</span>
                  <span className="text-muted-foreground">{score.value}</span>
                </div>
                <Progress value={score.value} className="mt-2 h-2" />
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{report.summary}</p>
          {report.suggestions.length > 0 && (
            <>
              <h3 className="mt-6 font-semibold">Improvement suggestions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {report.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </>
          )}
          {report.new_words.length > 0 && (
            <>
              <h3 className="mt-6 font-semibold">Words to learn</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {report.new_words.map((word) => (
                  <span
                    key={word}
                    className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
