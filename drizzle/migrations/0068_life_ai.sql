-- Life AI, phase 1 (user decision, 2026-10-15): the owner's Evoluir+ Life AI
-- module moves into the app with its data in the database (it lived in one
-- browser's localStorage). Goals stay the existing plus_goals (free, they
-- count toward the shared streak) and gain a deadline, a description and
-- milestones; Routine (tasks of a day), Habits (with daily check-ins) and the
-- priority of the day are new and Premium. Students only read their own rows;
-- every write goes through the server (service role), which checks Premium.
-- Idempotent.

ALTER TABLE public.plus_goals ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE public.plus_goals ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.plus_goal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.plus_goals (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  position integer NOT NULL DEFAULT 0,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plus_goal_milestones_goal_idx
  ON public.plus_goal_milestones (goal_id, position);

CREATE TABLE IF NOT EXISTS public.life_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  -- São Paulo calendar day, like the study days.
  day date NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  goal_id uuid REFERENCES public.plus_goals (id) ON DELETE SET NULL,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS life_tasks_user_day_idx ON public.life_tasks (user_id, day);

CREATE TABLE IF NOT EXISTS public.life_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  frequency text NOT NULL DEFAULT 'daily'
    CHECK (frequency IN ('daily', 'weekdays', 'times_per_week')),
  times_per_week integer CHECK (times_per_week BETWEEN 1 AND 7),
  category text CHECK (char_length(category) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS life_habits_user_idx
  ON public.life_habits (user_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.life_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.life_habits (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, day)
);
CREATE INDEX IF NOT EXISTS life_habit_logs_user_day_idx ON public.life_habit_logs (user_id, day);

CREATE TABLE IF NOT EXISTS public.life_priorities (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  day date NOT NULL,
  done_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plus_goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_priorities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.plus_goal_milestones, public.life_tasks, public.life_habits,
  public.life_habit_logs, public.life_priorities FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plus_goal_milestones, public.life_tasks, public.life_habits,
  public.life_habit_logs, public.life_priorities TO authenticated;
GRANT ALL ON public.plus_goal_milestones, public.life_tasks, public.life_habits,
  public.life_habit_logs, public.life_priorities TO service_role;

DROP POLICY IF EXISTS "Students read their own goal milestones" ON public.plus_goal_milestones;
CREATE POLICY "Students read their own goal milestones"
  ON public.plus_goal_milestones FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Students read their own tasks" ON public.life_tasks;
CREATE POLICY "Students read their own tasks"
  ON public.life_tasks FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Students read their own habits" ON public.life_habits;
CREATE POLICY "Students read their own habits"
  ON public.life_habits FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Students read their own habit logs" ON public.life_habit_logs;
CREATE POLICY "Students read their own habit logs"
  ON public.life_habit_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Students read their own priority" ON public.life_priorities;
CREATE POLICY "Students read their own priority"
  ON public.life_priorities FOR SELECT TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
