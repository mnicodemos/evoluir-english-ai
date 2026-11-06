import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAdventureWelcomeAudio, saveAdventureWelcomeAudio } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type Voice = "roberta" | "arabella";

function WelcomeAudioSlot({ voice, label }: { voice: Voice; label: string }) {
  const { lang } = useUiLang();
  const t = (value: string) => (lang === "pt" ? (uiPt[value] ?? value) : value);
  const queryClient = useQueryClient();
  const getAudio = useServerFn(getAdventureWelcomeAudio);
  const saveAudio = useServerFn(saveAdventureWelcomeAudio);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const query = useQuery({
    queryKey: ["adventure-welcome-audio", voice],
    queryFn: () => getAudio({ data: { voice } }),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (dataUrl: string) =>
      saveAudio({ data: { voice, dataUrl, mimeType: "audio/mpeg" } }),
    onSuccess: async () => {
      setFile(null);
      setPreviewUrl(null);
      setNotice(t("EVO welcome audio published."));
      await queryClient.invalidateQueries({ queryKey: ["adventure-welcome-audio", voice] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : t("The audio could not be published.")),
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function choose(next?: File) {
    setNotice("");
    if (!next) return;
    if (next.type !== "audio/mpeg" && !next.name.toLowerCase().endsWith(".mp3")) {
      setNotice(t("Choose an MP3 audio file."));
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setNotice(t("The MP3 must be 10 MB or smaller."));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  async function publish() {
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
    mutation.mutate(dataUrl);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        <span className="text-xs text-muted-foreground">
          {query.data ? t("Published") : query.isPending ? t("Loading") : t("Not published yet")}
        </span>
      </div>
      {query.data?.url ? (
        <audio controls preload="none" className="w-full" src={query.data.url} />
      ) : null}
      <label className="block text-sm font-medium">
        {t("Select the welcome MP3")}
        <input
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          type="file"
          accept=".mp3,audio/mpeg"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </label>
      {file && previewUrl ? (
        <div className="space-y-2 rounded-md bg-muted p-3">
          <p className="truncate text-xs text-muted-foreground">
            {file.name} · {t("Not published")}
          </p>
          <audio controls preload="metadata" className="w-full" src={previewUrl} />
        </div>
      ) : null}
      <Button
        type="button"
        className="w-full gap-2"
        disabled={!file || mutation.isPending}
        onClick={() => void publish()}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        {mutation.isPending ? t("Publishing…") : t("Publish welcome audio")}
      </Button>
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

export function AdminAdventureWelcomeAudio() {
  const { lang } = useUiLang();
  const t = (value: string) => (lang === "pt" ? (uiPt[value] ?? value) : value);

  return (
    <section className="space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Volume2 className="size-4" /> {t("EVO adventure welcome")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Upload the two short EVO voice introductions. The student hears the selected welcome first, then the adventure soundtrack starts automatically.",
          )}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <WelcomeAudioSlot voice="roberta" label={t("Roberta · Friendly welcome (default)")} />
        <WelcomeAudioSlot voice="arabella" label={t("Arabella · Mysterious welcome")} />
      </div>
      <p className="text-xs text-muted-foreground">{t("MP3 only · maximum 10 MB per file.")}</p>
    </section>
  );
}
