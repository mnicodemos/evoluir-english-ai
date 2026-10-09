import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { VoiceCoach } from "@/components/VoiceCoach";
import { findBusinessRolePlay } from "@/lib/businessCourse";
import { isWeatherCondition } from "@/lib/weatherTalk";

export const Route = createFileRoute("/_authenticated/coach")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { lesson?: string; weather?: string; business?: string } => ({
    ...(typeof search["lesson"] === "string" ? { lesson: search["lesson"] } : {}),
    ...(isWeatherCondition(search["weather"]) ? { weather: search["weather"] } : {}),
    // A Business English situation (businessCourse.ts) EVO starts at once.
    ...(typeof search["business"] === "string" && findBusinessRolePlay(search["business"])
      ? { business: search["business"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "AI Speaking - Evoluir+ English AI" },
      {
        name: "description",
        content: "Practice everyday, professional and travel English with your AI teacher.",
      },
      { property: "og:title", content: "AI Speaking - Evoluir+ English AI" },
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
  const { lesson: lessonTopic, weather, business } = Route.useSearch();
  return (
    <AppShell mobileOneScreen>
      <VoiceCoach lessonTopic={lessonTopic} weather={weather} business={business} />
    </AppShell>
  );
}
