import type { jsPDF } from "jspdf";

/** True when the app is running inside the editor preview frame. */
export function isEmbeddedPreview() {
  return typeof window !== "undefined" && window.self !== window.top;
}

/**
 * Saves a generated PDF with a plain anchor download, which is what mobile and
 * desktop browsers support. Returns false when the page is embedded in a frame
 * that blocks downloads, so the caller can tell the user to open the app itself.
 */
export function savePdf(doc: jsPDF, filename: string): boolean {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return !isEmbeddedPreview();
}
