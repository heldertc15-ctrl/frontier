/** Keep sub-10 kg catches precise without padding larger fish with a third decimal. */
export function formatFishWeightKg(weightKg: number): string {
  const roundedToThree = Number(weightKg.toFixed(3));
  return weightKg.toFixed(roundedToThree < 10 ? 3 : 2);
}
