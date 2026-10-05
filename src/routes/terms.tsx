import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentPage } from "@/components/LegalDocumentPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Evoluir+ English AI" },
      {
        name: "description",
        content: "Termos de Uso do serviço Evoluir+ English AI.",
      },
      { property: "og:title", content: "Termos de Uso — Evoluir+ English AI" },
      {
        property: "og:description",
        content: "Termos de Uso do serviço Evoluir+ English AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalDocumentPage kind="terms" />;
}
