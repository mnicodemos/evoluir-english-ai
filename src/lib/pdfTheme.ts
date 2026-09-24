import type { jsPDF } from "jspdf";

import logoAsset from "@/assets/logo-evo-green.png.asset.json";

export const INK = { r: 20, g: 24, b: 33 };
export const MUTED = { r: 100, g: 106, b: 118 };
export const ACCENT = { r: 34, g: 168, b: 116 };
export const DARK = { r: 15, g: 19, b: 28 };
export const BRAND_GREEN = { r: 0, g: 245, b: 206 };

/** Draws a centred brand name while keeping only the Evoluir+ symbol in the official green. */
export function drawBrandName(
  doc: jsPDF,
  text: string,
  centerX: number,
  y: number,
  color: { r: number; g: number; b: number },
) {
  const plusIndex = text.indexOf("+");
  if (plusIndex < 0) {
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(text, centerX, y, { align: "center" });
    return;
  }

  const before = text.slice(0, plusIndex);
  const after = text.slice(plusIndex + 1);
  const beforeWidth = doc.getTextWidth(before);
  const plusWidth = doc.getTextWidth("+");
  const totalWidth = beforeWidth + plusWidth + doc.getTextWidth(after);
  const left = centerX - totalWidth / 2;

  doc.setTextColor(color.r, color.g, color.b);
  doc.text(before, left, y);
  doc.setTextColor(BRAND_GREEN.r, BRAND_GREEN.g, BRAND_GREEN.b);
  doc.text("+", left + beforeWidth, y);
  doc.setTextColor(color.r, color.g, color.b);
  doc.text(after, left + beforeWidth + plusWidth, y);
}

/** Loads the app logo as a data URL so jsPDF can embed it. */
export async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(logoAsset.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Draws the branded header band used by every report. */
export function drawHeader(
  doc: jsPDF,
  logo: string | null,
  opts: { title: string; subtitle: string; meta: string; margin: number },
) {
  const pageW = doc.internal.pageSize.getWidth();
  const { margin } = opts;

  doc.setFillColor(DARK.r, DARK.g, DARK.b);
  doc.rect(0, 0, pageW, 116, "F");
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, 116, pageW, 4, "F");

  let textX = margin;
  if (logo) {
    const boxD = 48;
    const centerX = margin + boxD / 2;
    const centerY = 25 + boxD / 2;
    doc.setFillColor(255, 255, 255);
    doc.circle(centerX, centerY, boxD / 2, "F");
    try {
      const image = doc.getImageProperties(logo);
      const maxW = boxD - 16;
      const maxH = boxD - 16;
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const imageW = image.width * scale;
      const imageH = image.height * scale;
      doc.addImage(
        logo,
        "PNG",
        centerX - imageW / 2,
        centerY - imageH / 2,
        imageW,
        imageH,
        undefined,
        "FAST",
      );
    } catch {
      /* logo is decorative */
    }
    textX = margin + boxD + 14;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(opts.title, textX, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(190, 196, 206);
  doc.text(opts.subtitle, textX, 66);
  doc.setFontSize(9.5);
  doc.text(opts.meta, textX, 82);
}

/** Draws the branded full-page cover used as the first page of every PDF. */
export function drawCover(
  doc: jsPDF,
  logo: string | null,
  opts: { title: string; subtitle: string; meta: string; footnote?: string },
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;

  doc.setFillColor(DARK.r, DARK.g, DARK.b);
  doc.rect(0, 0, pageW, pageH, "F");

  // Accent band
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, pageH * 0.62, pageW, 5, "F");

  // Logo in a white circle, centred
  const centerX = pageW / 2;
  let y = pageH * 0.24;
  if (logo) {
    const boxD = 96;
    doc.setFillColor(255, 255, 255);
    doc.circle(centerX, y, boxD / 2, "F");
    try {
      const image = doc.getImageProperties(logo);
      const scale = Math.min((boxD - 30) / image.width, (boxD - 30) / image.height);
      const imageW = image.width * scale;
      const imageH = image.height * scale;
      doc.addImage(
        logo,
        "PNG",
        centerX - imageW / 2,
        y - imageH / 2,
        imageW,
        imageH,
        undefined,
        "FAST",
      );
    } catch {
      /* logo is decorative */
    }
    y += boxD / 2 + 54;
  } else {
    y += 40;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  for (const line of doc.splitTextToSize(opts.title, maxW) as string[]) {
    drawBrandName(doc, line, centerX, y, { r: 255, g: 255, b: 255 });
    y += 32;
  }

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(190, 196, 206);
  for (const line of doc.splitTextToSize(opts.subtitle, maxW) as string[]) {
    doc.text(line, centerX, y, { align: "center" });
    y += 19;
  }

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
  for (const line of doc.splitTextToSize(opts.meta, maxW) as string[]) {
    doc.text(line, centerX, y, { align: "center" });
    y += 17;
  }

  if (opts.footnote) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(150, 156, 168);
    doc.text(opts.footnote, centerX, pageH - 56, { align: "center" });
  }
}

/** Draws the footer line on every page (the cover page is skipped). */
export function drawFooters(doc: jsPDF, label: string, margin: number, startPage = 2) {
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let p = startPage; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(150, 155, 165);
    doc.text(`${label} · page ${p} of ${pages}`, margin, pageH - 24);
  }
}

/** Keeps a text block short and practical for study. */
export function shorten(text: string, maxChars: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (stop > maxChars * 0.5 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}...`).trim();
}
