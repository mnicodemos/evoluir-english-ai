import type { jsPDF } from "jspdf";

import { ACCENT, DARK, INK, MUTED } from "@/lib/pdfTheme";

const BODY: [number, number, number] = [58, 63, 74];

/**
 * Workbook layout engine shared by every study PDF: a branded cover, full-page
 * section dividers, numbered lesson entries with examples and reminders, and a
 * running head/footer on each content page.
 */
export function createWorkbook(
  doc: jsPDF,
  logo: string | null,
  opts: { brand: string; levelLabel: string; docTitle: string },
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 52;
  const contentW = pageW - margin * 2;
  const bottom = pageH - 62;

  let section = opts.docTitle;
  let y = 0;

  const drawLogo = (centerX: number, centerY: number, diameter: number) => {
    doc.setFillColor(255, 255, 255);
    doc.circle(centerX, centerY, diameter / 2, "F");
    if (!logo) return;
    try {
      const image = doc.getImageProperties(logo);
      const scale = Math.min((diameter - 14) / image.width, (diameter - 14) / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      doc.addImage(logo, "PNG", centerX - w / 2, centerY - h / 2, w, h, undefined, "FAST");
    } catch {
      /* the logo is decorative */
    }
  };

  /** Running head printed at the top of every content page. */
  const runningHead = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text(section.toUpperCase(), margin, 52);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(opts.levelLabel.toUpperCase(), pageW - margin, 52, { align: "right" });
    doc.setDrawColor(222, 226, 232);
    doc.setLineWidth(0.8);
    doc.line(margin, 60, pageW - margin, 60);
    y = 88;
  };

  const newPage = () => {
    doc.addPage();
    runningHead();
  };

  const space = (needed: number) => {
    if (y + needed > bottom) newPage();
  };

  const api = {
    get y() {
      return y;
    },
    set y(value: number) {
      y = value;
    },
    margin,
    contentW,
    space,
    newPage,

    /** Front cover of the workbook. */
    cover(info: { title: string; subtitle: string; footnote?: string }) {
      doc.setFillColor(DARK.r, DARK.g, DARK.b);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.rect(0, 0, 10, pageH, "F");

      drawLogo(pageW / 2, pageH * 0.22, 92);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      doc.setTextColor(255, 255, 255);
      doc.text("WORKBOOK", pageW / 2, pageH * 0.38, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(190, 196, 206);
      doc.text(opts.brand, pageW / 2, pageH * 0.38 + 26, { align: "center" });

      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.rect(margin, pageH * 0.48, contentW, 4, "F");

      let cy = pageH * 0.48 + 46;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      for (const line of doc.splitTextToSize(info.title.toUpperCase(), contentW) as string[]) {
        doc.text(line, margin, cy);
        cy += 28;
      }
      cy += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12.5);
      doc.setTextColor(190, 196, 206);
      for (const line of doc.splitTextToSize(info.subtitle, contentW) as string[]) {
        doc.text(line, margin, cy);
        cy += 18;
      }
      cy += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.text(opts.levelLabel.toUpperCase(), margin, cy);

      if (info.footnote) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(150, 156, 168);
        doc.text(info.footnote, margin, pageH - 56);
      }
    },

    /** Full-page divider that opens a part of the workbook. */
    divider(name: string, subtitle?: string) {
      doc.addPage();
      section = name;
      doc.setFillColor(DARK.r, DARK.g, DARK.b);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.rect(0, 0, 10, pageH, "F");

      drawLogo(margin + 26, 96, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(190, 196, 206);
      doc.text(`${opts.brand} · ${opts.levelLabel}`, margin, pageH * 0.45);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      let dy = pageH * 0.45 + 34;
      for (const line of doc.splitTextToSize(name.toUpperCase(), contentW) as string[]) {
        doc.text(line, margin, dy);
        dy += 32;
      }
      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
        for (const line of doc.splitTextToSize(subtitle, contentW) as string[]) {
          doc.text(line, margin, dy + 6);
          dy += 18;
        }
      }
      newPage();
    },

    /** Lesson title in the workbook style: "LESSON 01: TOPIC". */
    lesson(number: number | string, title: string) {
      space(70);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(INK.r, INK.g, INK.b);
      const label = `LESSON ${String(number).padStart(2, "0")}: ${title.toUpperCase()}`;
      for (const line of doc.splitTextToSize(label, contentW) as string[]) {
        space(24);
        doc.text(line, margin, y);
        y += 20;
      }
      doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.setLineWidth(1.6);
      doc.line(margin, y - 6, margin + 64, y - 6);
      y += 12;
    },

    /** Small green label above a block of content. */
    label(text: string) {
      space(26);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.text(text.toUpperCase(), margin, y);
      y += 14;
    },

    /** Sub-heading inside a section. */
    heading(text: string) {
      space(40);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.setTextColor(INK.r, INK.g, INK.b);
      for (const line of doc.splitTextToSize(text, contentW) as string[]) {
        space(20);
        doc.text(line, margin, y);
        y += 17;
      }
      y += 4;
    },

    para(
      text: string,
      o?: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number; indent?: number },
    ) {
      const size = o?.size ?? 10;
      const indent = o?.indent ?? 0;
      const lineH = size * 1.5;
      doc.setFont("helvetica", o?.bold ? "bold" : "normal");
      doc.setFontSize(size);
      const [r, g, b] = o?.color ?? BODY;
      doc.setTextColor(r, g, b);
      for (const line of doc.splitTextToSize(text, contentW - indent) as string[]) {
        space(lineH + 2);
        doc.text(line, margin + indent, y);
        y += lineH;
      }
      y += o?.gap ?? 6;
    },

    bullet(text: string, o?: { size?: number; color?: [number, number, number] }) {
      const size = o?.size ?? 10;
      const lineH = size * 1.5;
      const lines = doc.splitTextToSize(text, contentW - 18) as string[];
      lines.forEach((line, i) => {
        space(lineH + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        const [r, g, b] = o?.color ?? BODY;
        doc.setTextColor(r, g, b);
        if (i === 0) doc.text("•", margin + 2, y);
        doc.text(line, margin + 18, y);
        y += lineH;
      });
      y += 3;
    },

    /** Numbered vocabulary/grammar entry: bold term, then the definition. */
    entry(number: number, term: string, definition: string) {
      const size = 10;
      const lineH = size * 1.5;
      const prefix = `${number}. ${term}: `;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(size);
      const prefixW = doc.getTextWidth(prefix);
      space(lineH * 2);
      doc.setTextColor(INK.r, INK.g, INK.b);
      doc.text(prefix, margin, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(BODY[0], BODY[1], BODY[2]);
      const first = doc.splitTextToSize(definition, contentW - prefixW) as string[];
      const head = first[0] ?? "";
      doc.text(head, margin + prefixW, y);
      y += lineH;
      const rest = definition.slice(head.length).trim();
      if (rest) {
        for (const line of doc.splitTextToSize(rest, contentW - 14) as string[]) {
          space(lineH + 2);
          doc.text(line, margin + 14, y);
          y += lineH;
        }
      }
      y += 3;
    },

    /** "E.g.:" example line, italicised by the accent colour. */
    example(text: string) {
      const lineH = 13.5;
      const lines = doc.splitTextToSize(`E.g.: ${text}`, contentW - 18) as string[];
      lines.forEach((line, i) => {
        space(lineH + 2);
        doc.setFont("helvetica", i === 0 ? "bold" : "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
        doc.text(line, margin + 18, y);
        y += lineH;
      });
      y += 4;
    },

    /** Tinted reminder / tip box. */
    note(label: string, text: string) {
      const lines = doc.splitTextToSize(text, contentW - 28) as string[];
      const boxH = 24 + lines.length * 13;
      space(boxH + 10);
      doc.setFillColor(243, 246, 244);
      doc.roundedRect(margin, y - 4, contentW, boxH, 7, 7, "F");
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.rect(margin, y - 4, 3.5, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.text(label.toUpperCase(), margin + 14, y + 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(BODY[0], BODY[1], BODY[2]);
      let ny = y + 25;
      for (const line of lines) {
        doc.text(line, margin + 14, ny);
        ny += 13;
      }
      y += boxH + 12;
    },

    /** Simple 4-column table row helper used by the irregular verbs list. */
    row(cells: [string, string, string, string], opts?: { header?: boolean }) {
      space(20);
      const xs = [margin, margin + 110, margin + 215, margin + 330];
      doc.setFont("helvetica", opts?.header ? "bold" : "normal");
      doc.setFontSize(opts?.header ? 8.5 : 9.5);
      cells.forEach((cell, i) => {
        if (opts?.header) doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
        else doc.setTextColor(i === 3 ? MUTED.r : INK.r, i === 3 ? MUTED.g : INK.g, i === 3 ? MUTED.b : INK.b);
        doc.text(opts?.header ? cell.toUpperCase() : cell, xs[i] ?? margin, y);
      });
      y += opts?.header ? 15 : 13;
    },

    /** Page footers on every page except the cover. */
    finish() {
      const pages = doc.getNumberOfPages();
      for (let p = 2; p <= pages; p += 1) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(150, 155, 165);
        doc.text(`${opts.brand} | WORKBOOK`, margin, pageH - 32);
        doc.text(`${p - 1}`, pageW - margin, pageH - 32, { align: "right" });
      }
    },
  };

  return api;
}

export type WorkbookApi = ReturnType<typeof createWorkbook>;
