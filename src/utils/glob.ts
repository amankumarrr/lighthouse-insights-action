import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Finds files in a directory matching a simple glob pattern.
 * Supports `*` wildcards (same subset used by the Python reference).
 */
export async function findFiles(directory: string, pattern: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return [];
  }

  const regex = globToRegExp(pattern);
  return entries
    .filter((entry) => regex.test(entry))
    .map((entry) => path.join(directory, entry))
    .sort();
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}
