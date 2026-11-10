import { useEffect, useMemo, useState } from "react";
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

type Inputs = {
  monthlyPrice: number;
  annualPrice: number;
  stripePercent: number;
  stripeFixed: number;
  usdBrl: number;
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
  usdBrl: 5.3,
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

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export function AdminFinancialProjection() {
  const [values, setValues] = useState<Inputs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Inputs> & {
          lovable?: number;
          aiSubscriptions?: number;
        };
        const rate = Number(parsed.usdBrl) > 0 ? Number(parsed.usdBrl) : DEFAULTS.usdBrl;
        setValues({
          ...DEFAULTS,
          ...parsed,
          lovableUsd:
            parsed.lovableUsd ??
            (parsed.lovable !== undefined ? parsed.lovable / rate : DEFAULTS.lovableUsd),
          aiSubscriptionsUsd:
            parsed.aiSubscriptionsUsd ??
            (parsed.aiSubscriptions !== undefined
              ? parsed.aiSubscriptions / rate
              : DEFAULTS.aiSubscriptionsUsd),
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
    (values.lovableUsd + values.aiSubscriptionsUsd) * values.usdBrl +
    values.domainAnnual / 12 +
    values.marketing +
    values.otherCosts;
  const monthlyStripe = (values.monthlyPrice * values.stripePercent) / 100 + values.stripeFixed;
  const annualStripe = (values.annualPrice * values.stripePercent) / 100 + values.stripeFixed;
  const monthlyNet = values.monthlyPrice - monthlyStripe;
  const annualNetMonthly = (values.annualPrice - annualStripe) / 12;
  const aiPerStudent = values.aiUsdPerStudent * values.usdBrl;
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
    { key: "monthlyPrice", label: "Preço plano mensal", prefix: "R$", step: "0.01" },
    { key: "annualPrice", label: "Preço plano anual", prefix: "R$", step: "0.01" },
    { key: "stripePercent", label: "Stripe — percentual", suffix: "%", step: "0.01" },
    {
      key: "stripeFixed",
      label: "Stripe — valor fixo por cobrança",
      prefix: "R$",
      step: "0.01",
    },
    { key: "usdBrl", label: "Câmbio USD/BRL", prefix: "R$", step: "0.01" },
    {
      key: "aiUsdPerStudent",
      label: "IA variável por aluno/mês (USD)",
      prefix: "US$",
      step: "0.01",
    },
    { key: "lovableUsd", label: "Lovable / mês", prefix: "US$", step: "0.01" },
    { key: "aiSubscriptionsUsd", label: "Assinaturas IAs Pro / mês", prefix: "US$", step: "0.01" },
    { key: "domainAnnual", label: "Domínio / ano", prefix: "R$", step: "0.01" },
    { key: "marketing", label: "Marketing / mês", prefix: "R$", step: "0.01" },
    { key: "otherCosts", label: "Outros custos / mês", prefix: "R$", step: "0.01" },
    { key: "monthlySubscribers", label: "Assinantes do plano mensal", step: "1" },
    { key: "annualSubscribers", label: "Assinantes do plano anual", step: "1" },
    { key: "freeStudents", label: "Alunos Free (referência)", step: "1" },
  ];

  return (
    <section className="mt-4 border-t border-border pt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Financeiro e Projeções</h3>
          <p className="text-xs text-muted-foreground">
            Simulador editável. Alterações recalculam os indicadores e gráficos automaticamente.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setValues(DEFAULTS)}>
          Restaurar premissas
        </Button>
      </div>

      <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 sm:p-5">
        <p className="text-sm font-semibold text-muted-foreground">
          CUSTO TOTAL DE 1 ALUNO POR MÊS
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl font-bold tabular-nums text-primary">
            {money(totalCostPerStudent)}
          </p>
          <span className="text-xs text-muted-foreground">por aluno ativo / mês</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {activeStudents > 0
            ? `Cálculo: ${money(totalCosts)} em custos mensais estimados ÷ ${activeStudents} alunos ativos (${paidStudents} pagantes + ${values.freeStudents} Free).`
            : "Informe a quantidade de alunos pagantes ou Free para calcular o custo completo por aluno."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dentro desse total, IA variável estimada por aluno: {money(aiPerStudent)}. O valor
          completo também rateia Lovable, IAs Pro, domínio, marketing, outros custos e Stripe dos
          pagantes.
        </p>
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
        Cotação centralizada: US$ 1 = {money(values.usdBrl)}. Todos os custos em USD usam essa mesma
        taxa. Lovable: US$ {values.lovableUsd.toFixed(2)} (
        {money(values.lovableUsd * values.usdBrl)}/mês); IAs Pro: US$
        {values.aiSubscriptionsUsd.toFixed(2)} (
        {money(values.aiSubscriptionsUsd * values.usdBrl)}
        /mês). Atualize a cotação e os valores originais conforme suas faturas; a taxa é uma
        premissa editável, não uma cotação automática em tempo real.
      </div>

      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
        Tarifa inicial configurada para simulação: 3,99% + R$ 0,39 por cobrança. Confirme no
        Dashboard/contrato da sua conta Stripe se a tarifa efetiva é essa. A estimativa de IA de US$
        2,14 por aluno/mês é uma premissa baseada no cenário informado, não um custo médio validado
        por aluno. IAs Pro é mantido separado do consumo variável de tokens para evitar dupla
        contagem; ajuste se houver sobreposição.
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Receita bruta mensal equivalente", money(revenue)],
          ["Stripe estimada", money(stripeCost)],
          ["Despesas totais estimadas", money(totalCosts)],
          ["Resultado operacional estimado", money(result)],
          ["Custos fixos", money(fixedCosts)],
          ["IA variável (todos os alunos)", money(variableAi)],
          ["Líquido por plano mensal", money(monthlyNet)],
          ["Líquido anual / mês equivalente", money(annualNetMonthly)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h4 className="mb-1 text-sm font-semibold">Projeção de 12 meses</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Cenário constante: mesma quantidade de assinantes e custos por mês. Valores acumulados,
          sem crescimento presumido.
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
                name="Receita acumulada"
                stroke="#16a34a"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="despesas"
                name="Despesas acumuladas"
                stroke="#ea580c"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="resultado"
                name="Resultado acumulado"
                stroke="#2563eb"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Premissas salvas neste navegador. O custo variável de IA considera todos os alunos ativos,
        incluindo Free, usando a mesma estimativa por aluno; ajuste essa premissa quando houver
        medição separada por plano. Não inclui impostos, reembolsos, chargebacks ou tarifas
        adicionais não informadas.
      </p>
    </section>
  );
}
