import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Monitor, Save, Smartphone, UserRound, Video } from "lucide-react";
import { useEffect, useState } from "react";
import evoGuide from "@/assets/evo-guide.webp";
import evoVideoCall from "@/assets/evo-video-call.jpg";
import { Button } from "@/components/ui/button";
import { AdminLessonAudioImage } from "@/components/admin/content/AdminLessonAudioImage";
import { getHomeDashboardImages, saveHomeDashboardImage } from "@/lib/admin.functions";

type Target = "desktop" | "mobile" | "evo-avatar" | "video-call";
type DraftImage = { name: string; dataUrl: string; mimeType: string };

const TARGETS: {
  key: Target;
  title: string;
  description: string;
  Icon: typeof Monitor;
}[] = [
  {
    key: "desktop",
    title: "Desktop image",
    description: "Used on desktop and larger screens.",
    Icon: Monitor,
  },
  {
    key: "mobile",
    title: "Mobile image",
    description: "Used on phones and narrow screens.",
    Icon: Smartphone,
  },
  {
    key: "evo-avatar",
    title: "EVO mascot avatar",
    description: "Shared round portrait wherever the EVO avatar is used.",
    Icon: UserRound,
  },
  {
    key: "video-call",
    title: "AI Video Call image",
    description:
      "Image shown on the full-screen video call with EVO. This setting is independent of the shared avatar.",
    Icon: Video,
  },
];

export function AdminHomeMedia() {
  const queryClient = useQueryClient();
  const getImages = useServerFn(getHomeDashboardImages);
  const saveImage = useServerFn(saveHomeDashboardImage);
  const [files, setFiles] = useState<Partial<Record<Target, DraftImage>>>({});
  const [notice, setNotice] = useState("");
  const imagesQuery = useQuery({
    queryKey: ["home-dashboard-images"],
    queryFn: () => getImages(),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: ({
      target,
      dataUrl,
      mimeType,
    }: {
      target: Target;
      dataUrl: string;
      mimeType: string;
    }) => saveImage({ data: { target, dataUrl, mimeType } }),
    onSuccess: async (_result, variables) => {
      setFiles((current) => {
        const next = { ...current };
        delete next[variables.target];
        return next;
      });
      setNotice(
        variables.target === "desktop"
          ? "Desktop image published."
          : variables.target === "mobile"
            ? "Mobile image published."
            : variables.target === "evo-avatar"
              ? "EVO mascot avatar published."
              : "AI Video Call image published.",
      );
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard-images"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard-image-public"] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "The image could not be saved."),
  });

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function selectFile(target: Target, file?: File) {
    setNotice("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setNotice("The image must be 3 MB or smaller.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Could not read image."));
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
    setFiles((current) => ({
      ...current,
      [target]: { name: file.name, dataUrl, mimeType: file.type },
    }));
  }

  return (
    <section className="mt-2 space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <ImagePlus className="size-4" /> Home dashboard images
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload and publish desktop and mobile images independently. Desktop: use a 4:3 image
          (about 1580 × 1180 px) with EVO in the centre; it fills the card's image column and the
          edges may be trimmed, never stretched.
        </p>
      </div>
      {imagesQuery.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading current images…
        </div>
      ) : imagesQuery.isError ? (
        <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          The current dashboard images could not be loaded.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {TARGETS.map(({ key, title, description, Icon }) => {
            const draft = files[key];
            const current =
              key === "evo-avatar"
                ? (imagesQuery.data?.evoAvatar ?? evoGuide)
                : key === "video-call"
                  ? (imagesQuery.data?.videoCall ?? evoVideoCall)
                  : imagesQuery.data?.[key];
            const saving = mutation.isPending && mutation.variables?.target === key;

            return (
              <article
                key={key}
                className="min-w-0 space-y-3 rounded-lg border border-border p-3 sm:p-4"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <h4 className="font-semibold">{title}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                <div
                  className={
                    key === "evo-avatar"
                      ? "flex justify-center rounded-lg border border-border bg-muted p-4"
                      : key === "video-call"
                        ? "mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted"
                        : "overflow-hidden rounded-lg border border-border bg-muted"
                  }
                >
                  {draft?.dataUrl || current ? (
                    <img
                      src={draft?.dataUrl ?? current ?? undefined}
                      alt={draft ? `Preview: ${draft.name}` : `Current ${key} image`}
                      onError={(event) => {
                        event.currentTarget.style.visibility = "hidden";
                      }}
                      className={
                        key === "evo-avatar"
                          ? "size-32 rounded-full object-cover ring-2 ring-brand-green/60"
                          : key === "video-call"
                            ? "block size-full scale-[1.1] object-cover [object-position:50%_30%]"
                            : key === "desktop"
                              ? "block aspect-[4/3] w-full object-cover"
                              : "block max-h-64 w-full object-contain"
                      }
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={
                        key === "evo-avatar"
                          ? "size-32 rounded-full bg-muted animate-pulse"
                          : key === "video-call"
                            ? "aspect-square w-full animate-pulse bg-muted"
                            : "aspect-[4/3] w-full animate-pulse bg-muted"
                      }
                    />
                  )}
                </div>
                {draft ? (
                  <p className="truncate text-xs text-muted-foreground">
                    Preview: {draft.name} — not published yet
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Currently published</p>
                )}
                <label className="block text-sm font-medium">
                  Choose image
                  <input
                    className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void selectFile(key, event.target.files?.[0])}
                  />
                </label>
                <p className="text-xs text-muted-foreground">JPG, PNG or WebP · maximum 3 MB</p>
                <Button
                  type="button"
                  className="w-full gap-2"
                  disabled={!draft || mutation.isPending}
                  onClick={() =>
                    draft &&
                    mutation.mutate({
                      target: key,
                      dataUrl: draft.dataUrl,
                      mimeType: draft.mimeType,
                    })
                  }
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {saving ? "Publishing…" : "Publish image"}
                </Button>
              </article>
            );
          })}
        </div>
      )}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      <AdminLessonAudioImage />
    </section>
  );
}
