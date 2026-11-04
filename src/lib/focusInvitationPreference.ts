import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const FOCUS_INVITATION_KEY = "evo_focus_invitation_enabled";

function asPreferences(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

/** Defaults to enabled so existing students keep the current EVO experience. */
export async function getFocusInvitationEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("learning_profile")
    .select("learning_preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return asPreferences(data?.learning_preferences)[FOCUS_INVITATION_KEY] !== false;
}

/** Persist this UI preference without overwriting the student's other learning preferences. */
export async function setFocusInvitationEnabled(
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("learning_profile")
    .select("learning_preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const learningPreferences = {
    ...asPreferences(data?.learning_preferences),
    [FOCUS_INVITATION_KEY]: enabled,
  };

  const result = data
    ? await supabase
        .from("learning_profile")
        .update({ learning_preferences: learningPreferences })
        .eq("user_id", userId)
    : await supabase
        .from("learning_profile")
        .insert({ user_id: userId, learning_preferences: learningPreferences });

  if (result.error) throw result.error;
  return enabled;
}
