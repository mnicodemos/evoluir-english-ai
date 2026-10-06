// "Push" tab of the Admin panel: registered devices and a test notification to
// the admin's own devices, with each device's result. Read-only otherwise.
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pushDiagnostics } from "@/lib/admin.functions";

export function AdminPushTest() {
  const diagnose = useServerFn(pushDiagnostics);
  const run = useMutation({ mutationFn: (send: boolean) => diagnose({ data: { send } }) });
  const data = run.data;

  return (
    <section className="mt-2 border-t border-border pt-4">
      <h3 className="font-semibold">Push notifications</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Each phone or browser registers itself only after tapping “Notifications” on that device and
        allowing them. The test goes only to your own devices.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => run.mutate(false)} disabled={run.isPending}>
          Check devices
        </Button>
        <Button onClick={() => run.mutate(true)} disabled={run.isPending}>
          {run.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Send test notification to my devices
        </Button>
      </div>

      {run.isError && (
        <p className="mt-3 text-sm text-red-400">
          {run.error instanceof Error ? run.error.message : "The check could not run."}
        </p>
      )}
      {data && (
        <div className="mt-4 grid gap-2 text-sm">
          <p>
            Server push setup:{" "}
            <strong className={data.configured ? "text-emerald-400" : "text-red-400"}>
              {data.configured
                ? "configured"
                : "missing (LOVABLE_API_KEY / FIREBASE_MESSAGING_API_KEY)"}
            </strong>
          </p>
          <p>
            Registered devices: <strong>{data.allDevices}</strong> from{" "}
            <strong>{data.usersWithPush}</strong> students.
          </p>
          <p>
            Your devices: <strong>{data.myDevices.length}</strong>
            {data.myDevices.length === 0 &&
              " — none: open the app on your phone, tap Notifications and allow them."}
          </p>
          {data.myDevices.length > 0 && (
            <ul className="grid gap-1">
              {data.myDevices.map((device) => (
                <li key={device.token} className="rounded-md border border-border p-2 text-xs">
                  <span className="font-mono">{device.token}</span> · last seen{" "}
                  {new Date(device.lastSeenAt).toLocaleString()}
                  {device.result && (
                    <span
                      className={`ml-2 font-semibold ${device.result.ok ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {device.result.ok
                        ? "sent ✓"
                        : `failed ${device.result.status ?? ""}${device.result.stale ? " (device no longer valid)" : ""}`}
                    </span>
                  )}
                  {device.result && !device.result.ok && device.result.detail && (
                    <div className="mt-1 text-muted-foreground">{device.result.detail}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            “sent ✓” but nothing on the phone: the phone or browser is blocking it (for example,
            Brave needs “Use Google services for push messaging” turned on, and Android needs the
            app’s notifications allowed). Test arrives but no daily push: the daily job is not
            running.
          </p>
        </div>
      )}
    </section>
  );
}
