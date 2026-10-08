import { createFileRoute, redirect } from "@tanstack/react-router";

// The goals area was first published as "Evoluir+ Plus" at /plus.
export const Route = createFileRoute("/_authenticated/plus")({
  beforeLoad: () => {
    throw redirect({ to: "/goals" });
  },
});
