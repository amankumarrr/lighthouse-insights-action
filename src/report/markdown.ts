import type { ManifestResult, PageReportRow, PageScores } from '../models/lighthouse';
import { getTotalAndUnusedBytesForUrl } from '../parser/treemap';
import type { Logger } from '../utils/logger';
import { consoleLogger } from '../utils/logger';
import {
  extractPath,
  formatBundleSize,
  formatScore,
  getBundleDisplay,
  getDisplayText,
  toPercentageScore,
} from './formatter';

export interface GenerateMarkdownOptions {
  resultsPath: string;
  isPullRequest: boolean;
  importantPaths: Set<string>;
  prodScores?: Record<string, PageScores>;
  logger?: Logger;
}

/**
 * Builds the Markdown report from Lighthouse CI manifest results.
 * Mirrors scripts/generate-lighthouse-report.py::generate_lighthouse_md
 */
export async function generateLighthouseMarkdown(
  manifest: ManifestResult[],
  options: GenerateMarkdownOptions,
): Promise<string> {
  const {
    resultsPath,
    isPullRequest,
    importantPaths,
    prodScores = {},
    logger = consoleLogger,
  } = options;

  const reportHeader = isPullRequest
    ? '🚀 Lighthouse score comparison for PR slot and production'
    : '🚀 Lighthouse Report';

  const lines: string[] = [
    `## ${reportHeader}\n`,
    '| 🌐 URL | ⚡ Performance | ♿ Accessibility | ✅ Best Practices | 🔍 SEO | 📦 Bundle Size | 🗑️ Unused Bundle |',
    '| --- | ----------- | ------------- | -------------- | --- | ---------------- | ---------------- |',
  ];

  for (const result of manifest) {
    const row = await buildPageRow(result, resultsPath, importantPaths, logger);

    if (!isPullRequest) {
      lines.push(formatProductionRow(row));
      continue;
    }

    const prodScore = prodScores[extractPath(result.url)];
    if (prodScore) {
      lines.push(formatComparisonRow(row, prodScore));
    } else {
      // No baseline for this path yet — still show absolute scores on the PR.
      lines.push(formatProductionRow(row));
    }
  }

  return lines.join('\n');
}

async function buildPageRow(
  result: ManifestResult,
  resultsPath: string,
  importantPaths: Set<string>,
  logger: Logger,
): Promise<PageReportRow> {
  const url = result.url;
  const urlDisplay = importantPaths.has(extractPath(url)) ? `⭐ ${url}` : url;
  const bundle = await getTotalAndUnusedBytesForUrl(url, resultsPath, logger);

  return {
    url,
    urlDisplay,
    performance: toPercentageScore(result.summary.performance),
    accessibility: toPercentageScore(result.summary.accessibility),
    bestPractices: toPercentageScore(result.summary['best-practices']),
    seo: toPercentageScore(result.summary.seo),
    totalBundleSize: bundle.totalBundleSizeMb,
    unusedBundleSize: bundle.unusedBundleSizeMb,
  };
}

function formatProductionRow(row: PageReportRow): string {
  return `| ${row.urlDisplay} | ${formatScore(row.performance)} | ${formatScore(row.accessibility)} | ${formatScore(row.bestPractices)} | ${formatScore(row.seo)} | ${formatBundleSize(row.totalBundleSize)} | ${formatBundleSize(row.unusedBundleSize)} |`;
}

function formatComparisonRow(row: PageReportRow, prodScore: PageScores): string {
  const performanceDisplay = getDisplayText(prodScore.performance, row.performance);
  const accessibilityDisplay = getDisplayText(prodScore.accessibility, row.accessibility);
  const bestPracticesDisplay = getDisplayText(prodScore.bestPractices, row.bestPractices);
  const seoDisplay = getDisplayText(prodScore.seo, row.seo);
  const totalBundleDisplay = getBundleDisplay(
    row.totalBundleSize,
    prodScore.totalBundleSize - row.totalBundleSize,
  );
  const unusedBundleDisplay = getBundleDisplay(
    row.unusedBundleSize,
    prodScore.unusedBundleSize - row.unusedBundleSize,
  );

  return `| ${row.urlDisplay} | ${performanceDisplay} | ${accessibilityDisplay} | ${bestPracticesDisplay} | ${seoDisplay} | ${totalBundleDisplay} | ${unusedBundleDisplay} |`;
}
