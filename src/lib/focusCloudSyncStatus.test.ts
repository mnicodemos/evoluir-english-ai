import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOCUS_CLOUD_SYNC_READY_EVENT,
  getFocusCloudSyncStatus,
  setFocusCloudSyncStatus,
} from "./focusCloudSyncStatus";

describe("Focus cloud sync readiness", () => {
  afterEach(() => {
    setFocusCloudSyncStatus("student", "pending");
    vi.unstubAllGlobals();
  });

  it("does not mark a student ready until the cloud snapshot is restored", () => {
    expect(getFocusCloudSyncStatus("student")).toBe("pending");
    setFocusCloudSyncStatus("student", "ready");
    expect(getFocusCloudSyncStatus("student")).toBe("ready");
  });

  it("suppresses invitations after a failed cloud read", () => {
    setFocusCloudSyncStatus("student", "failed");
    expect(getFocusCloudSyncStatus("student")).toBe("failed");
    setFocusCloudSyncStatus("student", "pending");
    expect(getFocusCloudSyncStatus("student")).toBe("pending");
  });

  it("notifies the invitation flow when synchronization completes", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    setFocusCloudSyncStatus("student", "ready");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
    expect((dispatchEvent.mock.calls[0]?.[0] as CustomEvent).type).toBe(
      FOCUS_CLOUD_SYNC_READY_EVENT,
    );
  });
});
