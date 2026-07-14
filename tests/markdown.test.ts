import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ManifestResult } from '../src/models/lighthouse';
import { parseProdReport } from '../src/report/comparison';
import { generateLighthouseMarkdown } from '../src/report/markdown';
import type { Logger } from '../src/utils/logger';

const silentLogger: Logger = {
  info: () => undefined,
  warning: () => undefined,
  error: () => undefined,
};

const sampleManifest: ManifestResult[] = [
  {
    url: 'https://example.com/',
    summary: {
      performance: 0.9,
      accessibility: 0.95,
      'best-practices': 0.88,
      seo: 1,
    },
  },
  {
    url: 'https://example.com/about',
    summary: {
      performance: 0.8,
      accessibility: 0.9,
      'best-practices': 0.85,
      seo: 0.92,
    },
  },
];

async function writeReportJson(dir: string, urlSlug: string): Promise<void> {
  const report = {
    audits: {
      'script-treemap-data': {
        details: {
          nodes: [{ resourceBytes: 2_097_152, unusedBytes: 1_048_576 }],
        },
      },
    },
  };
  await writeFile(
    path.join(dir, `${urlSlug}-20240101.report.json`),
    JSON.stringify(report),
    'utf-8',
  );
}

describe('generateLighthouseMarkdown', () => {
  it('generates a production report matching the Python layout', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lhci-'));
    await writeReportJson(dir, 'example_com-_');
    await writeReportJson(dir, 'example_com-_about');

    const markdown = await generateLighthouseMarkdown(sampleManifest, {
      resultsPath: dir,
      isPullRequest: false,
      importantPaths: new Set(['/']),
      logger: silentLogger,
    });

    expect(markdown).toContain('## 🚀 Lighthouse Report');
    expect(markdown).toContain(
      '| 🌐 URL | ⚡ Performance | ♿ Accessibility | ✅ Best Practices | 🔍 SEO | 📦 Bundle Size | 🗑️ Unused Bundle |',
    );
    expect(markdown).toContain(
      '| ⭐ https://example.com/ | 90 | 95 | 88 | 100 | 2.00 MB | 1.00 MB |',
    );
    expect(markdown).toContain(
      '| https://example.com/about | 80 | 90 | 85 | 92 | 2.00 MB | 1.00 MB |',
    );
  });

  it('generates a PR comparison report with deltas', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lhci-'));
    await writeReportJson(dir, 'example_com-_');
    await writeReportJson(dir, 'example_com-_about');

    const markdown = await generateLighthouseMarkdown(sampleManifest, {
      resultsPath: dir,
      isPullRequest: true,
      importantPaths: new Set(['/']),
      prodScores: {
        '/': {
          urlDisplay: '⭐ https://example.com/',
          performance: 85,
          accessibility: 95,
          bestPractices: 90,
          seo: 100,
          totalBundleSize: 2.5,
          unusedBundleSize: 1.2,
        },
        '/about': {
          urlDisplay: 'https://example.com/about',
          performance: 80,
          accessibility: 90,
          bestPractices: 85,
          seo: 92,
          totalBundleSize: 2.0,
          unusedBundleSize: 1.0,
        },
      },
      logger: silentLogger,
    });

    expect(markdown).toContain('## 🚀 Lighthouse score comparison for PR slot and production');
    // perf improved 85 → 90
    expect(markdown).toContain('90 (⬆️5)');
    // best practices regressed 90 → 88
    expect(markdown).toContain('88 (⬇️2)');
    // bundle shrank 2.5 → 2.0
    expect(markdown).toContain('2.00 MB (⬇️0.50 MB)');
  });
});

describe('parseProdReport', () => {
  it('parses production markdown rows into scores keyed by path', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lhci-prod-'));
    const reportPath = path.join(dir, 'prod-lighthouse-report.md');
    const content = [
      '## 🚀 Lighthouse Report',
      '',
      '| 🌐 URL | ⚡ Performance | ♿ Accessibility | ✅ Best Practices | 🔍 SEO | 📦 Bundle Size | 🗑️ Unused Bundle |',
      '| --- | ----------- | ------------- | -------------- | --- | ---------------- | ---------------- |',
      '| ⭐ https://example.com/ | 90 | 95 | 88 | 100 | 2.00 MB | 1.00 MB |',
      '| https://example.com/about | 80 | 90 | 85 | 92 | 1.50 MB | 0.50 MB |',
      '',
    ].join('\n');

    await writeFile(reportPath, content, 'utf-8');

    const scores = await parseProdReport(reportPath, silentLogger);
    expect(scores['/']).toMatchObject({
      performance: 90,
      accessibility: 95,
      bestPractices: 88,
      seo: 100,
      totalBundleSize: 2.0,
      unusedBundleSize: 1.0,
    });
    expect(scores['/about']).toMatchObject({
      performance: 80,
      totalBundleSize: 1.5,
    });
  });

  it('returns an empty object when the production report is missing', async () => {
    const scores = await parseProdReport(
      path.join(tmpdir(), 'missing-prod-report.md'),
      silentLogger,
    );
    expect(scores).toEqual({});
  });
});
