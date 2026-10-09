import { useQueryClient } from "@tanstack/react-query";

import { Link } from "@tanstack/react-router";
import { Loader2, Mic, MicOff, Sparkles, Star, Video, Volume2 } from "lucide-react";
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
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { buildStudyContext, useStudySnapshot } from "@/hooks/useStudyContext";
import { coachOpenerMessages, coachReplyMessages, type ConversationReport } from "@/lib/ai-prompts";
import { aiChat } from "@/lib/aiChat.functions";
import { getLevelState } from "@/lib/level";
import { supabase } from "@/integrations/supabase/client";
import { turnTimingRow, type TurnMarks } from "@/lib/speakingTiming";
import { prepareSpeech, speakEnglish, stopSpeaking } from "@/lib/speech";
import { takeStreamBlocks } from "@/lib/speechChunks";
import { COACH_TIMEOUT_MESSAGE, streamCoachReply } from "@/lib/coach-stream";
import { talkingTurn } from "@/lib/talkingQueue";

import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
} from "@/lib/voice-recorder";
import { finishTalkingLegacy } from "@/lib/legacyActivity.functions";
import { useServerFn } from "@tanstack/react-start";
import { refreshAfterActivity } from "@/lib/refreshKeys";
import { transcribeAudio } from "@/lib/transcribe";
import {
  loadUsedOpeners,
  rememberOpener,
  rolePlaysForGoal,
  scenarioOfTheDay,
  type RolePlay,
} from "@/components/coach/coachScenarios";
import { EvoAvatar } from "@/components/EvoAvatar";
import { SpeakingReport } from "@/components/coach/SpeakingReport";
import { VideoCallStage } from "@/components/coach/VideoCallStage";
import { findBusinessRolePlay } from "@/lib/businessCourse";
import { goalRolePlay } from "@/lib/goalPractice";
import { studyToday } from "@/lib/today";
import { isWeatherCondition, weatherRolePlay } from "@/lib/weatherTalk";

type ChatMessage = { role: "user" | "assistant"; content: string };
type VoiceState = "idle" | "recording" | "sending" | "transcribing" | "thinking" | "speaking";

