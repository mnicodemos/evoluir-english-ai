import { useQueryClient } from "@tanstack/react-query";

import { Loader2, Mic, MicOff, Sparkles, Star, Volume2 } from "lucide-react";
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
import { speakEnglish, stopSpeaking } from "@/lib/speech";
import { takeSpeechBlocks } from "@/lib/speechChunks";
import { COACH_TIMEOUT_MESSAGE, streamCoachReply } from "@/lib/coach-stream";

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
import { SpeakingReport } from "@/components/coach/SpeakingReport";
import { isWeatherCondition, weatherRolePlay } from "@/lib/weatherTalk";

type ChatMessage = { role: "user" | "assistant"; content: string };
type VoiceState = "idle" | "recording" | "sending" | "transcribing" | "thinking" | "speaking";

export function VoiceCoach({
  lessonTopic,
  weather,
}: {
  lessonTopic?: string | undefined;
  /** Opens a "Weather talk" conversation about today's weather. */
  weather?: string | undefined;
}) {
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
  // The conversation always follows the CEFR level the student actually reached.
  const cefrLevel = getLevelState(profile?.level).current.value;
  const [scenario, setScenario] = useState<string | null>(null);
  // A real-life situation where EVO plays a role (null = free conversation).
  const [rolePlay, setRolePlay] = useState<RolePlay | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [report, setReport] = useState<ConversationReport | null>(null);
  const [finishing, setFinishing] = useState(false);
  const talkingOperationKey = useRef(crypto.randomUUID());
  const finishTalking = useServerFn(finishTalkingLegacy);
  const mounted = useRef(true);
  const topicOffset = useRef(0);
  const speechQueue = useRef<Promise<void>>(Promise.resolve());
  const replyAbort = useRef<AbortController | null>(null);

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
    if (isWeatherCondition(weather)) startRolePlay(weatherRolePlay(weather));
    else void start(0);
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

  function queueSpeech(text: string) {
    speechQueue.current = speechQueue.current
      .then(async () => {
        if (!mounted.current) return;
        setVoiceState("speaking");
        // Persistent cache: the same sentence is never generated twice, even after a reload.
        await speakEnglish(text, { cache: "persistent" });
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
        aiChat({
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
        }),
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

    setVoiceState("sending");
    try {
      const audio = await stopVoiceRecording();
      if (mounted.current) setVoiceState("transcribing");
      const text = await transcribeAudio(audio);
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setVoiceState("thinking");
      let streamedReply = "";
      let phraseBuffer = "";
      const replyIndex = next.length;
      setMessages([...next, { role: "assistant", content: "" }]);
      replyAbort.current?.abort();
      const abort = new AbortController();
      replyAbort.current = abort;
      const raw = await streamCoachReply(
        coachReplyMessages(
          scenario,
          cefrLevel,
          profile?.goal ?? "conversation",
          buildStudyContext(snapshot),
          next.slice(-8),
          rolePlay?.role,
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
          // Short phrases are merged into one audio request; long replies still split.
          const split = takeSpeechBlocks(phraseBuffer);
          phraseBuffer = split.rest;
          split.blocks.forEach(queueSpeech);
        },
        abort.signal,
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

  if (!scenario) {
    return (
      <>
        <h1 className="text-3xl font-bold">AI Speaking</h1>
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

  const newTopic = () => {
    cancelVoiceRecording();
    topicOffset.current += 1;
    void start(topicOffset.current);
  };

  return (
    <div className="space-y-5">
      <div>
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
