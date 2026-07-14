import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathExists } from '../utils/filesystem';
import type { Logger } from '../utils/logger';
import { consoleLogger } from '../utils/logger';
import { writeTemporaryConfig } from './config';

const LHCI_PACKAGE = '@lhci/cli@0.14.0';

export interface RunLighthouseOptions {
  urls: string[];
  configPath: string;
  resultsPath: string;
  workingDirectory?: string;
  logger?: Logger;
}

interface LhciInvocation {
  command: string;
  prefixArgs: string[];
  shell: boolean;
}

/**
 * Runs Lighthouse CI collect + filesystem upload, producing results under resultsPath.
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

  const invocation = resolveLhciInvocation(logger);

  // collect alone writes lhr-*.json; upload (filesystem) produces manifest.json
  // and URL-named *.report.json files expected by the report generator.
  const collectArgs = [...invocation.prefixArgs, 'collect', `--config=${resolvedConfigPath}`];
  const uploadArgs = [...invocation.prefixArgs, 'upload', `--config=${resolvedConfigPath}`];

  logger.info(`Running: ${invocation.command} ${collectArgs.join(' ')}`);
  await spawnCommand(invocation.command, collectArgs, workingDirectory, logger, invocation.shell);

  logger.info(`Running: ${invocation.command} ${uploadArgs.join(' ')}`);
  await spawnCommand(invocation.command, uploadArgs, workingDirectory, logger, invocation.shell);

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

/**
 * Resolve @lhci/cli for both local development and published GitHub Action usage.
 * When used as an action, dependencies are installed into the action directory
 * (see action.yml composite steps), so __dirname/../node_modules is preferred.
 */
export function resolveLhciInvocation(logger: Logger = consoleLogger): LhciInvocation {
  const candidates = [
    // Published action: dist/index.js → ../node_modules/@lhci/cli
    path.join(__dirname, '..', 'node_modules', '@lhci', 'cli', 'src', 'cli.js'),
    // Local tsx/dev from src/lighthouse
    path.join(__dirname, '..', '..', 'node_modules', '@lhci', 'cli', 'src', 'cli.js'),
    // Consumer workspace install
    path.join(process.cwd(), 'node_modules', '@lhci', 'cli', 'src', 'cli.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      logger.info(`Using local @lhci/cli at ${candidate}`);
      return { command: process.execPath, prefixArgs: [candidate], shell: false };
    }
  }

  logger.info(`Local @lhci/cli not found; falling back to npx ${LHCI_PACKAGE}`);
  if (process.platform === 'win32') {
    // npx.cmd has no spaces — shell:true is safe here (unlike node.exe under Program Files)
    return {
      command: 'npx.cmd',
      prefixArgs: ['--yes', LHCI_PACKAGE],
      shell: true,
    };
  }

  return {
    command: 'npx',
    prefixArgs: ['--yes', LHCI_PACKAGE],
    shell: false,
  };
}

function spawnCommand(
  command: string,
  args: string[],
  cwd: string,
  logger: Logger,
  shell: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell,
      windowsHide: true,
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
