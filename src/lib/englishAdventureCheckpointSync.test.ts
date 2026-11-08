import { describe, expect, it } from "vitest";

import { ENGLISH_ADVENTURES_TOTAL, englishAdventureProgress } from "./englishAdventuresProgress";
import {
  advanceCheckpoint,
  consolidateHomeIds,
  EMPTY_ADVENTURE_CHECKPOINT as E,
  reconcile,
  restartCheckpoint,
} from "./englishAdventureCheckpointSync";

const A = "a2-surprise-delivery";

describe("English Adventure checkpoint sync", () => {
  it("persists progress: advancing records the activity and marks the copy dirty", () => {
    const next = advanceCheckpoint(E, A, 10);
    expect(next.currentStep).toBe(1);
    expect(next.completedActivityIds).toEqual([`${A}:0`]);
    expect(next.dirty).toBe(true);
  });

  it("finishing the last step completes the adventure and does not go further", () => {
    const at9 = { ...E, currentStep: 9 };
    const done = advanceCheckpoint(at9, A, 10);
    expect(done.completed).toBe(true);
    expect(advanceCheckpoint(done, A, 10)).toBe(done);
  });

  it("restart empties the narrative but keeps completed activity IDs", () => {
    const c = {
      ...E,
      currentStep: 6,
      choices: { "0": 1 },
      completed: false,
      completedActivityIds: [`${A}:0`, `${A}:5`],
      revision: 4,
    };
    const r = restartCheckpoint(c);
    expect(r.currentStep).toBe(0);
    expect(r.choices).toEqual({});
    expect(r.completedActivityIds).toEqual([`${A}:0`, `${A}:5`]);
    expect(r.revision).toBe(4);
  });

  it("a device with an older revision cannot restore narrative after a restart elsewhere", () => {
    const oldDevice = {
      ...E,
      currentStep: 7,
      choices: { "6": 2 },
      revision: 3,
      dirty: true,
      completedActivityIds: [`${A}:6`],
    };
    const serverAfterRestart = {
      ...E,
      currentStep: 0,
      revision: 5,
      completedActivityIds: [`${A}:0`],
    };
    const { checkpoint } = reconcile(oldDevice, serverAfterRestart);
    expect(checkpoint.currentStep).toBe(0);
    expect(checkpoint.revision).toBe(5);
    expect(checkpoint.completedActivityIds).toEqual([`${A}:0`, `${A}:6`]);
  });

  it("concurrency: same base revision and dirty local is pushed, clean local takes the server", () => {
    const server = { ...E, currentStep: 2, revision: 2 };
    expect(reconcile({ ...E, currentStep: 3, revision: 2, dirty: true }, server).push).toBe(true);
    const clean = reconcile({ ...E, currentStep: 1, revision: 1 }, server);
    expect(clean.push).toBe(false);
    expect(clean.checkpoint.currentStep).toBe(2);
  });

  it("cross-device sync: a newer server copy replaces this device's narrative", () => {
    const { checkpoint } = reconcile(
      { ...E, currentStep: 1, revision: 1 },
      { ...E, currentStep: 8, revision: 9 },
    );
    expect(checkpoint.currentStep).toBe(8);
  });

  it("first save with no server row pushes local progress at revision 0", () => {
    const { checkpoint, push } = reconcile({ ...E, currentStep: 2, revision: 0 }, null);
    expect(push).toBe(true);
    expect(checkpoint.revision).toBe(0);
  });

  it("Home percent consolidates every adventure over 40 activities", () => {
    const ids = consolidateHomeIds(
      ["a1-welcome-mix-up:0"],
      [
      { completed_activity_ids: ["a1-welcome-mix-up:0", `${A}:1`] },
        { completed_activity_ids: null },
      ],
    );
    expect(ids).toHaveLength(2);
    expect(ENGLISH_ADVENTURES_TOTAL).toBe(40);
    expect(englishAdventureProgress(ids).percent).toBe(5);
  });
});
