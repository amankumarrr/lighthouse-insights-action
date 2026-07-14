/**
 * Parses newline-separated URL lists from action inputs.
 */
export function parseUrls(urlsInput: string): string[] {
  return urlsInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Parses path lists from action inputs.
 * Supports newline-separated and comma-separated values.
 */
export function parsePaths(pathsInput: string): string[] {
  return pathsInput
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('#'))
    .map(normalizePath);
}

/**
 * Parses comma-separated important path lists.
 */
export function parseImportantPaths(importantPathsInput: string): Set<string> {
  return new Set(parsePaths(importantPathsInput));
}

export function normalizePath(pathValue: string): string {
  const trimmed = pathValue.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;
}

export function normalizeDomain(domain: string): string {
  return domain.trim().replace(/\/+$/, '');
}

export function joinDomainAndPath(domain: string, pagePath: string): string {
  const base = normalizeDomain(domain);
  const normalizedPath = normalizePath(pagePath);
  if (normalizedPath === '/') {
    return `${base}/`;
  }
  return `${base}${normalizedPath}`;
}

/** True when the URL's origin matches the configured domain origin. */
export function urlBelongsToDomain(url: string, domain: string): boolean {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return false;
  }
  try {
    const page = new URL(url.startsWith('⭐ ') ? url.slice(2).trim() : url);
    const base = new URL(
      normalizedDomain.includes('://') ? normalizedDomain : `https://${normalizedDomain}`,
    );
    return page.origin === base.origin;
  } catch {
    return url.startsWith(normalizedDomain);
  }
}

export interface DomainUrlOptions {
  paths: string[];
  productionDomain: string;
  stagingDomain: string;
  defaultDomain: string;
  isPullRequest?: boolean;
}

/**
 * Builds audit URLs from paths + domains.
 *
 * - If both production and staging are set:
 *   - pull_request → collect production + staging (compare in-run; report shows staging only)
 *   - otherwise → production only (baseline)
 * - Otherwise → default domain (or the single provided domain) × paths
 */
export function resolveUrlsFromDomains(options: DomainUrlOptions): string[] {
  const paths = options.paths;
  if (paths.length === 0) {
    return [];
  }

  const productionDomain = options.productionDomain.trim();
  const stagingDomain = options.stagingDomain.trim();
  const defaultDomain = options.defaultDomain.trim();
  const isPullRequest = options.isPullRequest === true;

  if (productionDomain && stagingDomain) {
    if (isPullRequest) {
      return [
        ...paths.map((pagePath) => joinDomainAndPath(productionDomain, pagePath)),
        ...paths.map((pagePath) => joinDomainAndPath(stagingDomain, pagePath)),
      ];
    }
    return paths.map((pagePath) => joinDomainAndPath(productionDomain, pagePath));
  }

  const domain = defaultDomain || productionDomain || stagingDomain;
  if (!domain) {
    throw new Error(
      'When using paths, provide default-domain, or both production-domain and staging-domain',
    );
  }

  return paths.map((pagePath) => joinDomainAndPath(domain, pagePath));
}

/**
 * Resolves the final URL list for the action.
 *
 * Priority:
 * 1. Explicit `urls` input
 * 2. `paths` + domain inputs
 * 3. Empty (caller may still use config-path)
 */
export function resolveAuditUrls(options: {
  urls: string[];
  paths: string[];
  productionDomain: string;
  stagingDomain: string;
  defaultDomain: string;
  isPullRequest?: boolean;
}): string[] {
  if (options.urls.length > 0) {
    return options.urls;
  }

  if (options.paths.length > 0) {
    return resolveUrlsFromDomains({
      paths: options.paths,
      productionDomain: options.productionDomain,
      stagingDomain: options.stagingDomain,
      defaultDomain: options.defaultDomain,
      isPullRequest: options.isPullRequest,
    });
  }

  return [];
}
