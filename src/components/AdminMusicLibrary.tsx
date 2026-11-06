import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Music2, Save, Volume2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSharedMusicAsset, saveSharedMusicAsset } from "@/lib/admin.functions";

export function AdminMusicLibrary() {
  const queryClient = useQueryClient();
  const getMusic = useServerFn(getSharedMusicAsset);
  const saveMusic = useServerFn(saveSharedMusicAsset);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["shared-music-asset"],
    queryFn: () => getMusic(),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (data: { dataUrl: string; mimeType: "audio/mpeg" }) => saveMusic({ data }),
    onSuccess: async () => {
      setFile(null);
      setPreviewUrl(null);
      setNotice("Music published to the shared library.");
      await queryClient.invalidateQueries({ queryKey: ["shared-music-asset"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Music could not be published."),
  });

  async function choose(next?: File) {
    setNotice("");
    if (!next) return;
    if (next.type !== "audio/mpeg" && !next.name.toLowerCase().endsWith(".mp3")) {
      setNotice("Choose an MP3 audio file.");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setNotice("The MP3 must be 10 MB or smaller.");
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  return (
    <section className="space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Music2 className="size-4" /> Music library
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload and manage a shared background track. This central music library can be connected
          to English Adventures and other areas of Evoluir+ as they adopt background audio.
        </p>
      </div>
      {query.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading current music…
        </p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Could not load the current music setting.</p>
      ) : (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-sm font-medium">Current shared track</p>
          {query.data?.url ? (
            <audio controls preload="none" className="w-full" src={query.data.url} />
          ) : (
            <p className="text-sm text-muted-foreground">No music published yet.</p>
          )}
        </div>
      )}
      <label className="block text-sm font-medium">
        Upload an MP3 to the shared music library
        <input
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          type="file"
          accept=".mp3,audio/mpeg"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        MP3 only · maximum 10 MB · preview before publishing.
      </p>
      {file && previewUrl ? (
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <p className="truncate text-xs text-muted-foreground">{file.name} · not published</p>
          <audio controls preload="metadata" className="w-full" src={previewUrl} />
        </div>
      ) : null}
      <Button
        type="button"
        className="w-full gap-2"
        disabled={!file || mutation.isPending}
        onClick={async () => {
        if (!file) return;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === "string"
              ? resolve(reader.result)
              : reject(new Error("Could not read MP3."));
          reader.onerror = () => reject(new Error("Could not read MP3."));
          reader.readAsDataURL(file);
        });
        mutation.mutate({ dataUrl, mimeType: "audio/mpeg" });
      }}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        {mutation.isPending ? "Publishing…" : "Publish to music library"}
      </Button>
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Volume2 className="size-4" /> Student playback will start only after interaction, at a low
        volume.
      </div>
    </section>
  );
}
