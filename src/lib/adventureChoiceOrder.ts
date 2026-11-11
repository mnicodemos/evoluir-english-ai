/**
 * Returns a deterministic rotation of choice indexes for an adventure step.
 * The persisted choice remains the original index, so existing checkpoints stay valid.
 */
export function getStableAdventureChoiceOrder(
  adventureId: string,
  stepIndex: number,
  choiceCount: number,
): number[] {
  if (!Number.isInteger(choiceCount) || choiceCount <= 1) {
    return Array.from({ length: Math.max(0, choiceCount) }, (_, index) => index);
  }

  const adventureOffset =
    Array.from(adventureId).reduce((total, character) => total + character.charCodeAt(0), 0) %
    choiceCount;
  const rotation = (((stepIndex + adventureOffset) % choiceCount) + choiceCount) % choiceCount;

  return Array.from({ length: choiceCount }, (_, index) => (index + rotation) % choiceCount);
}
