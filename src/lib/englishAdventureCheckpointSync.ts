// Pure rules for English Adventure checkpoints (shared by the hook and tests).
// The server revision is the single source of truth for the narrative; completed
// activity IDs are only ever added (pedagogical rule: done stays done).

export type AdventureCheckpoint = {
  currentStep: number;
  choices: Record<string, number>;
  decisions: string[];
  recovered: number;
  completedActivityIds: string[];
  completed: boolean;
  /** Last server revision this copy is based on (0 = never saved). */
  revision: number;
  /** True while this device holds changes the server has not accepted yet. */
  dirty?: boolean;
};

export const EMPTY_ADVENTURE_CHECKPOINT: AdventureCheckpoint = {
  currentStep: 0,
  choices: {},
  decisions: [],
  recovered: 0,
  completedActivityIds: [],
  completed: false,
  revision: 0,
  dirty: false,
};

export function unionIds(...lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort();
}

/**
 * Decides which copy to show when local and server copies meet.
 * - Server newer (or local clean): server narrative wins, ids are unioned.
 * - Same base revision and local dirty: keep local (it will be pushed).
 * - Local based on an older revision: discard its narrative (e.g. a restart
 *   happened elsewhere); only its completed ids survive.
 */
export function reconcile(
  local: AdventureCheckpoint,
  remote: AdventureCheckpoint | null,
): { checkpoint: AdventureCheckpoint; push: boolean } {
  if (!remote) {
    const push = Boolean(local.dirty) || hasProgress(local);
    return { checkpoint: { ...local, revision: 0, dirty: push }, push };
  }
  if (local.dirty && local.revision === remote.revision) {
    return {
      checkpoint: {
        ...local,
        completedActivityIds: unionIds(remote.completedActivityIds, local.completedActivityIds),
      },
      push: true,
    };
  }
  const ids = unionIds(remote.completedActivityIds, local.completedActivityIds);
  const extraIds = ids.length > remote.completedActivityIds.length;
  return {
    checkpoint: { ...remote, completedActivityIds: ids, dirty: extraIds },
    push: extraIds,
  };
}

export function hasProgress(c: AdventureCheckpoint) {
  return (
    c.currentStep > 0 ||
    Object.keys(c.choices).length > 0 ||
    c.completedActivityIds.length > 0 ||
    c.completed
  );
}

/** Restart: empty narrative, completed ids kept, still based on the same revision. */
export function restartCheckpoint(current: AdventureCheckpoint): AdventureCheckpoint {
  return {
    ...EMPTY_ADVENTURE_CHECKPOINT,
    completedActivityIds: current.completedActivityIds,
    revision: current.revision,
    dirty: true,
  };
}

export function advanceCheckpoint(
  current: AdventureCheckpoint,
  adventureId: string,
  totalSteps: number,
  decision?: string,
): AdventureCheckpoint {
  if (current.completed || current.currentStep >= totalSteps) return current;
  const nextStep = Math.min(current.currentStep + 1, totalSteps);
  return {
    ...current,
    currentStep: nextStep,
    decisions: decision ? [...current.decisions, decision] : current.decisions,
    completedActivityIds: unionIds(current.completedActivityIds, [
      `${adventureId}:${current.currentStep}`,
    ]),
    completed: nextStep >= totalSteps,
    dirty: true,
  };
}

/** Home progress: union of every adventure's completed ids, never written back. */
export function consolidateHomeIds(
  localIds: string[],
  remoteRows: { completed_activity_ids?: string[] | null }[],
) {
  return unionIds(localIds, ...remoteRows.map((r) => r.completed_activity_ids ?? []));
}
