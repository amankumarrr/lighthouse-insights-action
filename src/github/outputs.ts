import * as core from '@actions/core';

export interface ActionOutputs {
  report: string;
  reportPath: string;
  resultsPath: string;
  reportArtifactName: string;
  rawResultsArtifactName: string;
}

export function setActionOutputs(outputs: ActionOutputs): void {
  core.setOutput('report', outputs.report);
  core.setOutput('report-path', outputs.reportPath);
  core.setOutput('results-path', outputs.resultsPath);
  core.setOutput('report-artifact-name', outputs.reportArtifactName);
  core.setOutput('raw-results-artifact-name', outputs.rawResultsArtifactName);
}
