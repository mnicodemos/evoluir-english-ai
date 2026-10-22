import { createFileRoute } from "@tanstack/react-router";

import { DecisionsPage } from "@/components/life/Decisions";

export const Route = createFileRoute("/_authenticated/life/decisions")({
  head: () => ({
    meta: [
      { title: "Decisions - Evoluir+ English AI" },
      {
        name: "description",
        content: "Compare your options with clear criteria and decide with more confidence.",
      },
    ],
  }),
  component: DecisionsPage,
});
