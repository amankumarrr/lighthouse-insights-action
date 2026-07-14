# Lighthouse Insights Action

GitHub Action that runs Lighthouse CI audits and generates human-friendly Markdown reports — including pull request comparisons against a production baseline.

## Features

- Run Lighthouse CI audits from a single workflow step
- Simple mode (URLs only) or advanced mode (custom Lighthouse config)
- Generate Markdown reports with Performance, Accessibility, Best Practices, SEO, Bundle Size, and Unused Bundle Size
- Compare pull request results against a production baseline
- Highlight important pages with a ⭐ prefix
- Publish to GitHub Step Summary
- Upload Markdown report and optional raw `.lighthouseci` results as artifacts
- Expose outputs for downstream workflow steps

## Installation

Add the action to a workflow:

```yaml
- name: Lighthouse CI
  uses: owner/lighthouse-insights-action@v1
  with:
    urls: |
      https://example.com
      https://example.com/about
```

## Inputs

| Input | Description | Default |
| --- | --- | --- |
| `urls` | Newline-separated list of URLs to audit (simple mode) | |
| `config-path` | Path to a Lighthouse CI configuration file (takes precedence over `urls`) | |
| `results-path` | Directory containing Lighthouse CI results | `.lighthouseci` |
| `production-report` | Production baseline Markdown report for PR comparisons | `prod-lighthouse-report.md` |
| `upload-summary` | Publish the report to the GitHub Step Summary | `true` |
| `upload-report` | Upload the Markdown report as a workflow artifact | `true` |
| `upload-raw-results` | Upload the raw Lighthouse CI results directory | `false` |
| `report-artifact-name` | Artifact name for the Markdown report | `lighthouse-report` |
| `raw-results-artifact-name` | Artifact name for raw Lighthouse CI results | `lighthouse-results` |
| `important-paths` | Comma-separated URL paths to highlight with ⭐ | `/,/consulting/net-upgrade,/consulting/web-applications` |

## Outputs

| Output | Description |
| --- | --- |
| `report` | Generated Markdown report content |
| `report-path` | Path to the written Markdown report file |
| `results-path` | Path to the Lighthouse CI results directory |
| `report-artifact-name` | Name of the uploaded Markdown report artifact (empty if not uploaded) |
| `raw-results-artifact-name` | Name of the uploaded raw results artifact (empty if not uploaded) |

## Simple usage

```yaml
name: Lighthouse

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lighthouse CI
        uses: owner/lighthouse-insights-action@v1
        with:
          urls: |
            https://example.com
            https://example.com/about
          upload-report: true
          upload-raw-results: true
```

## Advanced usage

Provide your own Lighthouse CI configuration. When `config-path` is set, it takes precedence over `urls`.

```yaml
- name: Lighthouse CI
  uses: owner/lighthouse-insights-action@v1
  with:
    config-path: ./.lighthouserc.json
    upload-report: true
```

Example `.lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "url": ["https://example.com"],
      "numberOfRuns": 1
    },
    "upload": {
      "target": "filesystem",
      "outputDir": ".lighthouseci"
    }
  }
}
```

## Pull request comparison

On `pull_request` events the action:

1. Reads the production baseline report (`production-report`)
2. Compares scores and bundle sizes against the PR run
3. Shows improvements (⬆️) and regressions (⬇️) in the Markdown table

Ensure the production report artifact or file is available in the PR job (for example via `actions/download-artifact`).

```yaml
- uses: actions/download-artifact@v4
  with:
    name: lighthouse-report
    path: .

- name: Lighthouse CI
  uses: owner/lighthouse-insights-action@v1
  with:
    urls: |
      https://pr-slot.example.com
    production-report: prod-lighthouse-report.md
```

On non-PR events the action writes `prod-lighthouse-report.md` (or the path from `production-report`) for use as the next baseline.

## Artifact uploads

Uploads are independently configurable:

| Input | Artifact contents |
| --- | --- |
| `upload-report: true` | Generated Markdown report |
| `upload-raw-results: true` | Full `.lighthouseci` directory (`manifest.json`, `*.report.json`, `*.html`, …) |

```yaml
- name: Lighthouse CI
  uses: owner/lighthouse-insights-action@v1
  with:
    urls: |
      https://example.com
    upload-report: true
    upload-raw-results: true
    report-artifact-name: lighthouse-report
    raw-results-artifact-name: lighthouse-results
```

## Development

Requirements: Node.js 20+

```bash
npm install
# On Windows, if Biome postinstall fails:
# npm install --ignore-scripts

npm run lint
npm run typecheck
npm test
npm run build
```

Or run everything:

```bash
npm run all
```

### Run locally and verify results

Offline smoke test (no Chrome / no network) — uses bundled fixtures and checks the report shape:

```bash
npm run local:fixture
```

PR comparison against the fixture baseline:

```bash
npm run local:fixture:pr
```

Live audit against a real URL (requires Chrome/Chromium):

```bash
npm run local -- https://example.com
npm run local:live   # audits https://aman-kumar.dev
```

On pull requests, `.github/workflows/lighthouse-pr.yml` audits `https://aman-kumar.dev` and posts/updates a PR comment with the Markdown report.

On merges to `main`/`master`, the same audit runs and the report is published to the GitHub Actions **job summary** (no PR comment).

Generate a report from an existing `.lighthouseci` directory (only after a successful collect):

```bash
npm run local -- https://example.com
npm run local:report
```

Useful flags:

| Flag | Purpose |
| --- | --- |
| `--fixture` | Use `fixtures/lighthouseci` (offline) |
| `--skip-collect` | Skip LHCI; only generate Markdown |
| `--pr` | PR comparison mode |
| `--production-report <file>` | Baseline Markdown for comparisons |
| `--out <file>` | Output path for the generated report |
| `--config <path>` | Advanced mode with a custom LHCI config |
| `--help` | Show CLI help |

Successful runs print the Markdown table, write a report file, and exit `0` only if verification passes.

### Project layout

```text
src/
  index.ts                 # Action orchestrator
  lighthouse/              # CI runner and config generation
  parser/                  # Manifest, report, and treemap parsing
  report/                  # Markdown generation and PR comparison
  github/                  # Artifacts, summary, outputs
  models/                  # Shared types
  utils/                   # Filesystem, glob, logger helpers
scripts/
  run-local.ts                    # Local runner / verifier
  generate-lighthouse-report.py   # Reference implementation (not used at runtime)
fixtures/
  lighthouseci/                   # Sample LHCI results for offline runs
```

Report generation behavior is intentionally aligned with `scripts/generate-lighthouse-report.py`.

## Release process

1. Update the version in `package.json` if needed
2. Run `npm run all` and fix any failures
3. Commit the built `dist/` directory (required for GitHub Actions)
4. Tag and push a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

5. Optionally move the major version tag (`v1`) to the new release

Consumers should pin to a major version tag (for example `@v1`) or a specific release tag.
