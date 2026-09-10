import { describe, it, expect } from "vitest";
import { boroughLabels } from "../src/boroughs";

// 024 P3: pins the FULL sorted 33-label set (32 London boroughs + City of London), not just a count +
// a few includes/excludes — a partial assertion would still pass if data/places.json's ordering ever
// shifted (e.g. a landmark inserted before Hillingdon), silently admitting a non-borough or dropping a
// real one. This literal list is the test's SPEC PIN, not a second hand-authored source the app reads
// from (boroughs.ts itself derives everything from the committed data/places.json at runtime) — see
// boroughs.ts's header comment for the derivation rationale.
const EXPECTED_BOROUGHS = [
  "Barking and Dagenham",
  "Barnet",
  "Bexley",
  "Brent",
  "Bromley",
  "Camden",
  "City of London",
  "Croydon",
  "Ealing",
  "Enfield",
  "Greenwich",
  "Hackney",
  "Hammersmith and Fulham",
  "Haringey",
  "Harrow",
  "Havering",
  "Hillingdon",
  "Hounslow",
  "Islington",
  "Kensington and Chelsea",
  "Kingston upon Thames",
  "Lambeth",
  "Lewisham",
  "Merton",
  "Newham",
  "Redbridge",
  "Richmond upon Thames",
  "Southwark",
  "Sutton",
  "Tower Hamlets",
  "Waltham Forest",
  "Wandsworth",
  "Westminster",
];

describe("boroughLabels", () => {
  it("returns exactly the 33 London boroughs (32 boroughs + City of London), sorted alphabetically — a data/places.json reorder fails this loudly rather than silently admitting a landmark", () => {
    expect(boroughLabels()).toEqual(EXPECTED_BOROUGHS);
  });

  it("excludes neighbourhood/landmark entries that follow the boroughs in data/places.json", () => {
    const labels = boroughLabels();
    for (const notABorough of [
      "Shoreditch",
      "Soho",
      "Tower of London",
      "Buckingham Palace",
      "Hyde Park",
      "Canary Wharf",
    ]) {
      expect(labels).not.toContain(notABorough);
    }
  });
});
