/** Promotional templates must never enter the managed app-email service. */
export function assertAppEmailAllowed(templateName: string): void {
  if (templateName === "premium-benefits") {
    throw new Error("Premium promotions require a dedicated marketing email service.");
  }
}
