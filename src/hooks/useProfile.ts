import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { streakAlive } from "@/lib/streakFreeze";
import { studyToday } from "@/lib/today";

/**
 * Streak as it should be shown today: it stays alive when the last study day
 * was today or yesterday (Brazilian time), or the day before yesterday when
 * this week's streak protection still covers yesterday (credit_study_day
 * applies it on the next study day). Otherwise the streak is broken.
 */
export function effectiveStreak(profile: {
  streak_days: number;
  last_activity_date: string | null;
  streak_freeze_used_on?: string | null;
}) {
  return streakAlive(profile.last_activity_date, profile.streak_freeze_used_on, studyToday()).alive
    ? profile.streak_days
    : 0;
}

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatar_path: string | null;
  level: string;
  max_level: string;
  goal: string;
  daily_minutes: number;
  streak_days: number;
  last_activity_date: string | null;
  streak_freeze_used_on?: string | null;
  league_opt_in?: boolean;
  created_at?: string | null;
  onboarding_completed: boolean;
  plan: string;
  plan_interval: string | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  study_days_per_week: number | null;
  study_focus: string | null;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
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
