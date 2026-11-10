import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { getFeatureUsage, getLandingFunnel, getRetention } from "@/lib/admin.functions";
import type { LandingFunnel } from "@/lib/landingStats";
import type { Rate } from "@/lib/retention";
import { useUiLang } from "@/lib/uiLang";

function percent(rate: Rate) {
  return rate.percent === null ? "—" : `${rate.percent}%`;
}

function detail(rate: Rate, pt: boolean) {
  return rate.eligible ? (pt ? `${rate.returned} de ${rate.eligible}` : `${rate.returned} of ${rate.eligible}`) : (pt ? "ainda sem alunos com idade" : "not enough student history yet");
}

function shortDate(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

function rateText(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

/** Public home funnel: anonymous visits and clicks next to signups. */
function LandingFunnelPanel({ pt }: { pt: boolean }) {
  const load = useServerFn(getLandingFunnel);
  const query = useQuery({ queryKey: ["admin", "landing-funnel"], queryFn: () => load() });
  // Never vanish silently: say when it is loading or why it failed.
  if (query.isPending) {
    return (
      <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
        {pt ? "Funil da página inicial: carregando…" : "Homepage funnel: loading…"}
      </p>
    );
  }
  if (query.isError) {
    return (
      <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
        {pt ? "Funil da página inicial indisponível agora" : "Homepage funnel is currently unavailable"}
        {query.error instanceof Error && query.error.message ? ` (${query.error.message})` : ""}.
      </p>
    );
  }
  if (!query.data) {
    return (
      <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
        {pt ? "Funil da página inicial: aplique a migração 0054 para começar a contar." : "Homepage funnel: apply migration 0054 to start tracking."}
      </p>
    );
  }
  const rows: [string, LandingFunnel][] = [
    [pt ? "7 dias" : "7 days", query.data.week],
    [pt ? "30 dias" : "30 days", query.data.month],
  ];
  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">{pt ? "Página inicial" : "Homepage"}</h3>
      <p className="text-xs text-muted-foreground">
        {pt ? 'Visitas e cliques em "Começar" contados sem cookies, ao lado dos cadastros.' : 'Visits and "Get started" clicks tracked without cookies, alongside sign-ups.'}
      </p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 font-medium">{pt ? "Período" : "Period"}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{pt ? "Visitas" : "Visits"}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{pt ? "Cliques" : "Clicks"}</th>
            <th className="py-1.5 text-right font-medium">{pt ? "Cadastros" : "Sign-ups"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, funnel]) => (
            <tr key={label} className="border-b border-border/60">
              <td className="py-2 pr-3 font-medium">{label}</td>
              <td className="py-2 pr-3 text-right">{funnel.visits}</td>
              <td className="py-2 pr-3 text-right">
                {funnel.signupClicks}{" "}
                <span className="text-xs text-muted-foreground">
                  ({rateText(funnel.clickRate)})
                </span>
              </td>
              <td className="py-2 text-right">
                {funnel.signups}{" "}
                <span className="text-xs text-muted-foreground">
                  ({rateText(funnel.signupRate)})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        {pt ? "Entre parênteses: cliques por visita e cadastros por clique." : "In parentheses: clicks per visit and sign-ups per click."}
      </p>
    </section>
  );
}

/**
 * "Uso dos recursos" (featureUsage.ts): students and uses of each feature in
 * 7 and 30 days, admins left out, to decide what to keep and where to invest.
 */
function FeatureUsagePanel({ pt }: { pt: boolean }) {
  const load = useServerFn(getFeatureUsage);
  const query = useQuery({ queryKey: ["admin", "feature-usage"], queryFn: () => load() });
  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="font-display text-sm font-semibold">{pt ? "Uso dos recursos" : "Feature usage"}</h3>
      <p className="text-xs text-muted-foreground">
        {pt ? "Alunos que usaram cada recurso e quantas vezes, nos últimos 7 e 30 dias (admins fora)." : "Students who used each feature and how often in the last 7 and 30 days (admins excluded)."}
      </p>
      {query.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {pt ? "Carregando" : "Loading"}
        </p>
      ) : query.isError ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {pt ? "Não foi possível carregar o uso dos recursos agora." : "Could not load feature usage right now."}
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                <th className="py-2 pr-3">{pt ? "Recurso" : "Feature"}</th>
                <th className="py-2 pr-3 text-right">{pt ? "Alunos 7d" : "Students 7d"}</th>
                <th className="py-2 pr-3 text-right">{pt ? "Usos 7d" : "Uses 7d"}</th>
                <th className="py-2 pr-3 text-right">{pt ? "Alunos 30d" : "Students 30d"}</th>
                <th className="py-2 text-right">{pt ? "Usos 30d" : "Uses 30d"}</th>
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3">
                    {row.label}
                    {!row.available ? (
                      <span className="ml-2 text-[11px] text-warning">{pt ? "migração pendente" : "migration pending"}</span>
                    ) : null}
                  </td>
                  {[row.students7, row.uses7, row.students30, row.uses30].map((value, index) => (
                    <td key={index} className="py-2 pr-3 text-right tabular-nums last:pr-0">
                      {row.available ? value : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Admin "Retention" tab: how many students come back the next day and the
 * following weeks after signing up, overall and per signup week.
 */
export function AdminRetention() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const load = useServerFn(getRetention);
  const query = useQuery({ queryKey: ["admin", "retention"], queryFn: () => load() });

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {pt ? "Carregando" : "Loading"}
      </div>
    );
  }
  if (query.isError) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {pt ? "Não foi possível calcular a retenção agora." : "Could not calculate retention right now."}
      </p>
    );
  }
  const report = query.data;
  const cards = [
    { label: pt ? "Voltam no dia seguinte (D1)" : "Return the next day (D1)", rate: report.d1 },
    { label: pt ? "Voltam na 1ª semana (dias 1–7)" : "Return in week 1 (days 1–7)", rate: report.week1 },
    { label: pt ? "Seguem na semana seguinte (dias 8–14)" : "Return in week 2 (days 8–14)", rate: report.week2 },
    { label: pt ? "Nunca voltaram depois do cadastro" : "Never returned after sign-up", rate: report.neverReturned },
  ];

  return (
    <div className="mt-4 space-y-4">
      <LandingFunnelPanel pt={pt} />
      <FeatureUsagePanel pt={pt} />
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: pt ? "Ativos hoje" : "Active today", value: report.activeToday },
          { label: pt ? "Ativos em 7 dias" : "Active in 7 days", value: report.active7 },
          { label: pt ? "Ativos em 30 dias" : "Active in 30 days", value: report.active30 },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border p-3">
            <p className="font-display text-xl font-bold">{item.value}</p>
            <p className="text-[11px] text-muted-foreground">
              {item.label} · de {report.students}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{percent(card.rate)}</p>
            <p className="text-[11px] text-muted-foreground">{detail(card.rate, pt)}</p>
          </div>
        ))}
      </div>

      {report.firstConversation && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{pt ? "Falaram com a EVO no 1º dia" : "Spoke with EVO on day 1"}</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {percent(report.firstConversation.firstDay)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {detail(report.firstConversation.firstDay, pt)}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{pt ? "Do cadastro à 1ª resposta falada" : "Sign-up to first spoken response"}</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {report.firstConversation.medianMinutes === null
                ? "—"
                : `${report.firstConversation.medianMinutes} min`}
            </p>
            <p className="text-[11px] text-muted-foreground">{pt ? "mediana · meta: poucos minutos" : "median · target: a few minutes"}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
              <th className="py-2 pr-3">{pt ? "Cadastro na semana de" : "Sign-up week"}</th>
              <th className="py-2 pr-3 text-right">{pt ? "Alunos" : "Students"}</th>
              <th className="py-2 pr-3 text-right">D1</th>
              <th className="py-2 pr-3 text-right">{pt ? "1ª semana" : "Week 1"}</th>
              <th className="py-2 text-right">{pt ? "Semana seguinte" : "Following week"}</th>
            </tr>
          </thead>
          <tbody>
            {report.cohorts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-muted-foreground">
                  {pt ? "Nenhum cadastro nas últimas 8 semanas." : "No sign-ups in the last 8 weeks."}
                </td>
              </tr>
            ) : (
              report.cohorts.map((cohort) => (
                <tr key={cohort.weekStart} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{shortDate(cohort.weekStart)}</td>
                  <td className="py-2 pr-3 text-right">{cohort.size}</td>
                  <td className="py-2 pr-3 text-right">{percent(cohort.d1)}</td>
                  <td className="py-2 pr-3 text-right">{percent(cohort.week1)}</td>
                  <td className="py-2 text-right">{percent(cohort.week2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {pt ? 'Conta como ativo quem fez algo no dia (atividade, lição concluída ou resposta da IA), no horário de São Paulo. Administradores ficam de fora. "—" significa que ninguém daquela semana tem idade suficiente para a medida.' : 'A student is considered active if they did something that day (activity, completed lesson, or AI response), using São Paulo time. Administrators are excluded. "—" means the cohort is not old enough for that measurement.'}
      </p>
    </div>
  );
}
