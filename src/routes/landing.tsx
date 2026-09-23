import { createFileRoute, redirect } from "@tanstack/react-router";

// The commercial landing now lives at "/". Keep old links working.
export const Route = createFileRoute("/landing")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
