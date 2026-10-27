import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Play, Save, Trash2, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  deleteSummaryVideoLink,
  getSummaryVideoLinks,
  saveSummaryVideoLink,
} from "@/lib/admin.functions";

const LEVELS = [
  { value: "a1", label: "A1" },
  { value: "a2", label: "A2" },
  { value: "b1", label: "B1" },
  { value: "b2", label: "B2" },
  { value: "c1", label: "C1" },
  { value: "c2", label: "C2" },
  { value: "business", label: "Business English" },
] as const;

function getVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match?.[1] ?? null;
}

export function AdminSummaryVideoManager() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]["value"]>("b1");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const queryClient = useQueryClient();
  const fetchLinks = useServerFn(getSummaryVideoLinks);
  const saveLink = useServerFn(saveSummaryVideoLink);
  const deleteLink = useServerFn(deleteSummaryVideoLink);

  const linksQuery = useQuery({
    queryKey: ["admin-summary-video-links", level],
    queryFn: () => fetchLinks({ data: { level } }),
    retry: false,
  });

  useEffect(() => {
    if (linksQuery.data) {
      setDrafts((current) => {
        const next = { ...current };
        for (const item of linksQuery.data) {
          next[item.key] = item.videoUrl ?? "";
        }
        return next;
      });
    }
  }, [linksQuery.data]);

  const saveMutation = useMutation({
    mutationFn: ({ key, url }: { key: string; url: string }) => saveLink({ data: { key, url } }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-summary-video-links", level] });
      await queryClient.invalidateQueries({ queryKey: ["lesson"] });
      setDrafts((current) => ({ ...current, [variables.key]: variables.url }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteLink({ data: { key } }),
    onSuccess: async (_result, key) => {
      setDrafts((current) => ({ ...current, [key]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["admin-summary-video-links", level] });
      await queryClient.invalidateQueries({ queryKey: ["lesson"] });
    },
  });

  const visibleLessons = (linksQuery.data ?? []).filter((item) =>
    `${item.unit} ${item.position} ${item.title} ${item.key}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <section className="mt-2 space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Video className="size-4" />
          Summary video links
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the Vimeo link displayed in each lesson's student-facing Summary. Changes are
          written directly to the lessons table used by Summary; the legacy Videos table is not used.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr]">
        <label className="text-sm">
          Level / course
          <select
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
            value={level}
            onChange={(event) => setLevel(event.target.value as (typeof LEVELS)[number]["value"])}
          >
            {LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Find a lesson
          <input
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Lesson title or unit"
          />
        </label>
      </div>

      {linksQuery.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading lessons…
        </div>
      ) : linksQuery.isError ? (
        <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {linksQuery.error instanceof Error
            ? linksQuery.error.message
            : "The Summary video links could not be loaded."}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {(linksQuery.data ?? []).filter((item) => item.videoUrl).length} of {
              (linksQuery.data ?? []).length
            } lessons have a Vimeo link.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleLessons.map((item) => {
              const draft = drafts[item.key] ?? "";
              const savedUrl = item.videoUrl ?? "";
              const isSaving = saveMutation.isPending && saveMutation.variables?.key === item.key;
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === item.key;
              return (
                <article key={item.key} className="rounded-lg border border-border p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {level === "business" ? "Business English" : level.toUpperCase()} · Unit{" "}
                        {item.unit}, Lesson {item.position}
                      </p>
                      <h4 className="mt-1 font-medium">{item.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.copiesWithVideo} of {item.copies} lesson records currently have a link.
                      </p>
                  </div>
                  {savedUrl ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
                      <Check className="size-3" /> Video saved
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      No video
                    </span>
                  )}
                </div>

                {item.hasConflictingLinks && (
                  <p className="mt-2 text-xs text-amber-600">
                    Different links exist across lesson records. Saving one link below will
                    synchronize all records for this lesson.
                  </p>
                )}

                {savedUrl && getVimeoVideoId(savedUrl) ? (
                  <a
                    href={savedUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open Vimeo video for ${item.title}`}
                    className="group relative mt-3 block overflow-hidden rounded-md bg-muted"
                  >
                    <img
                      src={`https://vumbnail.com/${getVimeoVideoId(savedUrl)}.jpg`}
                      alt={`Video thumbnail: ${item.title}`}
                      loading="lazy"
                      className="aspect-video w-full object-cover transition-opacity group-hover:opacity-90"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/30">
                      <span className="flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg">
                        <Play className="ml-1 size-5 fill-current" />
                      </span>
                    </span>
                  </a>
                ) : null}

                <label className="mt-3 block text-sm">
                  Vimeo URL
                  <input
                    className="mt-1 block w-full min-w-0 rounded-md border border-border bg-background px-3 py-2"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://vimeo.com/123456789"
                    value={draft}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [item.key]: event.target.value }))
                    }
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={
                      !draft.trim() ||
                      draft.trim() === savedUrl ||
                      isSaving ||
                      isDeleting ||
                      saveMutation.isPending ||
                      deleteMutation.isPending
                    }
                    onClick={() => saveMutation.mutate({ key: item.key, url: draft.trim() })}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    Save Vimeo link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !savedUrl ||
                      isSaving ||
                      isDeleting ||
                      saveMutation.isPending ||
                      deleteMutation.isPending
                    }
                    onClick={() => {
                      if (window.confirm("Remove this video link from Summary for this lesson?")) {
                        deleteMutation.mutate(item.key);
                      }
                    }}
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 size-4" />
                    )}
                    Remove link
                  </Button>
                  {draft.trim() === savedUrl && savedUrl && (
                    <span className="self-center text-xs text-muted-foreground">
                      No unsaved changes
                    </span>
                  )}
                </div>
                {saveMutation.isError && saveMutation.variables?.key === item.key && (
                  <p className="mt-2 text-sm text-destructive">
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : "The link could not be saved."}
                  </p>
                )}
                {deleteMutation.isError && deleteMutation.variables === item.key && (
                  <p className="mt-2 text-sm text-destructive">
                    {deleteMutation.error instanceof Error
                      ? deleteMutation.error.message
                      : "The link could not be removed."}
                  </p>
                )}
                {saveMutation.isSuccess && saveMutation.variables?.key === item.key && (
                  <p className="mt-2 text-sm text-emerald-600">Vimeo link saved to Summary.</p>
                )}
              </article>
            );
          })}
          </div>
          {visibleLessons.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">
              No lessons match your search.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
