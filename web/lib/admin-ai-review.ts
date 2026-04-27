export type AiReviewDecision = 'accept' | 'reject' | 'needs_human';

export type AiReviewResult = {
  decision: AiReviewDecision;
  confidence: number | null;
  qualityScore: number | null;
  reasons: string[];
  rationale: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeDecision(value: unknown): AiReviewDecision | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'accept' || normalized === 'reject' || normalized === 'needs_human') {
    return normalized;
  }
  return null;
}

function parseAiReview(input: unknown): AiReviewResult | null {
  const raw = asObject(input);
  if (!raw) return null;

  const decision = sanitizeDecision(raw.decision);
  if (!decision) return null;

  const reasons = Array.isArray(raw.reasons)
    ? raw.reasons
        .map((item) => toNonEmptyString(item))
        .filter((item): item is string => Boolean(item))
        .slice(0, 5)
    : [];

  return {
    decision,
    confidence: toFiniteNumber(raw.confidence),
    qualityScore: toFiniteNumber(raw.qualityScore),
    reasons,
    rationale: toNonEmptyString(raw.rationale),
  };
}

export function extractAiReview(normalizedPayload: unknown, rawPayload: unknown): AiReviewResult | null {
  const normalized = asObject(normalizedPayload);
  const raw = asObject(rawPayload);
  return parseAiReview(normalized?._ai_review) ?? parseAiReview(raw?.aiReview) ?? null;
}

export function aiDecisionLabel(decision: AiReviewDecision): string {
  if (decision === 'accept') return '승인 추천';
  if (decision === 'reject') return '반려 추천';
  return '수동 검수';
}

export function formatConfidencePercent(confidence: number | null): string | null {
  if (confidence === null || !Number.isFinite(confidence)) return null;
  const normalized = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(normalized)}%`;
}

