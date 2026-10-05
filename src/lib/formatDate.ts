/**
 * Formats a date in a way that cannot be misread across locales.
 * "10/2/2026" is 2 October in the US and 10 February in Brazil, so we always
 * spell out the month: "2 Oct 2026" (en) or "2 de out. de 2026" (pt).
 */
export function formatDate(
  value: Date | string | number,
  lang: "en" | "pt" = "en",
  month: "short" | "long" = "short",
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "pt" ? "pt-BR" : "en-GB", {
    day: "numeric",
    month,
    year: "numeric",
  });
}
