import type { NextStepQuickWin } from "@/lib/pedagogy/nextStep";
import { studyDayNumber } from "@/lib/pedagogy/conversationChallenge";

/**
 * "Watch an extra video" joins the Quick Win's rotation (owner request,
 * 2026-10-31): on one study day in three the Quick Win invites a Premium
 * student to one of their level's extra videos (/learning/videos) instead of
 * the skill's five-minute practice, as long as the level has a video and none
 * was played on this device today. Free students, levels without videos and
 * the other days keep EVO's Quick Win. Pure, so the rotation is tested.
 */
export const EXTRA_VIDEO_QUICK_WIN: NextStepQuickWin = {
  skill: "listening",
  title: "Watch an extra video",
  cta: "Watch an extra video",
  steps: [
    { label: "Pick", text: "Choose a video of your level" },
    { label: "Watch", text: "Follow the main idea" },
    { label: "Note", text: "Write down two new words" },
  ],
  activity: { type: "learning", title: "Extra videos", to: "/learning/videos" },
};

/** One study day in three (days since 1970 ≡ 1 mod 3, São Paulo). */
export function isExtraVideoDay(day: string): boolean {
  return ((studyDayNumber(day) % 3) + 3) % 3 === 1;
}

export function withExtraVideoQuickWin<T extends { quickWin?: NextStepQuickWin | null }>(
  step: T,
  context: { day: string; premium: boolean; levelHasVideos: boolean; watchedToday: boolean },
): T {
  if (!context.premium || !context.levelHasVideos || context.watchedToday) return step;
  if (!isExtraVideoDay(context.day)) return step;
  return { ...step, quickWin: EXTRA_VIDEO_QUICK_WIN };
}

/** The device remembers a video played today, which closes the Quick Win. */
export function extraVideoWatchedKey(userId: string, day: string): string {
  return `evoluir-extra-video-watched:${userId}:${day}`;
}
