import type { BundleSizes, LighthouseReportJson } from '../models/lighthouse';
import { findFiles } from '../utils/glob';
import type { Logger } from '../utils/logger';
import { consoleLogger } from '../utils/logger';
import { readLighthouseReport } from './report';

const BYTES_PER_MB = 1_048_576;

/**
 * Formats a URL to match Lighthouse CI report filenames.
 * Mirrors scripts/generate-lighthouse-report.py::format_url_for_filename
 */
export function formatUrlForFilename(url: string): string {
  const withoutProtocol = url.replace('https://', '').replace('http://', '');
  return withoutProtocol
    .replace(/-/g, '_')
    .replace('/', '-_')
    .replace(/\//g, '_')
    .replace(/\./g, '_');
}

/**
 * Reads the matching report JSON and sums script-treemap-data node bytes.
 * Mirrors scripts/generate-lighthouse-report.py::get_total_and_unused_bytes_for_url
 */
export async function getTotalAndUnusedBytesForUrl(
  url: string,
  resultsPath: string,
  logger: Logger = consoleLogger,
): Promise<BundleSizes> {
  try {
    const formattedUrl = formatUrlForFilename(url);
    const filenamePattern = `${formattedUrl}*.report.json`;

    logger.info(`🔍 Searching for ${filenamePattern} in ${resultsPath}...`);

    const matchingFiles = await findFiles(resultsPath, filenamePattern);
    if (matchingFiles.length === 0) {
      logger.error(`❌ Error: No matching JSON file found for ${url}.`);
      return { totalBundleSizeMb: 0, unusedBundleSizeMb: 0 };
    }

    const reportPath = matchingFiles[0];
    const data = await readLighthouseReport(reportPath);
    return calculateBundleSizes(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Error reading bundle sizes for ${url}: ${message}`);
    return { totalBundleSizeMb: 0, unusedBundleSizeMb: 0 };
  }
}

export function calculateBundleSizes(data: LighthouseReportJson): BundleSizes {
  const nodes = data.audits?.['script-treemap-data']?.details?.nodes ?? [];
  const totalBytes = nodes.reduce((sum, node) => sum + (node.resourceBytes ?? 0), 0);
  const unusedBytes = nodes.reduce((sum, node) => sum + (node.unusedBytes ?? 0), 0);

  return {
    totalBundleSizeMb: totalBytes / BYTES_PER_MB,
    unusedBundleSizeMb: unusedBytes / BYTES_PER_MB,
  };
}
