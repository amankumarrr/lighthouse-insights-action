import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import * as artifact from '@actions/artifact';
import * as core from '@actions/core';

export async function uploadReportArtifact(
  reportPath: string,
  artifactName: string,
): Promise<string> {
  const client = new artifact.DefaultArtifactClient();
  await client.uploadArtifact(artifactName, [reportPath], path.dirname(reportPath));
  return artifactName;
}

export async function uploadRawResultsArtifact(
  resultsPath: string,
  artifactName: string,
): Promise<string> {
  const files = await collectFilesRecursive(resultsPath);
  if (files.length === 0) {
    core.warning(`No files found in results path: ${resultsPath}`);
    return '';
  }

  const client = new artifact.DefaultArtifactClient();
  await client.uploadArtifact(artifactName, files, resultsPath);
  return artifactName;
}

async function collectFilesRecursive(directory: string): Promise<string[]> {
  const results: string[] = [];

  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}
