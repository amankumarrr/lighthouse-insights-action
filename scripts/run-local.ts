#!/usr/bin/env node
/**
 * Local runner for Lighthouse Insights Action.
 *
 * Examples:
 *   npm run local -- https://example.com
 *   npm run local:domains:dry
 *   npm run local:default:dry
 *   npm run local:fixture
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runLighthouse } from '../src/lighthouse/runner';
import {
  parseImportantPaths,
  parsePaths,
  parseUrls,
  resolveAuditUrls,
} from '../src/lighthouse/urls';
import type { PageScores } from '../src/models/lighthouse';
import { readManifest } from '../src/parser/manifest';
import { parseProdReport } from '../src/report/comparison';
import { generateLighthouseMarkdown } from '../src/report/markdown';
import { pathExists, writeTextFile } from '../src/utils/filesystem';
import type { Logger } from '../src/utils/logger';

const LOG_FILE = path.resolve('local-run.log');

function appendLog(message: string): void {
  appendFileSync(LOG_FILE, `${message}\n`, 'utf8');
}

function createLogger(): Logger {
  writeFileSync(LOG_FILE, `Local run started at ${new Date().toISOString()}\n`, 'utf8');
  return {
    info: (message) => {
      process.stdout.write(`${message}\n`);
      appendLog(message);
    },
    warning: (message) => {
      process.stderr.write(`${message}\n`);
      appendLog(`[warn] ${message}`);
    },
    error: (message) => {
      process.stderr.write(`${message}\n`);
      appendLog(`[error] ${message}`);
    },
  };
}

function fail(message: string): never {
  appendLog(`[error] ${message}`);
  process.stderr.write(`\n[error] ${message}\n`);
  process.stderr.write(`[error] Full log: ${LOG_FILE}\n`);
  process.exit(1);
}

interface CliOptions {
  urls: string[];
  paths: string[];
  productionDomain: string;
  stagingDomain: string;
  defaultDomain: string;
  configPath: string;
  resultsPath: string;
  productionReport: string;
  outputPath: string;
  importantPaths: Set<string>;
  skipCollect: boolean;
  useFixture: boolean;
  isPullRequest: boolean;
  dryRun: boolean;
}

const DEFAULT_IMPORTANT = '/,/consulting/net-upgrade,/consulting/web-applications';

function printHelp(): void {
  process.stdout.write(`
Lighthouse Insights - local runner

Usage:
  npm run local -- <url> [more-urls...]
  npm run local -- --paths /,/about --production-domain https://... --staging-domain https://...
  npm run local -- --paths /,/about --default-domain https://...
  npm run local -- --dry-run --paths / --production-domain https://a --staging-domain https://b

Options:
  --urls <list>                 Comma-separated full URLs
  --paths <list>                Comma/newline-separated paths (e.g. /,/about)
  --production-domain <origin>  Production origin
  --staging-domain <origin>     Staging/preview origin
  --default-domain <origin>     Default origin when both domains are not set
  --config <path>               Lighthouse CI config path
  --results-path <dir>          Results directory (default: .lighthouseci)
  --production-report <file>    Baseline report for PR comparison
  --out <file>                  Output Markdown path
  --important-paths <list>      Comma-separated paths to star-highlight
  --dry-run                     Print resolved URLs only (no Lighthouse)
  --skip-collect                Skip LHCI; generate report from existing results
  --fixture                     Use bundled fixtures (offline smoke test)
  --pr                          Generate PR comparison report
  --help                        Show this help
`);
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    urls: [],
    paths: [],
    productionDomain: '',
    stagingDomain: '',
    defaultDomain: '',
    configPath: '',
    resultsPath: '.lighthouseci',
    productionReport: 'prod-lighthouse-report.md',
    outputPath: '',
    importantPaths: parseImportantPaths(DEFAULT_IMPORTANT),
    skipCollect: false,
    useFixture: false,
    isPullRequest: false,
    dryRun: false,
  };

  const positionalUrls: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      case '--urls':
        options.urls = parseUrls((next ?? '').replace(/,/g, '\n'));
        i++;
        break;
      case '--paths':
        options.paths = parsePaths(next ?? '');
        i++;
        break;
      case '--production-domain':
        options.productionDomain = next ?? '';
        i++;
        break;
      case '--staging-domain':
        options.stagingDomain = next ?? '';
        i++;
        break;
      case '--default-domain':
        options.defaultDomain = next ?? '';
        i++;
        break;
      case '--config':
        options.configPath = next ?? '';
        i++;
        break;
      case '--results-path':
        options.resultsPath = next ?? '.lighthouseci';
        i++;
        break;
      case '--production-report':
        options.productionReport = next ?? 'prod-lighthouse-report.md';
        i++;
        break;
      case '--out':
        options.outputPath = next ?? '';
        i++;
        break;
      case '--important-paths':
        options.importantPaths = parseImportantPaths(next ?? DEFAULT_IMPORTANT);
        i++;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-collect':
        options.skipCollect = true;
        break;
      case '--fixture':
        options.useFixture = true;
        options.skipCollect = true;
        break;
      case '--pr':
        options.isPullRequest = true;
        break;
      default:
        if (arg.startsWith('-')) {
          fail(`Unknown option: ${arg}. Use --help for usage.`);
        }
        if (isUrl(arg)) {
          positionalUrls.push(arg);
        } else {
          fail(`Unexpected argument: ${arg}. Use --help for usage.`);
        }
    }
  }

  if (positionalUrls.length > 0) {
    options.urls = [...options.urls, ...positionalUrls];
  }

  return options;
}

function resolveFixtureResultsPath(): string {
  return path.resolve(process.cwd(), 'fixtures', 'lighthouseci');
}

function resolveOutputPath(options: CliOptions): string {
  if (options.outputPath) {
    return path.resolve(options.outputPath);
  }
  if (options.isPullRequest) {
    return path.resolve('lighthouse-report.md');
  }
  if (options.useFixture) {
    return path.resolve('local-lighthouse-report.md');
  }
  return path.resolve(options.productionReport);
}

function verifyReport(markdown: string, isPullRequest: boolean): string[] {
  const errors: string[] = [];
  const expectedHeader = isPullRequest
    ? '## 🚀 Lighthouse score comparison for PR slot and production'
    : '## 🚀 Lighthouse Report';

  if (!markdown.includes(expectedHeader)) {
    errors.push(`Missing report header: ${expectedHeader}`);
  }
  if (!markdown.includes('| 🌐 URL |')) {
    errors.push('Missing Markdown table header row');
  }
  if (!markdown.includes('| --- |')) {
    errors.push('Missing Markdown table separator row');
  }

  const dataRows = markdown
    .split('\n')
    .filter((line) => line.startsWith('|') && line.includes('https'));
  if (dataRows.length === 0) {
    errors.push('No data rows with URLs found in the report');
  }

  return errors;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const logger = createLogger();
  logger.info(`Args: ${process.argv.slice(2).join(' ') || '(none)'}`);

  const resolvedUrls = resolveAuditUrls({
    urls: options.urls,
    paths: options.paths,
    productionDomain: options.productionDomain,
    stagingDomain: options.stagingDomain,
    defaultDomain: options.defaultDomain,
    isPullRequest: options.isPullRequest,
  });

  if (options.dryRun) {
    if (resolvedUrls.length === 0) {
      fail('Dry run requires --urls, or --paths with domain inputs');
    }
    process.stdout.write(`\n[dry-run] Resolved ${resolvedUrls.length} URL(s):\n`);
    for (const url of resolvedUrls) {
      process.stdout.write(`  - ${url}\n`);
    }
    process.stdout.write('\n[ok] Dry run complete (no Lighthouse collect)\n');
    return;
  }

  if (options.useFixture) {
    options.resultsPath = resolveFixtureResultsPath();
    logger.info(`Using fixture results: ${options.resultsPath}`);
  }

  if (!options.skipCollect) {
    if (!options.configPath && resolvedUrls.length === 0) {
      printHelp();
      fail(
        'Provide a URL, --urls, --paths with domains, --config, --skip-collect, --fixture, or --dry-run',
      );
    }

    logger.info(
      `Running Lighthouse CI collect for: ${resolvedUrls.join(', ') || options.configPath}`,
    );
    options.resultsPath = await runLighthouse({
      urls: resolvedUrls,
      configPath: options.configPath,
      resultsPath: options.resultsPath,
      logger,
    });
  } else {
    logger.info(`Skipping collect; reading results from ${options.resultsPath}`);
  }

  const manifestPath = path.join(options.resultsPath, 'manifest.json');
  if (!(await pathExists(manifestPath))) {
    fail(
      [
        `manifest.json not found in ${path.resolve(options.resultsPath)}`,
        '',
        'local:report needs an existing .lighthouseci folder from a prior collect.',
        'Try one of:',
        '  npm run local:fixture',
        '  npm run local -- https://example.com',
      ].join('\n'),
    );
  }

  const manifest = await readManifest(options.resultsPath);
  logger.info(`Loaded ${manifest.length} result(s) from manifest`);

  let prodScores: Record<string, PageScores> = {};
  if (options.isPullRequest) {
    logger.info(`Parsing production baseline: ${options.productionReport}`);
    prodScores = await parseProdReport(options.productionReport, logger);
  }

  const report = await generateLighthouseMarkdown(manifest, {
    resultsPath: options.resultsPath,
    isPullRequest: options.isPullRequest,
    importantPaths: options.importantPaths,
    prodScores,
    logger,
  });

  const outputPath = resolveOutputPath(options);
  await writeTextFile(outputPath, `${report}\n`);

  const verificationErrors = verifyReport(report, options.isPullRequest);
  if (verificationErrors.length > 0) {
    fail(`Report verification failed:\n${verificationErrors.map((e) => `  - ${e}`).join('\n')}`);
  }

  process.stdout.write(`\n${'─'.repeat(40)}\n`);
  process.stdout.write(`${report}\n`);
  process.stdout.write(`${'─'.repeat(40)}\n`);
  process.stdout.write(`\n[ok] Report written to: ${outputPath}\n`);
  process.stdout.write(`[ok] Verified ${manifest.length} URL row(s)\n`);
  process.stdout.write(`[ok] Log file: ${LOG_FILE}\n`);
  appendLog(`Report written to: ${outputPath}`);
  if (options.useFixture) {
    process.stdout.write('[ok] Fixture smoke test passed\n');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
