const readyUsers = new Set<string>();
const failedUsers = new Set<string>();

export const FOCUS_CLOUD_SYNC_READY_EVENT = "evoluir-focus-cloud-sync-ready";

export function setFocusCloudSyncStatus(userId: string, status: "ready" | "failed" | "pending") {
  readyUsers.delete(userId);
  failedUsers.delete(userId);
  if (status === "ready") readyUsers.add(userId);
  if (status === "failed") failedUsers.add(userId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FOCUS_CLOUD_SYNC_READY_EVENT, { detail: { userId, status } }));
  }
}

export function getFocusCloudSyncStatus(userId: string | undefined): "ready" | "failed" | "pending" {
  if (!userId) return "pending";
  if (readyUsers.has(userId)) return "ready";
  if (failedUsers.has(userId)) return "failed";
  return "pending";
}
