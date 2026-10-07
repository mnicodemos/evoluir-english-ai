import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { getRetention } from "@/lib/admin.functions";
import type { Rate } from "@/lib/retention";

function percent(rate: Rate) {
  return rate.percent === null ? "—" : `${rate.percent}%`;
}

function detail(rate: Rate) {
  return rate.eligible ? `${rate.returned} de ${rate.eligible}` : "ainda sem alunos com idade";
}

function shortDate(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/**
 * Admin "Retention" tab: how many students come back the next day and the
 * following weeks after signing up, overall and per signup week.
 */
export function AdminRetention() {
  const load = useServerFn(getRetention);
  const query = useQuery({ queryKey: ["admin", "retention"], queryFn: () => load() });

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando
      </div>
    );
  }
  if (query.isError) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Não foi possível calcular a retenção agora.
      </p>
    );
  }
  const report = query.data;
  const cards = [
    { label: "Voltam no dia seguinte (D1)", rate: report.d1 },
    { label: "Voltam na 1ª semana (dias 1–7)", rate: report.week1 },
    { label: "Seguem na semana seguinte (dias 8–14)", rate: report.week2 },
    { label: "Nunca voltaram depois do cadastro", rate: report.neverReturned },
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Ativos hoje", value: report.activeToday },
          { label: "Ativos em 7 dias", value: report.active7 },
          { label: "Ativos em 30 dias", value: report.active30 },
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
            <p className="text-[11px] text-muted-foreground">{detail(card.rate)}</p>
          </div>
        ))}
      </div>

      {report.firstConversation && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Falaram com a EVO no 1º dia</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {percent(report.firstConversation.firstDay)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {detail(report.firstConversation.firstDay)}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Do cadastro à 1ª resposta falada</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {report.firstConversation.medianMinutes === null
                ? "—"
                : `${report.firstConversation.medianMinutes} min`}
            </p>
            <p className="text-[11px] text-muted-foreground">mediana · meta: poucos minutos</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
              <th className="py-2 pr-3">Cadastro na semana de</th>
              <th className="py-2 pr-3 text-right">Alunos</th>
              <th className="py-2 pr-3 text-right">D1</th>
              <th className="py-2 pr-3 text-right">1ª semana</th>
              <th className="py-2 text-right">Semana seguinte</th>
            </tr>
          </thead>
          <tbody>
            {report.cohorts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-muted-foreground">
                  Nenhum cadastro nas últimas 8 semanas.
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
        Conta como ativo quem fez algo no dia (atividade, lição concluída ou resposta da IA), no
        horário de São Paulo. Administradores ficam de fora. "—" significa que ninguém daquela
        semana tem idade suficiente para a medida.
      </p>
    </div>
  );
}
