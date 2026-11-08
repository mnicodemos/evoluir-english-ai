import { useMemo } from "react";

import { useEnglishAdventuresProgress } from "@/hooks/useEnglishAdventuresProgress";
import { useProfile } from "@/hooks/useProfile";
import { useUiLang } from "@/lib/uiLang";

const ROUTE = [
  { id: "a1-welcome-mix-up", title: "The Welcome Mix-Up", level: "A1", start: 0 },
  { id: "a1-neighbourhood-mystery", title: "The Neighbourhood Mystery", level: "A1", start: 10 },
  { id: "a2-surprise-delivery", title: "The Surprise Delivery", level: "A2", start: 20 },
  { id: "a2-community-festival", title: "The Community Festival", level: "A2", start: 30 },
] as const;

const X_START = 34;
const X_END = 746;
const Y_START = 30;
const ROW_GAP = 32;
const LEVEL_TOTAL = 20;
const A1_JOURNEY_TOTAL = 40;

type AdventureId = (typeof ROUTE)[number]["id"];
type AdventureLevel = "A1" | "A2";
type Point = { x: number; y: number; index: number };

function routePoints(total: number): Point[] {
  return Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / 10);
    const position = index % 10;
    const reverse = row % 2 === 1;
    const fraction = position / 9;
    return {
      x: reverse ? X_END - fraction * (X_END - X_START) : X_START + fraction * (X_END - X_START),
      y: Y_START + row * ROW_GAP,
      index,
    };
  });
}

export function EnglishAdventureJourneyMap({
  adventureId,
  activityIndex,
  isComplete = false,
}: {
  adventureId: AdventureId;
  activityIndex: number;
  isComplete?: boolean;
}) {
  const { data: profile } = useProfile();
  const level: AdventureLevel =
    (profile?.max_level || profile?.level || "a1").toLowerCase() === "a2" ? "A2" : "A1";
  const levelKey = level.toLowerCase() as "a1" | "a2";
  const levelRoute = level === "A1" ? ROUTE : ROUTE.filter((item) => item.level === level);
  const journeyTotal = level === "A1" ? A1_JOURNEY_TOTAL : LEVEL_TOTAL;
  const { completedActivityIds, completed, total, percent } =
    useEnglishAdventuresProgress(levelKey);
  const { lang } = useUiLang();
  const isPortuguese = lang === "pt";
  const points = useMemo(() => routePoints(journeyTotal), [journeyTotal]);
  const currentAdventure = levelRoute.find((item) => item.id === adventureId) ?? levelRoute[0];
  const currentIndex = Math.min(
    journeyTotal - 1,
    (level === "A2" ? (currentAdventure?.start ?? 20) - 20 : (currentAdventure?.start ?? 0)) +
      Math.max(0, activityIndex),
  );
  const activeIndex = isComplete ? -1 : currentIndex;
  const completedSet = new Set(completedActivityIds);
  const activityIdAt = (index: number) => {
    const routeIndex = level === "A2" ? 2 + Math.floor(index / 10) : Math.floor(index / 10);
    const route = ROUTE[routeIndex] ?? levelRoute[0];
    return `${route.id}:${index % 10}`;
  };
  const firstIncomplete = points.find((point) => !completedSet.has(activityIdAt(point.index)));
  const travelledThrough = Math.min(currentIndex, firstIncomplete?.index ?? journeyTotal - 1);
  const fullPath = points.map((point) => `${point.x},${point.y}`).join(" ");
  const travelledPath = points
    .slice(0, travelledThrough + 1)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const remaining = Math.max(0, total - completed);
  const activityNumber = Math.min(journeyTotal, currentIndex + 1);
  const titlesPt = [
    "Acolhida confusa",
    "Mistério no bairro",
    "Entrega surpresa",
    "Festival comunitário",
  ];

  return (
    <section
      aria-label={isPortuguese ? `Seu mapa da jornada ${level}` : `Your ${level} adventure map`}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm sm:p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-green">
            {isPortuguese ? `Sua jornada ${level}` : `Your ${level} adventure map`}
          </p>
          <p className="text-sm font-semibold">
            {isComplete && completed >= journeyTotal
              ? isPortuguese
                ? "Jornada concluída!"
                : "Journey complete!"
              : isPortuguese
                ? `Atividade ${activityNumber} de ${journeyTotal}`
                : `Activity ${activityNumber} of ${journeyTotal}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-brand-green">{percent}%</p>
          <p className="text-[11px] text-muted-foreground">
            {completed}/{total} {isPortuguese ? "concluídas" : "completed"}
          </p>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 780 ${level === "A1" ? 150 : 90}`}
          role="img"
          aria-label={
            isPortuguese
              ? `${completed} atividades concluídas de ${journeyTotal}; ${remaining} restantes`
              : `${completed} of ${journeyTotal} activities completed; ${remaining} remaining`
          }
          className="block h-auto w-full overflow-visible"
        >
          <polyline
            points={fullPath}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.17"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 10"
          />
          {travelledThrough >= 0 ? (
            <polyline
              points={travelledPath}
              fill="none"
              stroke="var(--brand-green, #20b58a)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-700 ease-out"
            />
          ) : null}

          {points.map((point) => {
            const isDone = completedSet.has(activityIdAt(point.index));
            const isCurrent = point.index === activeIndex;
            return (
              <g key={point.index}>
                {isCurrent ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="13"
                    fill="var(--brand-green, #20b58a)"
                    opacity="0.2"
                    className="animate-ping"
                  />
                ) : null}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isCurrent ? 10 : 7}
                  fill="var(--brand-green, #20b58a)"
                  fillOpacity={isDone || isCurrent ? 1 : 0.22}
                  stroke={isCurrent ? "currentColor" : "none"}
                  strokeWidth={isCurrent ? 1.5 : 0}
                />
                <text
                  x={point.x}
                  y={point.y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill={isDone || isCurrent ? "#ffffff" : "currentColor"}
                  fillOpacity={isDone || isCurrent ? 1 : 0.65}
                >
                  {point.index + 1}
                </text>
                {isCurrent ? (
                  <path
                    d={`M ${point.x - 4} ${point.y - 19} L ${point.x} ${point.y - 26} L ${point.x + 4} ${point.y - 19}`}
                    fill="none"
                    stroke="var(--brand-green, #20b58a)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1.5">
        {levelRoute.map((item, index) => {
          const active = item.id === adventureId;
          const doneCount = completedActivityIds.filter((id) =>
            id.startsWith(`${item.id}:`),
          ).length;
          const titleIndex = ROUTE.findIndex((route) => route.id === item.id);
          return (
            <div
              key={item.id}
              className={`min-w-0 rounded-lg px-2 py-1.5 ${active ? "bg-brand-green/10 ring-1 ring-brand-green/35" : "bg-secondary/40"}`}
            >
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.level} · {index + 1}
              </p>
              <p className="truncate text-xs font-medium">
                {isPortuguese ? titlesPt[titleIndex] : item.title}
              </p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {Math.min(10, doneCount)}/10 {isPortuguese ? "concluídas" : "completed"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand-green" />
          {isPortuguese ? "Caminho percorrido" : "Path completed"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-current opacity-30" />
          {isPortuguese ? "A fazer" : "To go"}: {remaining}
        </span>
        <span className="font-medium text-foreground">
          {isComplete
            ? isPortuguese
              ? "Etapa finalizada"
              : "Step completed"
            : isPortuguese
              ? `Você está aqui · ${activityNumber}/${journeyTotal}`
              : `You are here · ${activityNumber}/${journeyTotal}`}
        </span>
      </div>
    </section>
  );
}
