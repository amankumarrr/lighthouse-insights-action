import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../src/lighthouse/config';
import {
  joinDomainAndPath,
  parseImportantPaths,
  parsePaths,
  parseUrls,
  resolveAuditUrls,
  resolveUrlsFromDomains,
} from '../src/lighthouse/urls';
import { calculateBundleSizes, formatUrlForFilename } from '../src/parser/treemap';
import {
  extractPath,
  formatBundleSize,
  formatScore,
  getBundleDisplay,
  getDisplayText,
  getScoreDisplay,
  toPercentageScore,
} from '../src/report/formatter';

describe('formatUrlForFilename', () => {
  it('matches the Python URL filename formatting', () => {
    expect(formatUrlForFilename('https://example.com/')).toBe('example_com-_');
    expect(formatUrlForFilename('https://example.com/about')).toBe('example_com-_about');
    expect(formatUrlForFilename('https://my-site.com/foo/bar')).toBe('my_site_com-_foo_bar');
    expect(formatUrlForFilename('http://example.com/path')).toBe('example_com-_path');
  });
});

describe('extractPath', () => {
  it('extracts pathname and strips star prefix', () => {
    expect(extractPath('https://example.com/about')).toBe('/about');
    expect(extractPath('⭐ https://example.com/')).toBe('/');
    expect(extractPath('⭐ https://example.com/consulting/net-upgrade')).toBe(
      '/consulting/net-upgrade',
    );
  });
});

describe('score and bundle display', () => {
  it('formats score deltas like the Python script', () => {
    expect(getScoreDisplay(90, 5)).toBe('90 (⬇️5)');
    expect(getScoreDisplay(95, -3)).toBe('95 (⬆️3)');
    expect(getScoreDisplay(88, 0)).toBe('88');
  });

  it('computes display text from prod vs PR scores', () => {
    // prod 90, pr 85 → difference 5 → regression arrow
    expect(getDisplayText(90, 85)).toBe('85 (⬇️5)');
    // prod 80, pr 90 → difference -10 → improvement arrow
    expect(getDisplayText(80, 90)).toBe('90 (⬆️10)');
    expect(getDisplayText(88, 88)).toBe('88');
  });

  it('formats bundle size deltas like the Python script', () => {
    expect(getBundleDisplay(1.5, 0.25)).toBe('1.50 MB (⬇️0.25 MB)');
    expect(getBundleDisplay(2.0, -0.5)).toBe('2.00 MB (⬆️0.50 MB)');
    expect(getBundleDisplay(1.25, 0)).toBe('1.25 MB');
  });

  it('formats plain scores and bundle sizes', () => {
    expect(formatScore(87.6)).toBe('87');
    expect(formatBundleSize(1.234)).toBe('1.23 MB');
    expect(toPercentageScore(0.87)).toBe(87);
    expect(toPercentageScore(null)).toBe(0);
  });
});

describe('calculateBundleSizes', () => {
  it('sums resource and unused bytes from treemap nodes', () => {
    const sizes = calculateBundleSizes({
      audits: {
        'script-treemap-data': {
          details: {
            nodes: [
              { resourceBytes: 1_048_576, unusedBytes: 524_288 },
              { resourceBytes: 1_048_576, unusedBytes: 0 },
            ],
          },
        },
      },
    });

    expect(sizes.totalBundleSizeMb).toBe(2);
    expect(sizes.unusedBundleSizeMb).toBe(0.5);
  });

  it('returns zeros when treemap data is missing', () => {
    expect(calculateBundleSizes({})).toEqual({
      totalBundleSizeMb: 0,
      unusedBundleSizeMb: 0,
    });
  });
});

describe('url and path parsing', () => {
  it('parses newline-separated urls', () => {
    expect(
      parseUrls(`
https://example.com
# comment
https://example.com/about
`),
    ).toEqual(['https://example.com', 'https://example.com/about']);
  });

  it('parses important paths', () => {
    const paths = parseImportantPaths('/,/consulting/net-upgrade,/consulting/web-applications');
    expect(paths.has('/')).toBe(true);
    expect(paths.has('/consulting/net-upgrade')).toBe(true);
    expect(paths.has('/consulting/web-applications')).toBe(true);
  });

  it('parses newline and comma-separated paths', () => {
    expect(parsePaths('/,/about\n/contact')).toEqual(['/', '/about', '/contact']);
  });

  it('joins domain and path', () => {
    expect(joinDomainAndPath('https://example.com/', '/')).toBe('https://example.com/');
    expect(joinDomainAndPath('https://example.com', 'about')).toBe('https://example.com/about');
  });
});

describe('resolveUrlsFromDomains', () => {
  const paths = ['/', '/about'];

  it('on PR audits staging only when both domains are set', () => {
    expect(
      resolveUrlsFromDomains({
        paths,
        productionDomain: 'https://www.example.com',
        stagingDomain: 'https://staging.example.com',
        defaultDomain: 'https://ignored.example.com',
        isPullRequest: true,
      }),
    ).toEqual(['https://staging.example.com/', 'https://staging.example.com/about']);
  });

  it('on non-PR audits production only when both domains are set', () => {
    expect(
      resolveUrlsFromDomains({
        paths,
        productionDomain: 'https://www.example.com',
        stagingDomain: 'https://staging.example.com',
        defaultDomain: 'https://ignored.example.com',
        isPullRequest: false,
      }),
    ).toEqual(['https://www.example.com/', 'https://www.example.com/about']);
  });

  it('audits only the default domain when both staging and production are not set', () => {
    expect(
      resolveUrlsFromDomains({
        paths,
        productionDomain: '',
        stagingDomain: '',
        defaultDomain: 'https://example.com',
      }),
    ).toEqual(['https://example.com/', 'https://example.com/about']);
  });

  it('falls back to a single provided domain when default is missing', () => {
    expect(
      resolveUrlsFromDomains({
        paths,
        productionDomain: 'https://www.example.com',
        stagingDomain: '',
        defaultDomain: '',
      }),
    ).toEqual(['https://www.example.com/', 'https://www.example.com/about']);
  });
});

describe('resolveAuditUrls', () => {
  it('prefers explicit urls over paths/domains', () => {
    expect(
      resolveAuditUrls({
        urls: ['https://custom.example.com/x'],
        paths: ['/'],
        productionDomain: 'https://www.example.com',
        stagingDomain: 'https://staging.example.com',
        defaultDomain: 'https://example.com',
      }),
    ).toEqual(['https://custom.example.com/x']);
  });
});

describe('createDefaultConfig', () => {
  it('builds a filesystem upload config for the provided urls', () => {
    const config = createDefaultConfig(['https://example.com']);
    expect(config.ci.collect.url).toEqual(['https://example.com']);
    expect(config.ci.collect.numberOfRuns).toBe(1);
    expect(config.ci.upload?.target).toBe('filesystem');
  });
});
