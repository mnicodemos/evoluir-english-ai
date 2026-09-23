import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { EvoGuide } from "@/components/EvoGuide";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { NEXT_STEP_SKILL_TEXT } from "@/lib/pedagogy/nextStep";
import {
  PROOF_OF_PROGRESS_KIND_TEXT,
  PROOF_OF_PROGRESS_NO_BASE_TEXT,
  type ProofOfProgressHighlight,
  type ProofOfProgressKind,
} from "@/lib/pedagogy/proofOfProgress";
import { loadProofOfProgress } from "@/lib/pedagogy/proofOfProgress.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/** The three student-facing groups, in a fixed order. */
const GROUPS: { title: string; kinds: readonly ProofOfProgressKind[] }[] = [
  { title: "You transferred", kinds: ["TRANSFER"] },
  { title: "You consolidated", kinds: ["CONSOLIDATION"] },
  { title: "You evolved in", kinds: ["OBSERVABLE_GROWTH", "NEW_EVIDENCE"] },
];

/**
 * "Evidence of your evolution" — concrete, observable facts derived server-side
 * from existing evidence. No percentage, no progress score, no AI: when there is
 * nothing comparable, the section says so instead of inventing progress.
 */
export function ProofOfProgressCard() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["proof-of-progress", profile?.level ?? null],
    queryFn: () => loadProofOfProgress({ data: undefined }),
    enabled: !!profile,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="card-soft mt-5 p-5" aria-busy="true" aria-label={t("Your evolution")}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-3 h-4 w-64" />
      </section>
    );
  }

  // An error here must never break the page: the section simply steps out.
  if (isError || !data) return null;
  if (data.highlights.length === 0 && data.keepPractising.length === 0) return null;

  const skillLabel = (skill: string) => t(NEXT_STEP_SKILL_TEXT[skill] ?? skill);
  const groups = GROUPS.map((group) => ({
    title: group.title,
    items: data.highlights.filter((item) => group.kinds.includes(item.kind)),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="card-soft mt-5 p-5" aria-labelledby="proof-of-progress-title">
      <EvoGuide
        title={
          data.highlights.length > 0
            ? t("We already have evidence of development in your skills.")
            : t("We are still building evidence about your evolution.")
        }
        imageSize="lesson"
      />

      <div className="mt-5 flex min-w-0 items-start gap-4 border-t border-border pt-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
          <Sparkles className="size-5 text-[oklch(0.55_0.14_158)]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="proof-of-progress-title" className="text-lg font-semibold">
            {t("Your evolution")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("What your practice already shows")}</p>

          {data.levelChange && (
            <p className="mt-2 break-words text-sm font-medium">
              {t("Level officially updated")}: {data.levelChange.from} → {data.levelChange.to}
            </p>
          )}

          {groups.map((group) => (
            <div key={group.title} className="mt-4">
              <h3 className="text-sm font-semibold">{t(group.title)}</h3>
              <ul className="mt-2 grid gap-3">
                {group.items.map((item: ProofOfProgressHighlight) => (
                  <li key={item.skill} className="min-w-0">
                    <p className="break-words font-medium">{skillLabel(item.skill)}</p>
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">
                      {t(PROOF_OF_PROGRESS_KIND_TEXT[item.kind])}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {data.keepPractising.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">{t("Keep practising")}</h3>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {t(PROOF_OF_PROGRESS_NO_BASE_TEXT)}
              </p>
              <p className="mt-1 break-words text-sm">
                {data.keepPractising.map(skillLabel).join(" · ")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
