import path from 'node:path';
import type { ManifestResult } from '../models/lighthouse';
import { readJsonFile } from '../utils/filesystem';
import { findFiles } from '../utils/glob';

export async function readManifest(resultsPath: string): Promise<ManifestResult[]> {
  const matches = await findFiles(resultsPath, 'manifest.json');
  if (matches.length === 0) {
    throw new Error(`manifest.json not found in ${resultsPath}`);
  }

  const manifestPath = matches[0];
  return readJsonFile<ManifestResult[]>(manifestPath);
}

export function getManifestPath(resultsPath: string): string {
  return path.join(resultsPath, 'manifest.json');
}
