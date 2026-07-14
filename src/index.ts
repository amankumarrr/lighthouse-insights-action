import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { uploadRawResultsArtifact, uploadReportArtifact } from './github/artifact';
import { setActionOutputs } from './github/outputs';
import { publishStepSummary } from './github/summary';
import { runLighthouse } from './lighthouse/runner';
import { parseImportantPaths, parsePaths, parseUrls, resolveAuditUrls } from './lighthouse/urls';
import type { ActionInputs, PageScores } from './models/lighthouse';
import { readManifest } from './parser/manifest';
import { parseProdReport } from './report/comparison';
import { generateLighthouseMarkdown } from './report/markdown';
import { writeTextFile } from './utils/filesystem';
import type { Logger } from './utils/logger';

const actionsLogger: Logger = {
  info: (message) => core.info(message),
  warning: (message) => core.warning(message),
  error: (message) => core.error(message),
};

function getInputs(): ActionInputs {
  return {
    urls: parseUrls(core.getInput('urls')),
    paths: parsePaths(core.getInput('paths')),
    productionDomain: core.getInput('production-domain'),
    stagingDomain: core.getInput('staging-domain'),
    defaultDomain: core.getInput('default-domain'),
    configPath: core.getInput('config-path'),
    resultsPath: core.getInput('results-path') || '.lighthouseci',
    productionReport: core.getInput('production-report') || 'prod-lighthouse-report.md',
    uploadSummary: core.getBooleanInput('upload-summary'),
    uploadReport: core.getBooleanInput('upload-report'),
    uploadRawResults: core.getBooleanInput('upload-raw-results'),
    reportArtifactName: core.getInput('report-artifact-name') || 'lighthouse-report',
    rawResultsArtifactName: core.getInput('raw-results-artifact-name') || 'lighthouse-results',
    importantPaths: parseImportantPaths(
      core.getInput('important-paths') || '/,/consulting/net-upgrade,/consulting/web-applications',
    ),
  };
}

async function run(): Promise<void> {
  const inputs = getInputs();
  const isPullRequest = github.context.eventName === 'pull_request';

  const resolvedUrls = resolveAuditUrls({
    urls: inputs.urls,
    paths: inputs.paths,
    productionDomain: inputs.productionDomain,
    stagingDomain: inputs.stagingDomain,
    defaultDomain: inputs.defaultDomain,
  });

  core.info(`Event: ${github.context.eventName}`);
  core.info(`Results path: ${inputs.resultsPath}`);
  if (resolvedUrls.length > 0) {
    core.info(
      `Auditing ${resolvedUrls.length} URL(s):\n${resolvedUrls.map((url) => `  - ${url}`).join('\n')}`,
    );
  }

  const resultsPath = await runLighthouse({
    urls: resolvedUrls,
    configPath: inputs.configPath,
    resultsPath: inputs.resultsPath,
    logger: actionsLogger,
  });

  core.info(`Reading manifest from ${resultsPath}`);
  const manifest = await readManifest(resultsPath);

  let prodScores: Record<string, PageScores> = {};
  if (isPullRequest) {
    core.info(`Parsing production report: ${inputs.productionReport}`);
    prodScores = await parseProdReport(inputs.productionReport, actionsLogger);
  }

  const report = await generateLighthouseMarkdown(manifest, {
    resultsPath,
    isPullRequest,
    importantPaths: inputs.importantPaths,
    prodScores,
    logger: actionsLogger,
  });

  const reportPath = isPullRequest
    ? path.resolve('lighthouse-report.md')
    : path.resolve(inputs.productionReport);

  await writeTextFile(reportPath, report);
  core.info(`✅ Lighthouse report written to ${reportPath}`);

  if (inputs.uploadSummary) {
    await publishStepSummary(report);
    core.info('Published report to GitHub Step Summary');
  }

  let reportArtifactName = '';
  if (inputs.uploadReport) {
    reportArtifactName = await uploadReportArtifact(reportPath, inputs.reportArtifactName);
    core.info(`Uploaded report artifact: ${reportArtifactName}`);
  }

  let rawResultsArtifactName = '';
  if (inputs.uploadRawResults) {
    rawResultsArtifactName = await uploadRawResultsArtifact(
      resultsPath,
      inputs.rawResultsArtifactName,
    );
    if (rawResultsArtifactName) {
      core.info(`Uploaded raw results artifact: ${rawResultsArtifactName}`);
    }
  }

  setActionOutputs({
    report,
    reportPath,
    resultsPath,
    reportArtifactName,
    rawResultsArtifactName,
  });
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
