import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathExists } from '../utils/filesystem';
import type { Logger } from '../utils/logger';
import { consoleLogger } from '../utils/logger';
import { writeTemporaryConfig } from './config';

export interface RunLighthouseOptions {
  urls: string[];
  configPath: string;
  resultsPath: string;
  workingDirectory?: string;
  logger?: Logger;
}

/**
 * Runs Lighthouse CI collect, producing results under resultsPath.
 */
export async function runLighthouse(options: RunLighthouseOptions): Promise<string> {
  const {
    urls,
    configPath,
    resultsPath,
    workingDirectory = process.cwd(),
    logger = consoleLogger,
  } = options;

  let resolvedConfigPath = configPath;

  if (!resolvedConfigPath) {
    if (urls.length === 0) {
      throw new Error('Either urls or config-path must be provided');
    }
    logger.info('No config-path provided; generating a default Lighthouse CI configuration');
    resolvedConfigPath = await writeTemporaryConfig(urls, workingDirectory);
  } else if (!(await pathExists(resolvedConfigPath))) {
    throw new Error(`Lighthouse config not found: ${resolvedConfigPath}`);
  } else {
    logger.info(`Using Lighthouse config: ${resolvedConfigPath}`);
  }

  const { command, prefixArgs } = resolveLhciInvocation(logger);
  const args = [...prefixArgs, 'collect', `--config=${resolvedConfigPath}`];

  logger.info(`Running: ${command} ${args.join(' ')}`);
  await spawnCommand(command, args, workingDirectory, logger);

  const absoluteResultsPath = path.resolve(workingDirectory, resultsPath);
  if (await pathExists(path.join(absoluteResultsPath, 'manifest.json'))) {
    return absoluteResultsPath;
  }

  const defaultResults = path.resolve(workingDirectory, '.lighthouseci');
  if (await pathExists(path.join(defaultResults, 'manifest.json'))) {
    return defaultResults;
  }

  throw new Error(
    `Lighthouse CI completed but manifest.json was not found in ${absoluteResultsPath}`,
  );
}

function resolveLhciInvocation(logger: Logger): { command: string; prefixArgs: string[] } {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', '@lhci', 'cli', 'src', 'cli.js'),
    path.join(__dirname, 'node_modules', '@lhci', 'cli', 'src', 'cli.js'),
    path.join(process.cwd(), 'node_modules', '@lhci', 'cli', 'src', 'cli.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { command: process.execPath, prefixArgs: [candidate] };
    }
  }

  logger.info('@lhci/cli not found locally; falling back to npx');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return { command: npx, prefixArgs: ['--yes', '@lhci/cli@0.14.0'] };
}

function spawnCommand(command: string, args: string[], cwd: string, logger: Logger): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        logger.info(line);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        logger.warning(line);
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start Lighthouse CI: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Lighthouse CI exited with code ${code ?? 'unknown'}`));
    });
  });
}
