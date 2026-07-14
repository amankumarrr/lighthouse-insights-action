import path from 'node:path';
import { writeTextFile } from '../utils/filesystem';

export interface LighthouseCiConfig {
  ci: {
    collect: {
      url: string[];
      numberOfRuns?: number;
      settings?: Record<string, unknown>;
    };
    assert?: Record<string, unknown>;
    upload?: Record<string, unknown>;
  };
}

/**
 * Builds a default Lighthouse CI configuration for simple (URL-only) mode.
 */
export function createDefaultConfig(urls: string[]): LighthouseCiConfig {
  return {
    ci: {
      collect: {
        url: urls,
        numberOfRuns: 1,
        settings: {
          chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        },
      },
      upload: {
        target: 'filesystem',
        outputDir: '.lighthouseci',
      },
    },
  };
}

/**
 * Writes a temporary lighthouserc.json for simple mode.
 */
export async function writeTemporaryConfig(urls: string[], outputDir: string): Promise<string> {
  const config = createDefaultConfig(urls);
  const configPath = path.join(outputDir, 'lighthouserc.generated.json');
  await writeTextFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}
