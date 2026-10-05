/**
 * Whether an FCM send failure means the device token itself is dead.
 * A 400 can also come from the message payload, so a 400 counts only when FCM
 * names the registration token; otherwise valid devices would be deleted.
 */
export function isStaleTokenResponse(status: number, body: string): boolean {
  if (status === 404 || /UNREGISTERED/.test(body)) return true;
  return status === 400 && /registration token/i.test(body);
}
