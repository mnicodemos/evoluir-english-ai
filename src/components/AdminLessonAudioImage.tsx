import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { getLessonAudioImage, saveLessonAudioImage } from "@/lib/lessonAudioMedia.functions";

type Draft = {
  name: string;
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export function AdminLessonAudioImage() {
  const queryClient = useQueryClient();
  const getImage = useServerFn(getLessonAudioImage);
  const saveImage = useServerFn(saveLessonAudioImage);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const imageQuery = useQuery({
    queryKey: ["lesson-audio-image"],
    queryFn: () => getImage(),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (image: Draft) =>
      saveImage({ data: { dataUrl: image.dataUrl, mimeType: image.mimeType } }),
    onSuccess: async () => {
      setDraft(null);
      setImageFailed(false);
      setNotice("Lesson Audio image published.");
      await queryClient.invalidateQueries({ queryKey: ["lesson-audio-image"] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "The image could not be published."),
  });

  async function selectFile(file?: File) {
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

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      setImageFailed(false);
      setDraft({ name: file.name, dataUrl, mimeType: file.type as Draft["mimeType"] });
    } catch {
      setNotice("Could not read the selected image.");
    }
  }

  const current = draft?.dataUrl ?? imageQuery.data?.imageUrl ?? null;


  return (
    <section className="mt-5 space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <ImagePlus className="size-4" /> Lesson Audio image
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Independent image for the Lesson Audio tab in Review I and Review II across A1–C2. The
          Home dashboard and EVO avatar are not affected.
        </p>
      </div>
      {imageQuery.isPending ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading current image…
        </div>
      ) : imageQuery.isError ? (
        <p className="text-sm text-destructive">
          The current Lesson Audio image could not be loaded.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
          <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {current && !imageFailed ? (
              <img
                src={current}
                alt={draft ? `Preview: ${draft.name}` : "Current Lesson Audio image"}
                onError={() => setImageFailed(true)}
                className="block max-h-64 w-full object-contain"
              />
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {current ? "The image could not be loaded. Choose another image to replace it." : "No Lesson Audio image is published yet. Choose an image to get started."}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Choose image
              <input
                className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void selectFile(event.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              JPG, PNG or WebP · maximum 3 MB. Preview before publishing.
            </p>
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
              {mutation.isPending ? "Publishing…" : "Publish image"}
            </Button>
            {notice ? (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