export function VoiceCoach({
  lessonTopic,
  weather,
  business,
  goal,
  presentation = "chat",
}: {
  lessonTopic?: string | undefined;
  /** Opens a "Weather talk" conversation about today's weather. */
  weather?: string | undefined;
  /** "call" shows the same conversation as a video call with EVO. */
  presentation?: "chat" | "call";
  /** Opens a Business English situation (businessCourse.ts) by its id. */
  business?: string | undefined;
  /** Opens a conversation about one of the student's Goals by its id. */
  goal?: string | undefined;
}) {
  const { data: profile } = useProfile();
  const { data: snapshot } = useStudySnapshot();
  const queryClient = useQueryClient();
  const minutesSpent = useTimeSpent();
  // The conversation always follows the CEFR level the student actually reached.
  const cefrLevel = getLevelState(profile?.level).current.value;
  const [scenario, setScenario] = useState<string | null>(null);
  // A real-life situation where EVO plays a role (null = free conversation).
  const [rolePlay, setRolePlay] = useState<RolePlay | null>(null);
  // The video call is an informal chat with EVO; AI Speaking stays a lesson.
  const callStyle = { casual: presentation === "call", name: profile?.name ?? undefined };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Time left unsaved when the student leaves. On the video call (user
  // request) it counts toward today's minutes once the student has spoken,
  // even when the call ends before the report; AI Speaking keeps it as
  // practice telemetry until the session is finished.
  const spokeOnCall =
    presentation === "call" && messages.some((message) => message.role === "user");
  useLogTimeOnExit({
    timer: minutesSpent,
    profile: presentation === "call" && !spokeOnCall ? null : profile,
    type: presentation === "call" ? "video_call" : "conversation_practice",
    title: presentation === "call" ? "Video call with EVO" : "Speaking practice",
  });
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [report, setReport] = useState<ConversationReport | null>(null);
  const [finishing, setFinishing] = useState(false);
  const talkingOperationKey = useRef(crypto.randomUUID());
  const finishTalking = useServerFn(finishTalkingLegacy);
  const mounted = useRef(true);
  const topicOffset = useRef(0);
  const speechQueue = useRef<Promise<void>>(Promise.resolve());
  const replyAbort = useRef<AbortController | null>(null);
  // Set synchronously: a second tap before React re-renders cannot send twice.
  const answering = useRef(false);
  // Stages of the current answer, saved once EVO's first sound plays.
  const turnMarks = useRef<TurnMarks | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving the screen really cancels the reply so the AI slot is freed.
      replyAbort.current?.abort();
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
    const businessPlay = findBusinessRolePlay(business);
    if (businessPlay) startRolePlay(businessPlay);
    else if (isWeatherCondition(weather)) startRolePlay(weatherRolePlay(weather));
    else if (goal) {
      setVoiceState("thinking");
      // A goal that cannot be read (removed, another student's) falls back to a free chat.
      void loadGoalRolePlay(goal).then((play) => {
        if (!mounted.current) return;
        if (play) startRolePlay(play);
        else void start(0);
      });
    } else void start(0);
    // Runs once per screen: `start` is recreated on every render, and the
    // `started` ref already guarantees a single opener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonTopic]);

  async function playResponse(text: string) {
    setVoiceState("speaking");
    try {
      await speakEnglish(text, { cache: "persistent" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The response could not be played.");
    } finally {
      if (mounted.current) setVoiceState((current) => (current === "speaking" ? "idle" : current));
    }
  }

  /** Saves how long the student waited for EVO's first sound (Admin metric). */
  function recordFirstSound() {
    const marks = turnMarks.current;
    if (!marks || marks.firstAudioAt !== undefined) return;
    marks.firstAudioAt = performance.now();
    const row = turnTimingRow(marks);
    // Before migration 0050 the table does not exist; the insert just fails.
    if (row) void supabase.from("speaking_turn_timings" as never).insert(row as never);
  }

  function queueSpeech(text: string) {
    // The audio starts generating now, while earlier blocks are still playing,
    // instead of only when its turn to play comes.
    prepareSpeech(text, { cache: "persistent" });
    speechQueue.current = speechQueue.current
      .then(async () => {
        if (!mounted.current) return;
        setVoiceState("speaking");
        // Persistent cache: the same sentence is never generated twice, even after a reload.
        await speakEnglish(text, { cache: "persistent", onStart: recordFirstSound });
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "The response could not be played.");
      });
  }

  /** Starts a real-life role-play; its fixed opener plays right away. */
  function startRolePlay(play: RolePlay) {
    cancelVoiceRecording();
    stopSpeaking();
    setRolePlay(play);
    setScenario(play.scenario);
    setReport(null);
    setMessages([{ role: "assistant", content: play.opener }]);
    void playResponse(play.opener);
  }

  /** Starts a conversation with a subject picked by the AI. `offset` asks for another subject. */
  async function start(offset = 0) {
    const selected = scenarioOfTheDay(offset);
    stopSpeaking();
    setRolePlay(null);
    setScenario(selected.id);
    setReport(null);
    setMessages([]);
    setVoiceState("thinking");
    const used = loadUsedOpeners();
    let opener: string;
    let openerTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The server aborts Gemini after 20 s; this guard only frees the screen
      // if the answer never comes back at all.
      const deadline = new Promise<never>((_, reject) => {
        openerTimer = setTimeout(() => reject(new Error("opener_timeout")), 22_000);
      });
      const text = await Promise.race([
        // Queued behind any AI Speaking request still running in this tab
        // (e.g. the opener of the screen just left), so the server never
        // refuses it as "already running".
        talkingTurn(() =>
          aiChat({
            data: {
              messages: coachOpenerMessages(
                selected.id,
                cefrLevel,
                profile?.goal ?? "conversation",
                buildStudyContext(snapshot),
                used,
                callStyle,
              ),
              jsonMode: false,
              operation: "talking",
            },
          }),
        ),
        deadline,
      ]);
      opener = text.trim();
      if (!opener) throw new Error("empty opener");
    } catch (error) {
      if (
        mounted.current &&
        error instanceof Error &&
        (error.message === "opener_timeout" || error.message === COACH_TIMEOUT_MESSAGE)
      )
        toast.error(COACH_TIMEOUT_MESSAGE);
      const fresh = selected.fallbackOpeners.filter((line) => !used.includes(line));
      const pool = fresh.length ? fresh : selected.fallbackOpeners;
      opener =
        pool[Math.floor(Math.random() * pool.length)] ??
        "Hi! Let's chat in English. How are you today?";
    } finally {
      clearTimeout(openerTimer);
    }
    rememberOpener(opener);
    if (!mounted.current) return;
    setMessages([{ role: "assistant", content: opener }]);
    await playResponse(opener);
  }

  async function toggleRecording() {
    if (
      !scenario ||
      voiceState === "thinking" ||
      voiceState === "sending" ||
      voiceState === "transcribing"
    )
      return;
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

    if (answering.current) return;
    answering.current = true;
    setVoiceState("sending");
    const marks: TurnMarks = { stoppedAt: performance.now() };
    turnMarks.current = marks;
    try {
      const audio = await stopVoiceRecording();
      if (mounted.current) setVoiceState("transcribing");
      const text = await transcribeAudio(audio);
      marks.transcribedAt = performance.now();
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setVoiceState("thinking");
      let streamedReply = "";
      let phraseBuffer = "";
      let firstBlockQueued = false;
      const replyIndex = next.length;
      setMessages([...next, { role: "assistant", content: "" }]);
      replyAbort.current?.abort();
      const abort = new AbortController();
      replyAbort.current = abort;
      const raw = await talkingTurn(
        () =>
          streamCoachReply(
            coachReplyMessages(
              scenario,
              cefrLevel,
              profile?.goal ?? "conversation",
              buildStudyContext(snapshot),
              next.slice(-8),
              rolePlay?.role,
              callStyle,
            ),
            (delta) => {
              marks.firstTextAt ??= performance.now();
              streamedReply += delta;
              phraseBuffer += delta;
              if (mounted.current) {
                setMessages((current) =>
                  current.map((message, index) =>
                    index === replyIndex ? { ...message, content: streamedReply } : message,
                  ),
                );
              }
              // The first sentence is spoken as soon as it is written; after
              // that, short phrases are merged into one audio request.
              const split = takeStreamBlocks(phraseBuffer, firstBlockQueued);
              phraseBuffer = split.rest;
              if (split.blocks.length) firstBlockQueued = true;
              split.blocks.forEach(queueSpeech);
            },
            abort.signal,
          ),
        { signal: abort.signal },
      );
      const reply = raw.trim();
      if (phraseBuffer.trim()) queueSpeech(phraseBuffer.trim());

      const updated: ChatMessage[] = [...next, { role: "assistant", content: reply }];
      setMessages(updated);
      await speechQueue.current;
      if (mounted.current) setVoiceState("idle");
    } catch (error) {
      if (!mounted.current) return;
      setVoiceState("idle");
      // Drop the empty placeholder left by a reply that never arrived.
      setMessages((current) =>
        current.at(-1)?.role === "assistant" && !current.at(-1)?.content
          ? current.slice(0, -1)
          : current,
      );
      toast.error(
        error instanceof Error ? error.message : "AI Speaking could not hear or answer you.",
      );
    } finally {
      answering.current = false;
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
        toast.error("We could not score this session, so your Speaking progress was not changed.");
      await refreshAfterActivity(queryClient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate your report.");
    } finally {
      setFinishing(false);
    }
  }

  const userAnswers = messages.filter((message) => message.role === "user").length;
  const lastAssistantIndex = messages.reduce(
    (last, message, index) => (message.role === "assistant" ? index : last),
    -1,
  );
  const hasEnoughAnswers = userAnswers >= 3;
  const isProcessingAnswer =
    voiceState === "recording" ||
    voiceState === "sending" ||
    voiceState === "transcribing" ||
    voiceState === "thinking";
  const canFinish = hasEnoughAnswers && !isProcessingAnswer && !finishing;
  const statusText =
    voiceState === "recording"
      ? "Listening… tap again when you finish"
      : voiceState === "sending"
        ? "Sending your recording…"
        : voiceState === "transcribing"
          ? "Understanding your English…"
          : voiceState === "thinking"
            ? "Preparing a reply…"
            : voiceState === "speaking"
              ? "EVO is speaking… tap the microphone to answer now"
              : "Tap the microphone and speak in English";

  if (presentation === "call") {
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    return (
      <VideoCallStage
        preparing={!scenario}
        topicLabel={rolePlay ? rolePlay.label : "Casual chat"}
        lastAssistantText={lastAssistant?.content ?? ""}
        voiceState={voiceState}
        statusText={statusText}
        userAnswers={userAnswers}
        canFinish={canFinish}
        finishing={finishing}
        report={report ? <SpeakingReport report={report} /> : null}
        onToggleMic={() => void toggleRecording()}
        onReplay={() => {
          if (lastAssistant) void playResponse(lastAssistant.content);
        }}
        onFinish={() => void finish()}
      />
    );
  }

  if (!scenario) {
    return (
      <>
        <div className="flex items-center gap-3">
          <EvoAvatar className="size-11 sm:size-12" />
          <h1 className="text-3xl font-bold">AI Speaking</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Starting a new conversation… the AI is choosing today's subject.
        </p>
        <div className="mt-7 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> <Shimmer>Preparing your topic…</Shimmer>
        </div>
      </>
    );
  }

  const newTopic = () => {
    cancelVoiceRecording();
    topicOffset.current += 1;
    void start(topicOffset.current);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <EvoAvatar className="size-11 sm:size-12" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">AI Speaking</h1>
          <p className="max-w-full text-sm leading-snug text-muted-foreground">
            {rolePlay ? (
              <>
                <span>Real situation</span> · <span>{rolePlay.label}</span>
              </>
            ) : (
              "Voice conversation · the AI chooses today's subject"
            )}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="size-11 shrink-0 gap-1.5 p-0 sm:h-9 sm:w-auto sm:px-3"
        >
          <Link to="/call">
            <Video className="size-4" />
            {/* Icon only on phones: the bottom navigation already names Video call. */}
            <span className="sr-only sm:not-sr-only">Video call with EVO</span>
          </Link>
        </Button>
      </div>

      {userAnswers === 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-2.5 text-sm sm:flex sm:items-center sm:gap-3 sm:space-y-0">
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground">Don't like today's topic?</span>
            <Button size="sm" variant="outline" disabled={isProcessingAnswer} onClick={newTopic}>
              New topic
            </Button>
          </div>
          {/* Real situations: one compact row that scrolls sideways on small screens. */}
          <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
            <span className="shrink-0 text-xs text-muted-foreground">
              Or practise a real situation:
            </span>
            {rolePlaysForGoal(profile?.goal).map((play, index) => (
              <button
                key={play.id}
                type="button"
                disabled={isProcessingAnswer}
                onClick={() => startRolePlay(play)}
                title={index === 0 ? "Suggested for your study plan goal" : undefined}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  rolePlay?.id === play.id
                    ? "border-brand-green bg-brand-green/15 text-brand-green"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                {index === 0 && <Star className="size-3 fill-current text-amber-400" />}
                {play.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="card-soft flex h-[min(50dvh,38rem)] min-h-[20rem] flex-col overflow-hidden sm:min-h-[22rem]">
        <Conversation>
          <ConversationContent className="gap-5 p-5">
            {messages.map((message, index) => (
              <Message key={`${message.role}-${index}`} from={message.role}>
                <MessageContent
                  className={
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : index === lastAssistantIndex
                        ? "text-base leading-relaxed sm:text-lg"
                        : undefined
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
              title="Replay"
              className={
                voiceState === "speaking"
                  ? "bg-brand-green/15 text-brand-green hover:bg-brand-green/25"
                  : ""
              }
            >
              <Volume2 />
            </Button>

            <Button
              size="icon"
              aria-label={voiceState === "recording" ? "Stop recording" : "Start recording"}
              onClick={toggleRecording}
              disabled={
                voiceState === "thinking" ||
                voiceState === "sending" ||
                voiceState === "transcribing"
              }
              style={{ width: "4.8rem", height: "4.8rem" }}
              className={`rounded-full ${
                voiceState === "recording"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : voiceState === "speaking"
                    ? "bg-brand-green/20 text-brand-green ring-2 ring-brand-green/40 hover:bg-brand-green/30"
                    : ""
              }`}
            >
              {voiceState === "recording" ? (
                <MicOff className="size-[2.1rem]" />
              ) : voiceState === "thinking" ||
                voiceState === "sending" ||
                voiceState === "transcribing" ? (
                <Loader2 className="size-[2.1rem] animate-spin" />
              ) : (
                <Mic className="size-[2.1rem]" />
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
          variant={hasEnoughAnswers ? "default" : "outline"}
          onClick={finish}
          disabled={!canFinish}
        >
          {finishing ? <Loader2 className="animate-spin" /> : <Sparkles />}{" "}
          <span>Finish session and get my report</span>
        </Button>
        <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full ${
                i < Math.min(userAnswers, 3) ? "bg-brand-green" : "bg-muted"
              }`}
            />
          ))}
        </div>
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

      {report && <SpeakingReport report={report} />}
    </div>
  );
}

/** The goal and today's step (students read their own rows), as a conversation for EVO. */
async function loadGoalRolePlay(goalId: string) {
  try {
    const [{ data: goalRow }, { data: stepRow }] = await Promise.all([
      supabase
        .from("plus_goals")
        .select("id, title")
        .eq("id", goalId)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("plus_goal_steps")
        .select("text")
        .eq("goal_id", goalId)
        .eq("day", studyToday())
        .maybeSingle(),
    ]);
    if (!goalRow) return null;
    return goalRolePlay({ id: goalRow.id, title: goalRow.title, step: stepRow?.text ?? null });
  } catch {
    return null;
  }
}
