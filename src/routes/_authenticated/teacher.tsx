import { createFileRoute } from "@tanstack/react-router";

import { AiTeacherChat } from "@/components/AiTeacherChat";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/teacher")({
  validateSearch: (search: Record<string, unknown>): { lesson?: string } =>
    typeof search["lesson"] === "string" ? { lesson: search["lesson"] as string } : {},
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · AI Teacher" },
      {
        name: "description",
        content:
          "Chat with your personal AI English teacher: explanations, corrections and guided practice at your level.",
      },
      { property: "og:title", content: "Evoluir+ English AI · AI Teacher" },
      {
        property: "og:description",
        content: "Ask questions, practise sentences and get pedagogical feedback from your AI teacher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherPage,
});

function TeacherPage() {
  const { lesson } = Route.useSearch();
  return (
    <AppShell>
      <AiTeacherChat {...(lesson ? { lessonId: lesson } : {})} />
    </AppShell>
  );
}
