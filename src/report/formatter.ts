/**
 * Formatting helpers matching scripts/generate-lighthouse-report.py
 */

export function extractPath(url: string): string {
  let normalized = url;
  if (normalized.startsWith('⭐ ')) {
    normalized = normalized.slice(2);
  }
  try {
    return new URL(normalized).pathname;
  } catch {
    return normalized;
  }
}

export function getScoreDisplay(score: number, difference: number): string {
  if (difference > 0) {
    return `${Math.trunc(score)} (⬇️${Math.abs(difference)})`;
  }
  if (difference < 0) {
    return `${Math.trunc(score)} (⬆️${Math.abs(difference)})`;
  }
  return `${Math.trunc(score)}`;
}

export function getDisplayText(prodScore: number, prScore: number): string {
  const difference = Math.trunc(prodScore) - Math.trunc(prScore);
  return getScoreDisplay(prScore, difference);
}

export function getBundleDisplay(size: number, difference: number): string {
  const roundedDifference = Math.round(difference * 100) / 100;
  if (roundedDifference > 0) {
    return `${size.toFixed(2)} MB (⬇️${Math.abs(roundedDifference).toFixed(2)} MB)`;
  }
  if (roundedDifference < 0) {
    return `${size.toFixed(2)} MB (⬆️${Math.abs(roundedDifference).toFixed(2)} MB)`;
  }
  return `${size.toFixed(2)} MB`;
}

export function formatScore(score: number): string {
  return `${Math.trunc(score)}`;
}

export function formatBundleSize(sizeMb: number): string {
  return `${sizeMb.toFixed(2)} MB`;
}

export function toPercentageScore(fraction: number | null | undefined): number {
  return (fraction ?? 0) * 100;
}
