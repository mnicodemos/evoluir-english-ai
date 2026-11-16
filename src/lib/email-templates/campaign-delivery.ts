export function assertCampaignDeliveryCanStart(status: string | null): void {
  if (status === "sent") {
    throw new Error("This campaign has already been sent to this student.");
  }
  if (status === "pending") {
    throw new Error("This campaign is already being processed for this student.");
  }
}
