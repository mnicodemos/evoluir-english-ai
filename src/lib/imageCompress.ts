/**
 * Admin image uploads are resized and turned into WebP in the browser before
 * they are sent (user report, 2026-10-29: Admin images loaded after the rest
 * of the page; the original photo, up to 3 MB, went to every phone). Each slot
 * gets the width it is shown at, doubled for sharp screens.
 */

/** The widest the image is ever drawn, in device pixels. */
export const ADMIN_IMAGE_MAX_WIDTH = {
  desktop: 1600,
  "evo-avatar": 384,
  "video-call": 1200,
  "lesson-audio": 1200,
  // The weekly league symbol: a 160 px circle at most, so 640 covers sharp screens.
  league: 640,
} as const;

export const ADMIN_IMAGE_QUALITY = 0.82;

/** The size an image of width x height takes once it fits maxWidth (never enlarged). */
export function fitWidth(width: number, height: number, maxWidth: number) {
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.round((height * maxWidth) / width) };
}

export type CompressedImage = {
  dataUrl: string;
  mimeType: "image/webp" | "image/jpeg" | "image/png";
};

/**
 * The file resized to maxWidth and encoded as WebP (JPEG where the browser
 * cannot write WebP). Answers null when the browser cannot decode the file,
 * so the caller can send the original instead.
 */
export async function compressImageFile(
  file: File,
  maxWidth: number,
): Promise<CompressedImage | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const size = fitWidth(bitmap.width, bitmap.height, maxWidth);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", ADMIN_IMAGE_QUALITY);
  if (webp.startsWith("data:image/webp")) return { dataUrl: webp, mimeType: "image/webp" };
  // Safari before 14 writes PNG for an unsupported type; JPEG keeps it small.
  return { dataUrl: canvas.toDataURL("image/jpeg", ADMIN_IMAGE_QUALITY), mimeType: "image/jpeg" };
}

/** The bytes a base64 data URL holds. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
