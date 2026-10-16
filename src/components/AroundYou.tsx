import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, MapPin } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  nearbyPlaces,
  overpassQuery,
  PLACE_TALK,
  type NearbyPlace,
  type PlaceKind,
} from "@/lib/aroundYou";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SUGGESTED: PlaceKind[] = [
  "cafe",
  "restaurant",
  "pharmacy",
  "supermarket",
  "transport",
  "hotel",
];

/**
 * "Around you in English" (aroundYou.ts): the places near the student become
 * situations to act out with EVO, as if living abroad. Location only on tap,
 * sent from the browser straight to OpenStreetMap, never to our servers.
 */
export function AroundYou({ translate: t }: { translate: (label: string) => string }) {
  const [state, setState] = useState<"idle" | "locating" | "ready" | "fallback">("idle");
  const [places, setPlaces] = useState<NearbyPlace[]>([]);

  function findPlaces() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("fallback");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch(OVERPASS_URL, {
            method: "POST",
            body: new URLSearchParams({ data: overpassQuery(coords.latitude, coords.longitude) }),
            signal: AbortSignal.timeout(15_000),
          });
          const found = nearbyPlaces(
            response.ok ? await response.json() : null,
            coords.latitude,
            coords.longitude,
          );
          setPlaces(found);
          setState(found.length ? "ready" : "fallback");
        } catch {
          setState("fallback");
        }
      },
      () => setState("fallback"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  const list: { kind: PlaceKind; detail?: string }[] =
    state === "ready"
      ? places.map((place) => ({
          kind: place.kind,
          detail: `${place.name ? `${place.name} · ` : ""}${
            place.metres < 1000 ? `${place.metres} m` : `${(place.metres / 1000).toFixed(1)} km`
          }`,
        }))
      : state === "fallback"
        ? SUGGESTED.map((kind) => ({ kind }))
        : [];

  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <MapPin className="size-3.5 text-brand-green" aria-hidden="true" />
        {t("Around you in English")}
      </p>
      {state === "idle" || state === "locating" ? (
        <>
          <p className="text-xs text-muted-foreground">
            {t("Practise real situations at places near you, as if you lived abroad.")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            disabled={state === "locating"}
            onClick={findPlaces}
          >
            {state === "locating" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MapPin className="size-4" aria-hidden="true" />
            )}
            {t("Find places near me")}
          </Button>
        </>
      ) : (
        <>
          {state === "fallback" ? (
            <p className="text-xs text-muted-foreground">
              {t("No places found nearby. Choose a situation:")}
            </p>
          ) : null}
          <ul className="space-y-1">
            {list.map(({ kind, detail }) => (
              <li key={kind}>
                <Link
                  to="/coach"
                  search={{ place: kind }}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-white/10"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(PLACE_TALK[kind].label)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t(PLACE_TALK[kind].practice)}
                      {detail ? (
                        <>
                          {" · "}
                          <span translate="no">{detail}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
