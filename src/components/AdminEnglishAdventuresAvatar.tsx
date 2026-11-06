import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getHomeDashboardImages, saveHomeDashboardImage } from "@/lib/admin.functions";
import { ADMIN_IMAGE_MAX_WIDTH, compressImageFile, dataUrlBytes } from "@/lib/imageCompress";

type Draft = { name: string; dataUrl: string; mimeType: string };

export function AdminEnglishAdventuresAvatar() {
  const queryClient = useQueryClient();
  const getImages = useServerFn(getHomeDashboardImages);
  const saveImage = useServerFn(saveHomeDashboardImage);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const images = useQuery({
    queryKey: ["home-dashboard-images"],
    queryFn: () => getImages(),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (image: Draft) =>
      saveImage({
        data: {
          target: "english-adventures-avatar",
          dataUrl: image.dataUrl,
          mimeType: image.mimeType,
        },
      }),
    onSuccess: async () => {
      setDraft(null);
      setNotice("English Adventures avatar published.");
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard-images"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard-image-public"] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "The avatar could not be published."),
  });

  async function selectImage(file?: File) {
    setNotice("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice("Choose a JPG, PNG or WebP image.");
      return;
    }
    const compressed = await compressImageFile(
      file,
      ADMIN_IMAGE_MAX_WIDTH["english-adventures-avatar"],
    );
    const dataUrl =
      compressed?.dataUrl ??
      (await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      }));
    const mimeType = compressed?.mimeType ?? file.type;
    if (dataUrlBytes(dataUrl) > 3 * 1024 * 1024) {
      setNotice("The image must be 3 MB or smaller.");
      return;
    }
    setDraft({ name: file.name, dataUrl, mimeType });
  }

  const current = images.data?.englishAdventuresAvatar;

  return (
    <section className="mt-2 space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <ImagePlus className="size-4" /> English Adventures avatar
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This image is used only in the English Adventures Dashboard card and the English
          Adventures page. It does not change EVO's global avatar.
        </p>
      </div>
      {images.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading current avatar…
        </div>
      ) : images.isError ? (
        <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          The current avatar could not be loaded.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-sm font-medium">Currently published</p>
            <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-muted p-4">
              {current ? (
                <img
                  src={current}
                  alt="Published English Adventures EVO avatar"
                  className="size-40 rounded-full object-cover ring-2 ring-brand-green/60"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No dedicated image published yet.</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">New image preview</p>
            <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-muted p-4">
              {draft ? (
                <img
                  src={draft.dataUrl}
                  alt={`Preview: ${draft.name}`}
                  className="size-40 rounded-full object-cover ring-2 ring-brand-green/60"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Choose an image to preview it here.</p>
              )}
            </div>
            {draft ? (
              <p className="truncate text-xs text-muted-foreground">
                {draft.name} · not published yet
              </p>
            ) : null}
          </div>
        </div>
      )}
      <label className="block text-sm font-medium">
        Choose EVO's English Adventures image
        <input
          className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void selectImage(event.target.files?.[0])}
        />
      </label>
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP · maximum 3 MB</p>
      <Button
        type="button"
        className="w-full gap-2"
        disabled={!draft || mutation.isPending}
        onClick={() => draft && mutation.mutate(draft)}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        {mutation.isPending ? "Publishing…" : "Publish English Adventures avatar"}
      </Button>
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
