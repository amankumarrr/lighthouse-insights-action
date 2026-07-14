import * as core from '@actions/core';

export async function publishStepSummary(report: string): Promise<void> {
  await core.summary.addRaw(report, true).write();
}
