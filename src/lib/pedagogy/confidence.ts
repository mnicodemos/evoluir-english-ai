import { confidenceSchema } from "./contracts";

export type ConfidenceEvidence = {
  score: number;
  evidenceQuality: number;
  sourceReliability: number;
  sampleWeight: number;
};

export type ConfidenceConfig = {
  targetEvidenceCount: number;
  quantityWeight: number;
  qualityWeight: number;
  reliabilityWeight: number;
  consistencyWeight: number;
  consistencySpread: number;
};

export const INITIAL_CONFIDENCE_CONFIG: ConfidenceConfig = {
  targetEvidenceCount: 4,
  quantityWeight: 0.3,
  qualityWeight: 0.25,
  reliabilityWeight: 0.25,
  consistencyWeight: 0.2,
  consistencySpread: 50,
};

export function assertConfidence(value: number): number {
  return confidenceSchema.parse(value);
}

function weightedMean(
  values: readonly ConfidenceEvidence[],
  key: "evidenceQuality" | "sourceReliability",
) {
  const totalWeight = values.reduce((sum, evidence) => sum + evidence.sampleWeight, 0);
  return (
    values.reduce((sum, evidence) => sum + evidence[key] * evidence.sampleWeight, 0) / totalWeight
  );
}

export function calculateConfidence(
  evidence: readonly ConfidenceEvidence[],
  weightedScore: number,
  config: ConfidenceConfig = INITIAL_CONFIDENCE_CONFIG,
): number {
  if (evidence.length === 0) throw new RangeError("Confidence requires evidence");
  const quantity = Math.min(evidence.length / config.targetEvidenceCount, 1);
  const quality = weightedMean(evidence, "evidenceQuality");
  const reliability = weightedMean(evidence, "sourceReliability");
  const weightedVariance =
    evidence.reduce(
      (sum, item) => sum + item.sampleWeight * Math.pow(item.score - weightedScore, 2),
      0,
    ) / evidence.reduce((sum, item) => sum + item.sampleWeight, 0);
  const consistency = Math.max(0, 1 - Math.sqrt(weightedVariance) / config.consistencySpread);
  const confidence =
    quantity * config.quantityWeight +
    quality * config.qualityWeight +
    reliability * config.reliabilityWeight +
    consistency * config.consistencyWeight;
  return assertConfidence(Math.round(confidence * 1000) / 1000);
}
