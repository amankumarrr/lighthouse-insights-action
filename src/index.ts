import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { uploadRawResultsArtifact, uploadReportArtifact } from './github/artifact';
import { commentReportOnPullRequest } from './github/comment';
import { setActionOutputs } from './github/outputs';
import { publishStepSummary } from './github/summary';
import { runLighthouse } from './lighthouse/runner';
import { parsePaths, parseUrls, resolveAuditUrls } from './lighthouse/urls';
import type { ActionInputs, PageScores } from './models/lighthouse';
import { readManifest } from './parser/manifest';
import { parseProdReport } from './report/comparison';
import { generateLighthouseMarkdown } from './report/markdown';
import { buildScoresFromManifest } from './report/scores-from-manifest';
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
    commentOnPr: core.getBooleanInput('comment-on-pr'),
    reportArtifactName: core.getInput('report-artifact-name') || 'lighthouse-report',
    rawResultsArtifactName: core.getInput('raw-results-artifact-name') || 'lighthouse-results',
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
    isPullRequest,
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

  const hasBothDomains =
    Boolean(inputs.productionDomain.trim()) && Boolean(inputs.stagingDomain.trim());

  let prodScores: Record<string, PageScores> = {};
  let includeDomain: string | undefined;

  if (isPullRequest && hasBothDomains) {
    // Live production scores from this run — no baseline file required.
    core.info(`Building production baseline scores from ${inputs.productionDomain}`);
    prodScores = await buildScoresFromManifest(
      manifest,
      resultsPath,
      inputs.productionDomain,
      actionsLogger,
    );
    includeDomain = inputs.stagingDomain;
    core.info(
      `PR report will show staging URLs only (${inputs.stagingDomain}) with deltas vs production`,
    );
  } else if (isPullRequest) {
    core.info(`Parsing production report: ${inputs.productionReport}`);
    prodScores = await parseProdReport(inputs.productionReport, actionsLogger);
  }

  const report = await generateLighthouseMarkdown(manifest, {
    resultsPath,
    isPullRequest,
    prodScores,
    includeDomain,
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

  if (inputs.commentOnPr) {
    try {
      await commentReportOnPullRequest(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`Failed to comment on PR: ${message}`);
      core.warning(
        'Ensure the job has `permissions: pull-requests: write` (and that the PR is not from a fork with read-only token).',
      );
    }
  }

  let reportArtifactName = '';
  if (inputs.uploadReport) {
    reportArtifactName = inputs.reportArtifactName;
    if (process.env.ACTIONS_RUNTIME_TOKEN) {
      await uploadReportArtifact(reportPath, inputs.reportArtifactName);
      core.info(`Uploaded report artifact: ${reportArtifactName}`);
    } else {
      core.info(
        'Report artifact upload will be handled by the composite action step (ACTIONS_RUNTIME_TOKEN not available in this process)',
      );
    }
  }

  let rawResultsArtifactName = '';
  if (inputs.uploadRawResults) {
    rawResultsArtifactName = inputs.rawResultsArtifactName;
    if (process.env.ACTIONS_RUNTIME_TOKEN) {
      const uploaded = await uploadRawResultsArtifact(resultsPath, inputs.rawResultsArtifactName);
      if (uploaded) {
        core.info(`Uploaded raw results artifact: ${rawResultsArtifactName}`);
      }
    } else {
      core.info(
        'Raw results artifact upload will be handled by the composite action step (ACTIONS_RUNTIME_TOKEN not available in this process)',
      );
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
