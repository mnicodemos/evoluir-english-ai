import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentPage } from "@/components/LegalDocumentPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Evoluir+ English AI" },
      {
        name: "description",
        content: "Política de Privacidade do serviço Evoluir+ English AI.",
      },
      { property: "og:title", content: "Política de Privacidade — Evoluir+ English AI" },
      {
        property: "og:description",
        content: "Política de Privacidade do serviço Evoluir+ English AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalDocumentPage kind="privacy" />;
}
