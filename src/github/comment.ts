import * as core from '@actions/core';
import * as github from '@actions/github';

const COMMENT_MARKER = '<!-- lighthouse-insights-action -->';

/**
 * Creates or updates a sticky PR comment with the Lighthouse Markdown report.
 * Requires `permissions: pull-requests: write` on the calling workflow job.
 */
export async function commentReportOnPullRequest(report: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      'comment-on-pr requires GITHUB_TOKEN. Ensure the workflow job has permissions.pull-requests: write',
    );
  }

  if (
    github.context.eventName !== 'pull_request' &&
    github.context.eventName !== 'pull_request_target'
  ) {
    core.warning(`comment-on-pr is enabled but event is "${github.context.eventName}"; skipping`);
    return;
  }

  const prNumber = github.context.payload.pull_request?.number;
  if (!prNumber) {
    core.warning('comment-on-pr is enabled but no pull request number was found; skipping');
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  const body = [
    COMMENT_MARKER,
    report.trim(),
    '',
    `_Updated by [Lighthouse Insights Action](${github.context.serverUrl}/${owner}/${repo}/actions/runs/${github.context.runId})_`,
  ].join('\n');

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const existing = comments.find(
    (comment) =>
      (comment.user?.type === 'Bot' || comment.user?.login?.includes('[bot]')) &&
      comment.body?.includes(COMMENT_MARKER),
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated existing PR comment #${existing.id}`);
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
  core.info(`Created PR comment on #${prNumber}`);
}
