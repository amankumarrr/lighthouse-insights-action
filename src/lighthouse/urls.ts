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
 * Parses comma-separated important path lists.
 */
export function parseImportantPaths(importantPathsInput: string): Set<string> {
  const paths = importantPathsInput
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return new Set(paths);
}
