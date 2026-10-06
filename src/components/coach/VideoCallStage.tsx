import { useNavigate } from "@tanstack/react-router";
import {
  Captions,
  CaptionsOff,
  Languages,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import evoVideoCall from "@/assets/evo-video-call.jpg";
import { aiChat } from "@/lib/aiChat.functions";
import { cn } from "@/lib/utils";

export type CallVoiceState =
  "idle" | "recording" | "sending" | "transcribing" | "thinking" | "speaking";

/**
 * "Video call with EVO" — the AI Speaking conversation presented as a call:
 * EVO on stage, live captions, a call timer and call controls. All the
 * conversation logic (topic, voice, transcription, report) stays in
 * VoiceCoach; this component only presents it. The optional camera preview
 * is local: the image never leaves the device.
 */
export function VideoCallStage({
  preparing,
  topicLabel,
  lastAssistantText,
  voiceState,
  statusText,
  userAnswers,
  canFinish,
  finishing,
  report,
  onToggleMic,
  onReplay,
  onFinish,
}: {
  preparing: boolean;
  topicLabel: string;
  lastAssistantText: string;
  voiceState: CallVoiceState;
  statusText: string;
  userAnswers: number;
  canFinish: boolean;
  finishing: boolean;
  report: ReactNode | null;
  onToggleMic: () => void;
  onReplay: () => void;
  onFinish: () => void;
}) {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [translation, setTranslation] = useState<{ source: string; text: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Call timer.
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Local camera preview only: never recorded, never sent.
  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        toast.error("The camera could not start. The call continues with audio only.");
        setCameraOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cameraOn]);
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const translate = async () => {
    if (!lastAssistantText || translating) return;
    if (translation?.source === lastAssistantText) {
      setTranslation(null);
      return;
    }
    setTranslating(true);
    try {
      const text = await aiChat({
        data: {
          messages: [
            {
              role: "system",
              content:
                "Translate the English text into natural Brazilian Portuguese. Reply with the translation only.",
            },
            { role: "user", content: lastAssistantText },
          ],
          jsonMode: false,
          operation: "chat",
        },
      });
      setTranslation({ source: lastAssistantText, text: text.trim() });
    } catch {
      toast.error("The translation is not available right now.");
    } finally {
      setTranslating(false);
    }
  };

  const busy =
    voiceState === "sending" || voiceState === "transcribing" || voiceState === "thinking";
  const speaking = voiceState === "speaking";
  const recording = voiceState === "recording";
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const showTranslation = translation?.source === lastAssistantText ? translation.text : null;

  const endCall = () => {
    if (canFinish) onFinish();
    else void navigate({ to: "/coach" });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[radial-gradient(circle_at_50%_30%,oklch(0.24_0.05_190),oklch(0.11_0.02_240)_70%)] text-white"
      role="dialog"
      aria-label="Video call with EVO"
    >
      {/* Top bar: who, what, how long. */}
      <header className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div className="min-w-0">
          <p className="font-display text-base font-bold sm:text-lg">EVO · English teacher</p>
          <p className="truncate text-xs text-white/65 sm:text-sm">{topicLabel}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums">
          <span className="size-2 rounded-full bg-red-500" aria-hidden="true" />
          {clock}
        </span>
      </header>

      {/* Stage: EVO with a ring that reacts to the conversation. */}
      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 sm:gap-5">
        {/* EVO's video tile: a green frame lights up while she speaks. */}
        <div
          className={cn(
            "relative aspect-[1057/1008] w-[min(88vw,calc(100dvh-25rem),32rem)] overflow-hidden rounded-3xl shadow-2xl ring-2 ring-white/10 transition-shadow duration-500",
            speaking && "shadow-[0_0_0_4px_var(--brand-green),0_0_48px_-6px_var(--brand-green)]",
            busy && "animate-pulse",
          )}
        >
          <img
            src={evoVideoCall}
            alt="EVO, your English teacher, on the call"
            className="size-full object-cover object-top"
          />
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
            {speaking ? (
              <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
                <span className="w-0.5 animate-[pulse_0.8s_ease-in-out_infinite] rounded-full bg-brand-green [height:60%]" />
                <span className="w-0.5 animate-[pulse_0.8s_ease-in-out_0.2s_infinite] rounded-full bg-brand-green [height:100%]" />
                <span className="w-0.5 animate-[pulse_0.8s_ease-in-out_0.4s_infinite] rounded-full bg-brand-green [height:45%]" />
              </span>
            ) : (
              <span className="size-2 rounded-full bg-brand-green" aria-hidden="true" />
            )}
            EVO
          </span>
        </div>

        <p className="min-h-5 text-center text-sm text-white/75" aria-live="polite">
          {preparing ? "EVO is joining the call…" : statusText}
        </p>

        {captionsOn && lastAssistantText && (
          <div className="w-full max-w-2xl rounded-2xl bg-black/35 px-4 py-3 text-center backdrop-blur-sm">
            <p className="text-base leading-relaxed sm:text-lg">{lastAssistantText}</p>
            {showTranslation && (
              <p className="mt-2 border-t border-white/15 pt-2 text-sm text-white/75">
                {showTranslation}
              </p>
            )}
          </div>
        )}

        {/* Local self view (optional). */}
        {cameraOn && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute bottom-3 right-3 h-32 w-24 rounded-xl object-cover shadow-xl ring-2 ring-white/20 [transform:scaleX(-1)] sm:h-40 sm:w-32"
          />
        )}
      </main>

      {/* Report after the call. */}
      {report && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-background/95 p-4 text-foreground sm:p-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Call report</h2>
              <button
                type="button"
                onClick={() => void navigate({ to: "/dashboard" })}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-full hover:bg-accent"
              >
                <X className="size-5" />
              </button>
            </div>
            {report}
          </div>
        </div>
      )}

      {/* Controls. */}
      <footer className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <p className="mb-3 text-center text-xs text-white/60">
          {userAnswers >= 3
            ? "End the call to get your report."
            : `Answer ${3 - Math.min(userAnswers, 3)} more time${3 - userAnswers === 1 ? "" : "s"} to unlock your report.`}
        </p>
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <RoundButton
            label={captionsOn ? "Hide captions" : "Show captions"}
            onClick={() => setCaptionsOn((on) => !on)}
          >
            {captionsOn ? <Captions className="size-5" /> : <CaptionsOff className="size-5" />}
          </RoundButton>
          <RoundButton
            label="Translate the last sentence"
            onClick={() => void translate()}
            disabled={!lastAssistantText || translating || voiceState === "thinking"}
            active={!!showTranslation}
          >
            {translating ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Languages className="size-5" />
            )}
          </RoundButton>
          <button
            type="button"
            onClick={onToggleMic}
            disabled={preparing || busy}
            aria-label={recording ? "Stop and send your answer" : "Speak"}
            className={cn(
              "grid size-[4.5rem] place-items-center rounded-full shadow-xl transition-colors disabled:opacity-60",
              recording
                ? "bg-red-500 text-white hover:bg-red-500/90"
                : "bg-brand-green text-[oklch(0.15_0.03_180)] hover:bg-brand-green/90",
            )}
          >
            {busy ? (
              <Loader2 className="size-8 animate-spin" />
            ) : recording ? (
              <MicOff className="size-8" />
            ) : (
              <Mic className="size-8" />
            )}
          </button>
          <RoundButton
            label="Replay EVO's last sentence"
            onClick={onReplay}
            disabled={!lastAssistantText || busy}
          >
            <Volume2 className="size-5" />
          </RoundButton>
          <RoundButton
            label={cameraOn ? "Turn camera off" : "Turn camera on (only you see it)"}
            onClick={() => setCameraOn((on) => !on)}
            active={cameraOn}
          >
            {cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </RoundButton>
        </div>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={endCall}
            disabled={finishing}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-red-600/90 disabled:opacity-60"
          >
            {finishing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PhoneOff className="size-4" />
            )}
            {canFinish ? "End call and see report" : "End call"}
          </button>
        </div>
      </footer>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-12 place-items-center rounded-full transition-colors disabled:opacity-40",
        active ? "bg-white text-black" : "bg-white/12 text-white hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}
