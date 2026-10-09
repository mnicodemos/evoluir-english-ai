import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { VoiceCoach } from "@/components/VoiceCoach";
import { findBusinessRolePlay } from "@/lib/businessCourse";

export const Route = createFileRoute("/_authenticated/call")({
  // A Business English situation (businessCourse.ts) EVO plays on the call.
  validateSearch: (search: Record<string, unknown>): { business?: string } =>
    typeof search["business"] === "string" && findBusinessRolePlay(search["business"])
      ? { business: search["business"] }
      : {},
  head: () => ({
    meta: [
      { title: "Video call with EVO - Evoluir+ English AI" },
      {
        name: "description",
        content: "A spoken English call with EVO, your AI teacher, with live captions.",
      },
      { property: "og:title", content: "Video call with EVO - Evoluir+ English AI" },
      {
        property: "og:description",
        content: "Practice English in a call with your AI teacher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Call,
});

// The call screen covers the shell; the shell stays for session and theme.
function Call() {
  const { business } = Route.useSearch();
  return (
    <AppShell mobileOneScreen>
      <VoiceCoach presentation="call" business={business} />
    </AppShell>
  );
}
