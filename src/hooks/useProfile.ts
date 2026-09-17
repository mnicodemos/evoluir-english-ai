import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { studyToday } from "@/lib/today";

/**
 * Streak as it should be shown today: it only stays alive when the last study day
 * was today or yesterday (Brazilian time). Otherwise the streak is broken.
 */
export function effectiveStreak(profile: { streak_days: number; last_activity_date: string | null }) {
  if (!profile.last_activity_date) return 0;
  const today = studyToday();
  const yesterday = studyToday(new Date(Date.now() - 86400000));
  if (profile.last_activity_date === today || profile.last_activity_date === yesterday) return profile.streak_days;
  return 0;
}

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  level: string;
  max_level: string;
  goal: string;
  daily_minutes: number;
  streak_days: number;
  last_activity_date: string | null;
  onboarding_completed: boolean;
  plan: string;
  plan_interval: string | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      if (data) return data as Profile;

      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: user.id, email: user.email ?? null, name: user.email?.split("@")[0] ?? "" })
        .select()
        .single();
      if (insertError) throw insertError;
      return created as Profile;
    },
  });
}

/** Records an activity, refreshes the streak and stores a progress snapshot. */
export async function logActivity(params: {
  userId: string;
  type: string;
  title: string;
  minutes: number;
  score?: number | null;
  scores?: { speaking?: number; grammar?: number; listening?: number; reading?: number; vocabulary?: number; writing?: number };
  currentStreak: number;
  lastDate: string | null;
}) {
  const today = studyToday();
  const yesterday = studyToday(new Date(Date.now() - 86400000));

  const { data: levelRow } = await supabase
    .from("profiles")
    .select("level, streak_days, last_activity_date")
    .eq("id", params.userId)
    .maybeSingle();
  const level = levelRow?.level ?? "b1";

  await supabase.from("activities").insert({
    user_id: params.userId,
    activity_type: params.type,
    title: params.title,
    duration_minutes: params.minutes,
    score: params.score ?? null,
    level,
  });

  // Read the freshest streak straight from the profile: the caller's copy can be
  // stale (cached query), which used to skip a day and undercount the streak.
  const lastDate = levelRow?.last_activity_date ?? params.lastDate;
  if (lastDate !== today) {
    const currentStreak = levelRow?.streak_days ?? params.currentStreak;
    const streak = lastDate === yesterday ? currentStreak + 1 : 1;
    await supabase
      .from("profiles")
      .update({ streak_days: streak, last_activity_date: today })
      .eq("id", params.userId);
  }

  if (params.scores) {
    const { data: last } = await supabase
      .from("progress")
      .select("*")
      .eq("user_id", params.userId)
      .eq("level", level)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Keep the best score ever reached per skill — redoing an activity never lowers the %.
    const blend = (prev: number, next?: number) =>
      next === undefined ? prev : Math.max(prev, Math.round(next));

    await supabase.from("progress").insert({
      user_id: params.userId,
      level,
      speaking_score: blend(last?.speaking_score ?? 0, params.scores.speaking),
      reading_score: blend(last?.reading_score ?? 0, params.scores.reading),
      grammar_score: blend(last?.grammar_score ?? 0, params.scores.grammar),
      listening_score: blend(last?.listening_score ?? 0, params.scores.listening),
      vocabulary_score: blend(last?.vocabulary_score ?? 0, params.scores.vocabulary),
      writing_score: blend(last?.writing_score ?? 0, params.scores.writing),
    });
  }
}
