import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { VoiceCoach } from "@/components/VoiceCoach";

export const Route = createFileRoute("/_authenticated/coach")({
  validateSearch: (search: Record<string, unknown>): { lesson?: string } =>
    typeof search["lesson"] === "string" ? { lesson: search["lesson"] as string } : {},
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · AI Speaking" },
      {
        name: "description",
        content: "Practice everyday, professional and travel English with your AI teacher.",
      },
      { property: "og:title", content: "Evoluir+ English AI · AI Speaking" },
      {
        property: "og:description",
        content: "Practice English conversation with instant feedback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Coach,
});

function Coach() {
  const { lesson: lessonTopic } = Route.useSearch();
  return (
    <AppShell mobileOneScreen>
      <VoiceCoach lessonTopic={lessonTopic} />
    </AppShell>
  );
}
