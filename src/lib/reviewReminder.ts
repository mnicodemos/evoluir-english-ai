import { DAILY_REVIEW_LIMIT, isDue, type ReviewState } from "@/lib/vocabularyReview";

/**
 * Due vocabulary reviews, capped at what the Vocabulary page brings back in a
 * day (DAILY_REVIEW_LIMIT), so a reminder never promises more than it shows.
 */
export function shownReviewCount(due: number): number {
  return Math.max(0, Math.min(due, DAILY_REVIEW_LIMIT));
}

export function countDueReviews(states: ReviewState[], now = new Date()): number {
  return shownReviewCount(states.filter((state) => isDue(state, now)).length);
}

/** "1 palavra para revisar" / "3 palavras para revisar" (push copy is Portuguese). */
export function reviewWordsPt(count: number): string {
  return count === 1 ? "1 palavra para revisar" : `${count} palavras para revisar`;
}

/** The study plan's day to do now, as the pushes mention it. */
export type PlanTaskForPush = { title: string; status: "today" | "missed" } | null;

function planLinePt(task: PlanTaskForPush): string {
  if (!task) return "";
  return task.status === "missed"
    ? `📅 Recupere no plano: ${task.title}`
    : `📅 Hoje no plano: ${task.title}`;
}

/** Morning word-of-the-day body, with the plan's day and due reviews when there are any. */
export function wordOfDayBody(
  base: string,
  due: number,
  extra = "",
  planTask: PlanTaskForPush = null,
): string {
  const shown = shownReviewCount(due);
  const plan = planTask ? ` · ${planLinePt(planTask)}` : "";
  const reviews = shown ? ` · 🔁 ${reviewWordsPt(shown)} hoje` : "";
  return `${base}${plan}${reviews}${extra}`.slice(0, 280);
}

/** Evening reminder for a student who has not met today's goal yet. */
export function studyReminder(
  due: number,
  planTask: PlanTaskForPush = null,
): { title: string; body: string; path: string } {
  const shown = shownReviewCount(due);
  if (planTask) {
    const reviews = shown ? ` Depois, ${reviewWordsPt(shown)}.` : "";
    return {
      title: "Hora de estudar inglês 📚",
      body: `${planLinePt(planTask)}. Faça agora e mantenha seu Streak!${reviews}`.slice(0, 280),
      path: "/study-plan",
    };
  }
  if (!shown) {
    return {
      title: "Hora de estudar inglês 📚",
      body: "Você ainda não completou sua meta de hoje. Faça uma atividade rápida e mantenha seu Streak!",
      path: "/dashboard",
    };
  }
  return {
    title: "Hora de estudar inglês 📚",
    body: `Você tem ${reviewWordsPt(shown)}. Uma revisão rápida ajuda a cumprir a meta de hoje e manter seu Streak!`,
    path: "/vocabulary",
  };
}

/** Evening reminder line for today's goal steps still open; they also close the study day. */
export function goalStepsLinePt(open: number): string {
  if (open <= 0) return "";
  return open === 1
    ? "🎯 Falta 1 passo das suas metas, que também fecha o dia de estudo."
    : `🎯 Faltam ${open} passos das suas metas, que também fecham o dia de estudo.`;
}

/**
 * When the Final Test opened: the completion time of the lesson that reached
 * the required count (completions in any order); null when not reached.
 */
export function finalTestUnlockedAt(completedAt: readonly string[], required: number) {
  const times = completedAt
    .map((iso) => Date.parse(iso))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return required > 0 && times.length >= required ? times[required - 1]! : null;
}

/** The one push the morning after the Final Test opens (user request, 2026-10-23). */
export function finalTestUnlockedPush(
  level: string,
  required: number,
): { title: string; body: string; path: string } {
  const current = level.toUpperCase();
  const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const next = order[order.indexOf(current) + 1];
  return {
    title: "🏁 Prova Final liberada!",
    body: next
      ? `Você concluiu ${required} lições do ${current}. Faça a Prova Final e suba para o ${next}!`
      : `Você concluiu ${required} lições do ${current}. Faça a Prova Final e conclua o nível!`,
    path: "/learning",
  };
}

/** Evening reminder line while today's daily reading is still open (user request). */
export const READING_REMINDER_LINE_PT = "📖 A leitura do dia está esperando por você.";

/**
 * Life+ AI's open tasks of the day (user request: notify them), as a line of
 * the morning push and the evening reminder.
 */
export function lifeTasksLinePt(open: number): string {
  if (open <= 0) return "";
  return open === 1
    ? "📝 1 tarefa do Life+ AI para hoje"
    : `📝 ${open} tarefas do Life+ AI para hoje`;
}

/** Evening push for a student whose study day is done but whose Life+ AI tasks are still open. */
export function lifeTasksReminder(open: number): { title: string; body: string; path: string } {
  return {
    title: "Suas tarefas de hoje 📝",
    body:
      open === 1
        ? "Ainda falta 1 tarefa do Life+ AI para hoje. Marque quando concluir!"
        : `Ainda faltam ${open} tarefas do Life+ AI para hoje. Marque quando concluir!`,
    path: "/life",
  };
}
