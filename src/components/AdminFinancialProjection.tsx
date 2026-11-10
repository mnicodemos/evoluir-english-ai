import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { useUiLang } from "@/lib/uiLang";

type Inputs = {
  monthlyPrice: number;
  annualPrice: number;
  stripePercent: number;
  stripeFixed: number;
  aiUsdPerStudent: number;
  lovableUsd: number;
  aiSubscriptionsUsd: number;
  domainAnnual: number;
  marketing: number;
  otherCosts: number;
  monthlySubscribers: number;
  annualSubscribers: number;
  freeStudents: number;
};

const DEFAULTS: Inputs = {
  monthlyPrice: 79.9,
  annualPrice: 799.9,
  stripePercent: 3.99,
  stripeFixed: 0.39,
  aiUsdPerStudent: 2.14,
  lovableUsd: 18.87,
  aiSubscriptionsUsd: 37.74,
  domainAnnual: 30,
  marketing: 500,
  otherCosts: 0,
  monthlySubscribers: 10,
  annualSubscribers: 0,
  freeStudents: 0,
};

const STORAGE_KEY = "evoluir-admin-financial-projection-v1";

type DailyUsdQuote = { rate: number; date: string; cached?: boolean };

type BcbQuoteRecord = {
  cotacaoVenda?: number;
  dataHoraCotacao?: string;
};

const QUOTE_STORAGE_KEY = "evoluir-admin-financial-usd-brl-ptax-v3";
const MAX_QUOTE_AGE_DAYS = 10;

function formatBcbDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}-${date.getFullYear()}`;
}

function isUsableQuote(quote: DailyUsdQuote, now: Date) {
  const rate = Number(quote.rate);
  const quoteTime = Date.parse(quote.date.replace(" ", "T"));
  const age = now.getTime() - quoteTime;
  const maxAge = MAX_QUOTE_AGE_DAYS * 24 * 60 * 60 * 1000;

  return (
    Number.isFinite(rate) &&
    rate > 0 &&
    Number.isFinite(quoteTime) &&
    age >= -24 * 60 * 60 * 1000 &&
    age <= maxAge
  );
}

async function fetchDailyUsdQuote(pt: boolean): Promise<DailyUsdQuote> {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  const params = new URLSearchParams({
    "@codigoMoeda": "'USD'",
    "@dataInicialCotacao": `'${formatBcbDate(start)}'`,
    "@dataFinalCotacao": `'${formatBcbDate(today)}'`,
    $top: "100",
    $orderby: "dataHoraCotacao desc",
    $format: "json",
    $select: "cotacaoVenda,dataHoraCotacao",
  });
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    `CotacaoMoedaPeriodoFechamento(codigoMoeda=@codigoMoeda,dataInicialCotacao=@dataInicialCotacao,dataFinalCotacao=@dataFinalCotacao)?${params.toString().replace(/\+/g, "%20")}`;

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(
        pt
          ? "Não foi possível consultar a PTAX de fechamento do Banco Central."
          : "Could not retrieve the Central Bank PTAX closing rate.",
      );
    }

    const payload = (await response.json()) as { value?: BcbQuoteRecord[] };
    const latest = (payload.value ?? [])
      .filter((item) => Number.isFinite(Number(item.cotacaoVenda)) && Number(item.cotacaoVenda) > 0)
      .sort((a, b) => Date.parse(b.dataHoraCotacao ?? "") - Date.parse(a.dataHoraCotacao ?? ""))[0];
    const quote: DailyUsdQuote = {
      rate: Number(latest?.cotacaoVenda),
      date: latest?.dataHoraCotacao ?? "",
    };

    if (!isUsableQuote(quote, today)) {
      throw new Error(
        pt
          ? "O Banco Central não retornou uma PTAX de fechamento válida e recente."
          : "The Central Bank did not return a valid and recent PTAX closing quote.",
      );
    }

    localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(quote));
    return quote;
  } catch (error) {
    try {
      const saved = localStorage.getItem(QUOTE_STORAGE_KEY);
      if (saved) {
        const quote = JSON.parse(saved) as DailyUsdQuote;
        if (isUsableQuote(quote, today)) return { ...quote, cached: true };
      }
    } catch {
      /* Ignore an unavailable or invalid cached quote. */
    }
    throw error;
  }
}

const money = (value: number, locale = "pt-BR") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
  }).format(value);

export function AdminFinancialProjection() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const [values, setValues] = useState<Inputs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const exchangeRateQuery = useQuery({
    queryKey: ["admin-financial-usd-brl-ptax-closing"],
    queryFn: () => fetchDailyUsdQuote(pt),
    staleTime: 6 * 60 * 60 * 1000,
    refetchInterval: 24 * 60 * 60 * 1000,
    retry: 2,
  });
  const usdBrl = exchangeRateQuery.data?.rate ?? 0;
  const hasExchangeRate = Number.isFinite(usdBrl) && usdBrl > 0;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Inputs> & {
          lovable?: number;
          aiSubscriptions?: number;
        };
        setValues({
          ...DEFAULTS,
          ...parsed,
          lovableUsd: parsed.lovableUsd ?? parsed.lovable ?? DEFAULTS.lovableUsd,
          aiSubscriptionsUsd:
            parsed.aiSubscriptionsUsd ?? parsed.aiSubscriptions ?? DEFAULTS.aiSubscriptionsUsd,
        });
      }
    } catch {
      /* Keep defaults if local storage is unavailable or invalid. */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      } catch {
        /* Optional persistence. */
      }
    }
  }, [loaded, values]);

  const set = (key: keyof Inputs, raw: string) => {
    const value = Number(raw);
    setValues((current) => ({
      ...current,
      [key]: Number.isFinite(value) ? Math.max(0, value) : 0,
    }));
  };

  const fixedCosts =
    (values.lovableUsd + values.aiSubscriptionsUsd) * usdBrl +
    values.domainAnnual / 12 +
    values.marketing +
    values.otherCosts;
  const monthlyStripe = (values.monthlyPrice * values.stripePercent) / 100 + values.stripeFixed;
  const annualStripe = (values.annualPrice * values.stripePercent) / 100 + values.stripeFixed;
  const monthlyNet = values.monthlyPrice - monthlyStripe;
  const annualNetMonthly = (values.annualPrice - annualStripe) / 12;
  const aiPerStudent = values.aiUsdPerStudent * usdBrl;
  const paidStudents = values.monthlySubscribers + values.annualSubscribers;
  const activeStudents = paidStudents + values.freeStudents;
  const revenue =
    values.monthlySubscribers * values.monthlyPrice +
    (values.annualSubscribers * values.annualPrice) / 12;
  const stripeCost =
    values.monthlySubscribers * monthlyStripe + (values.annualSubscribers * annualStripe) / 12;
  const variableAi = activeStudents * aiPerStudent;
  const totalCosts = fixedCosts + stripeCost + variableAi;
  const result = revenue - totalCosts;
  const totalCostPerStudent = activeStudents > 0 ? totalCosts / activeStudents : 0;

  const projections = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const factor = month;
        const gross = revenue * factor;
        const costs = totalCosts * factor;
        return {
          month: `M${month}`,
          receita: Number(gross.toFixed(2)),
          despesas: Number(costs.toFixed(2)),
          resultado: Number((gross - costs).toFixed(2)),
        };
      }),
    [revenue, totalCosts],
  );

  const fields: {
    key: keyof Inputs;
    label: string;
    prefix?: string;
    suffix?: string;
    step?: string;
  }[] = [
    {
      key: "monthlyPrice",
      label: pt ? "Preço plano mensal" : "Monthly plan price",
      prefix: "R$",
      step: "0.01",
    },
    {
      key: "annualPrice",
      label: pt ? "Preço plano anual" : "Annual plan price",
      prefix: "R$",
      step: "0.01",
    },
    { key: "stripePercent", label: "Stripe — percentage", suffix: "%", step: "0.01" },
    {
      key: "stripeFixed",
      label: "Stripe — fixed fee per charge",
      prefix: "R$",
      step: "0.01",
    },
    {
      key: "aiUsdPerStudent",
      label: "Variable AI cost per student/month (USD)",
      prefix: "US$",
      step: "0.01",
    },
    { key: "lovableUsd", label: "Lovable / month", prefix: "US$", step: "0.01" },
    {
      key: "aiSubscriptionsUsd",
      label: "Pro AI subscriptions / month",
      prefix: "US$",
      step: "0.01",
    },
    { key: "domainAnnual", label: "Domain / year", prefix: "R$", step: "0.01" },
    { key: "marketing", label: "Marketing / month", prefix: "R$", step: "0.01" },
    { key: "otherCosts", label: "Other costs / month", prefix: "R$", step: "0.01" },
    { key: "monthlySubscribers", label: "Monthly plan subscribers", step: "1" },
    { key: "annualSubscribers", label: "Annual plan subscribers", step: "1" },
    { key: "freeStudents", label: "Free students (reference)", step: "1" },
  ];

  return (
    <section className="mt-4 border-t border-border pt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {pt ? "Financeiro e Projeções" : "Financial projections"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {pt
              ? "Simulador editável. Alterações recalculam os indicadores e gráficos automaticamente."
              : "Editable simulator. Changes automatically recalculate metrics and charts."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setValues(DEFAULTS)}>
          {pt ? "Restaurar premissas" : "Reset assumptions"}
        </Button>
      </div>

      {!hasExchangeRate ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {pt
            ? "A projeção financeira está temporariamente indisponível porque ainda não há uma cotação USD/BRL válida. Os custos em dólar não serão tratados como zero."
            : "Financial projections are temporarily unavailable because there is no valid USD/BRL exchange rate. USD costs will not be treated as zero."}
        </div>
      ) : (
        <>
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 sm:p-5">
            <p className="text-sm font-semibold text-muted-foreground">
              {pt ? "CUSTO TOTAL DE 1 ALUNO POR MÊS" : "TOTAL COST PER STUDENT / MONTH"}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-3xl font-bold tabular-nums text-primary">
                {money(totalCostPerStudent)}
              </p>
              <span className="text-xs text-muted-foreground">
                {pt ? "por aluno ativo / mês" : "per active student / month"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeStudents > 0
                ? pt
                  ? `Cálculo: ${money(totalCosts)} em custos mensais estimados ÷ ${activeStudents} alunos ativos (${paidStudents} pagantes + ${values.freeStudents} Free).`
                  : `Calculation: ${money(totalCosts, "en-US")} in estimated monthly costs ÷ ${activeStudents} active students (${paidStudents} paid + ${values.freeStudents} Free).`
                : pt
                  ? "Informe a quantidade de alunos pagantes ou Free para calcular o custo completo por aluno."
                  : "Enter the number of paid or Free students to calculate the full cost per student."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pt
                ? `Dentro desse total, IA variável estimada por aluno: ${money(aiPerStudent)}. O valor completo também rateia Lovable, IAs Pro, domínio, marketing, outros custos e Stripe dos pagantes.`
                : `This total includes an estimated variable AI cost of ${money(aiPerStudent)} per student. It also allocates Lovable, Pro AI subscriptions, domain, marketing, other costs, and Stripe fees for paid students.`}
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            <p className="font-semibold">
              {pt
                ? "Cotação automática do dólar (PTAX/BCB)"
                : "Automatic USD exchange rate (PTAX/BCB)"}
            </p>
            {exchangeRateQuery.isPending ? (
              <p className="mt-1 text-muted-foreground">
                {pt
                  ? "Consultando a cotação mais recente..."
                  : "Checking the latest exchange rate..."}
              </p>
            ) : exchangeRateQuery.isError ? (
              <p className="mt-1 text-destructive">
                {pt
                  ? "Não foi possível atualizar a cotação. Recarregue o painel para tentar novamente."
                  : "Could not update the exchange rate. Reload the panel to try again."}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                US$ 1 = {money(usdBrl)}
                {" · "}
                {pt ? "Cotação de venda em" : "Selling rate on"}{" "}
                {new Date(exchangeRateQuery.data.date).toLocaleString(pt ? "pt-BR" : "en-US", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Sao_Paulo",
                })}
                {exchangeRateQuery.data.cached &&
                  (pt
                    ? " · usando última cotação salva (atualização indisponível)"
                    : " · using the last saved rate (update unavailable)")}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <label key={field.key} className="text-xs text-muted-foreground">
                {field.label}
                <div className="mt-1 flex h-10 items-center rounded-md border border-input bg-background px-3">
                  {field.prefix && <span className="mr-2">{field.prefix}</span>}
                  <input
                    aria-label={field.label}
                    className="min-w-0 w-full bg-transparent text-sm text-foreground outline-none"
                    type="number"
                    min="0"
                    step={field.step ?? "0.01"}
                    value={values[field.key]}
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                  {field.suffix && <span className="ml-2">{field.suffix}</span>}
                </div>
              </label>
            ))}
          </div>

          <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
            {pt
              ? "Tarifa inicial configurada para simulação: 3,99% + R$ 0,39 por cobrança. Confirme no Dashboard/contrato da sua conta Stripe se a tarifa efetiva é essa. A estimativa de IA de US$ 2,14 por aluno/mês é uma premissa baseada no cenário informado, não um custo médio validado por aluno. IAs Pro é mantido separado do consumo variável de tokens para evitar dupla contagem; ajuste se houver sobreposição."
              : "Initial simulation fee: 3.99% + R$0.39 per charge. Confirm the actual fee in your Stripe Dashboard/agreement. The US$2.14 per-student/month AI estimate is an assumption based on the stated scenario, not a validated average cost per student. Pro AI subscriptions are kept separate from variable token usage to avoid double counting; adjust if they overlap."}
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              [
                pt ? "Receita bruta mensal equivalente" : "Equivalent monthly gross revenue",
                money(revenue),
              ],
              [pt ? "Stripe estimada" : "Estimated Stripe fees", money(stripeCost)],
              [pt ? "Despesas totais estimadas" : "Estimated total expenses", money(totalCosts)],
              [pt ? "Resultado operacional estimado" : "Estimated operating result", money(result)],
              [pt ? "Custos fixos" : "Fixed costs", money(fixedCosts)],
              [
                pt ? "IA variável (todos os alunos)" : "Variable AI (all students)",
                money(variableAi),
              ],
              [pt ? "Líquido por plano mensal" : "Net per monthly plan", money(monthlyNet)],
              [
                pt ? "Líquido anual / mês equivalente" : "Annual net / monthly equivalent",
                money(annualNetMonthly),
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-1 text-sm font-semibold">
              {pt ? "Projeção de 12 meses" : "12-month projection"}
            </h4>
            <p className="mb-3 text-xs text-muted-foreground">
              {pt
                ? "Cenário constante: mesma quantidade de assinantes e custos por mês. Valores acumulados, sem crescimento presumido."
                : "Constant scenario: same number of subscribers and monthly costs. Cumulative values, with no assumed growth."}
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projections} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value: number) => `R$${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="receita"
                    name={pt ? "Receita acumulada" : "Cumulative revenue"}
                    stroke="#16a34a"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="despesas"
                    name={pt ? "Despesas acumuladas" : "Cumulative expenses"}
                    stroke="#ea580c"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="resultado"
                    name={pt ? "Resultado acumulado" : "Cumulative result"}
                    stroke="#2563eb"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {pt
              ? "Premissas salvas neste navegador. O custo variável de IA considera todos os alunos ativos, incluindo Free, usando a mesma estimativa por aluno; ajuste essa premissa quando houver medição separada por plano. Não inclui impostos, reembolsos, chargebacks ou tarifas adicionais não informadas."
              : "Assumptions are saved in this browser. Variable AI cost includes all active students, including Free users, using the same per-student estimate; adjust this assumption when plan-level measurements are available. Taxes, refunds, chargebacks, and unspecified additional fees are not included."}
          </p>
        </>
      )}
    </section>
  );
}
