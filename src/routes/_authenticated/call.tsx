import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { VoiceCoach } from "@/components/VoiceCoach";

export const Route = createFileRoute("/_authenticated/call")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Video call with EVO" },
      {
        name: "description",
        content: "A spoken English call with EVO, your AI teacher, with live captions.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Video call with EVO" },
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
  return (
    <AppShell mobileOneScreen>
      <VoiceCoach presentation="call" />
    </AppShell>
  );
}
