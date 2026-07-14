import type { PageScores } from '../models/lighthouse';
import { pathExists, readTextFile } from '../utils/filesystem';
import type { Logger } from '../utils/logger';
import { consoleLogger } from '../utils/logger';
import { extractPath } from './formatter';

/**
 * Parses a production Markdown report into a path → scores map.
 * Mirrors scripts/generate-lighthouse-report.py::parse_prod_report
 */
export async function parseProdReport(
  productionReportPath: string,
  logger: Logger = consoleLogger,
): Promise<Record<string, PageScores>> {
  if (!(await pathExists(productionReportPath))) {
    logger.warning('❌ Error: production report file not found.');
    return {};
  }

  let content: string;
  try {
    content = await readTextFile(productionReportPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warning(`❌ Error reading production report file: ${message}`);
    return {};
  }

  const lines = content.trim().split('\n');
  const scores: Record<string, PageScores> = {};

  // Skip header and separator rows
  for (const line of lines.slice(2)) {
    const parts = line
      .split('|')
      .slice(1, -1)
      .map((part) => part.trim());

    if (parts.length !== 7 || !parts[0].includes('https')) {
      continue;
    }

    const url = parts[0];
    try {
      scores[extractPath(url)] = {
        urlDisplay: url,
        performance: Number.parseInt(parts[1].split(/\s+/)[0], 10),
        accessibility: Number.parseInt(parts[2].split(/\s+/)[0], 10),
        bestPractices: Number.parseInt(parts[3].split(/\s+/)[0], 10),
        seo: Number.parseInt(parts[4].split(/\s+/)[0], 10),
        totalBundleSize: Number.parseFloat(parts[5].split(/\s+/)[0]),
        unusedBundleSize: Number.parseFloat(parts[6].split(/\s+/)[0]),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warning(`⚠️ Skipping invalid row for ${url}: ${message}`);
    }
  }

  return scores;
}
