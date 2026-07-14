import { urlBelongsToDomain } from '../lighthouse/urls';
import type { ManifestResult, PageScores } from '../models/lighthouse';
import { getTotalAndUnusedBytesForUrl } from '../parser/treemap';
import type { Logger } from '../utils/logger';
import { consoleLogger } from '../utils/logger';
import { extractPath, toPercentageScore } from './formatter';

/**
 * Builds a path → scores map from manifest results for a given domain.
 * Used on PRs to compare staging against live production in the same run.
 */
export async function buildScoresFromManifest(
  manifest: ManifestResult[],
  resultsPath: string,
  domain: string,
  logger: Logger = consoleLogger,
): Promise<Record<string, PageScores>> {
  const scores: Record<string, PageScores> = {};

  for (const result of manifest) {
    if (!urlBelongsToDomain(result.url, domain)) {
      continue;
    }

    const bundle = await getTotalAndUnusedBytesForUrl(result.url, resultsPath, logger);
    const pagePath = extractPath(result.url);
    scores[pagePath] = {
      urlDisplay: result.url,
      performance: Math.trunc(toPercentageScore(result.summary.performance)),
      accessibility: Math.trunc(toPercentageScore(result.summary.accessibility)),
      bestPractices: Math.trunc(toPercentageScore(result.summary['best-practices'])),
      seo: Math.trunc(toPercentageScore(result.summary.seo)),
      totalBundleSize: bundle.totalBundleSizeMb,
      unusedBundleSize: bundle.unusedBundleSizeMb,
    };
  }

  return scores;
}
