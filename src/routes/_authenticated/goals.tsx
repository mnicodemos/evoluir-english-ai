import { createFileRoute, redirect } from "@tanstack/react-router";

// Goals live in the one-page Life+ AI (user request: one page instead of tabs).
export const Route = createFileRoute("/_authenticated/goals")({
  beforeLoad: () => {
    throw redirect({ to: "/life", hash: "goals" });
  },
});
