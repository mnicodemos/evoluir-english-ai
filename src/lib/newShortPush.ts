/**
 * The push a student gets when a new short is published for their level
 * (owner request, 2026-10-31). Premium students are invited to watch it; free
 * students see it is part of Premium, since the link opens a locked list.
 */
export const NEW_SHORT_PATH = "/learning/videos";

export function newShortPush(videoTitle: string, premium: boolean) {
  const title = videoTitle.trim().slice(0, 80);
  return {
    title: "🎬 Novo Short no seu nível",
    body: premium
      ? `${title}. Assista agora em Vídeos extras.`
      : `${title}. Disponível no Premium, em Vídeos extras.`,
    path: NEW_SHORT_PATH,
  };
}

export type NewShortPushResult = {
  students: number;
  devices: number;
  sent: number;
  /** Why nothing could be sent, in the Admin's language; null when it ran. */
  problem: string | null;
};
