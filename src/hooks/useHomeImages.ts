import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { getHomeDashboardImages } from "@/lib/admin.functions";
import { getLessonAudioImage } from "@/lib/lessonAudioMedia.functions";

export type HomeImages = Awaited<ReturnType<typeof getHomeDashboardImages>>;

const HOME_IMAGES_KEY = "evoluir-home-images";
const LESSON_AUDIO_IMAGE_KEY = "evoluir-lesson-audio-image";

/** The value kept on this device, read after mount so server and client render alike. */
function useKept<T>(key: string): T | undefined {
  const [kept, setKept] = useState<T | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      setKept(raw ? (JSON.parse(raw) as T) : undefined);
    } catch {
      setKept(undefined);
    }
  }, [key]);
  return kept;
}

function keep(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the image simply waits for the server again.
  }
}

/**
 * The images the owner sets in Admin → Content → Home images (Dashboard
 * desktop and mobile, EVO's avatar, the video call). The links are kept on the
 * device (user report, 2026-10-29: images loaded after the rest of the page,
 * since the download could only start once the server had answered), so on
 * the next visit the browser asks for the image at once, usually from its own
 * cache, while the fresh links load.
 */
export function useHomeImages() {
  const load = useServerFn(getHomeDashboardImages);
  const kept = useKept<HomeImages>(HOME_IMAGES_KEY);
  return useQuery({
    queryKey: ["home-dashboard-image-public"],
    queryFn: async () => {
      const images = await load();
      keep(HOME_IMAGES_KEY, images);
      return images;
    },
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: () => kept,
  });
}

/** The Lesson audio image (Admin → Content → Home images), kept like useHomeImages. */
export function useLessonAudioImage() {
  const load = useServerFn(getLessonAudioImage);
  const kept = useKept<Awaited<ReturnType<typeof getLessonAudioImage>>>(LESSON_AUDIO_IMAGE_KEY);
  return useQuery({
    queryKey: ["lesson-audio-image"],
    queryFn: async () => {
      const image = await load();
      keep(LESSON_AUDIO_IMAGE_KEY, image);
      return image;
    },
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: () => kept,
  });
}
