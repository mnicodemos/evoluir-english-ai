import { createFileRoute, redirect } from "@tanstack/react-router";

// Life+ AI is one page (user request): the old tab opens its section there.
export const Route = createFileRoute("/_authenticated/life/habits")({
  beforeLoad: () => {
    throw redirect({ to: "/life", hash: "habits" });
  },
});
