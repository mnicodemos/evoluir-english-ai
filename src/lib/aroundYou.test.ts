import { describe, expect, it } from "vitest";

import { uiPt } from "./uiDictionary";
import {
  AROUND_YOU_LABELS,
  isPlaceKind,
  nearbyPlaces,
  overpassQuery,
  PLACE_KINDS,
  placeKindOf,
  placeRolePlay,
} from "./aroundYou";

describe("around you in English", () => {
  it("maps OpenStreetMap tags to the places EVO can act out", () => {
    expect(placeKindOf({ amenity: "cafe" })).toBe("cafe");
    expect(placeKindOf({ shop: "chemist" })).toBe("pharmacy");
    expect(placeKindOf({ railway: "station" })).toBe("transport");
    expect(placeKindOf({ amenity: "parking" })).toBeNull();
  });

  it("keeps the nearest place of each kind, closest first", () => {
    const places = nearbyPlaces(
      {
        elements: [
          { lat: -23.5506, lon: -46.6334, tags: { amenity: "cafe", name: "Far café" } },
          { lat: -23.5505, lon: -46.6333, tags: { amenity: "cafe", name: "Near café" } },
          { center: { lat: -23.552, lon: -46.634 }, tags: { leisure: "park" } },
          { lat: -23.5505, lon: -46.6333, tags: { amenity: "parking" } },
        ],
      },
      -23.5505,
      -46.6333,
    );
    expect(places.map((place) => [place.kind, place.name])).toEqual([
      ["cafe", "Near café"],
      ["park", null],
    ]);
  });

  it("rounds the position it sends and asks only for known places", () => {
    const query = overpassQuery(-23.550512, -46.633321);
    expect(query).toContain("-23.5505,-46.6333");
    expect(query).toContain("pharmacy");
  });

  it("gives every place a role and an English opener", () => {
    for (const kind of PLACE_KINDS) {
      const play = placeRolePlay(kind);
      expect(play.role.length).toBeGreaterThan(40);
      expect(play.opener).toMatch(/[?!.]$/);
    }
    expect(isPlaceKind("cafe")).toBe(true);
    expect(isPlaceKind("casino")).toBe(false);
  });

  it("has the Portuguese of every place label", () => {
    expect(AROUND_YOU_LABELS.filter((label) => !uiPt[label])).toEqual([]);
  });
});
