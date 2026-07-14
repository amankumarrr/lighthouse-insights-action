# Lighthouse Insights Action

GitHub Action that runs Lighthouse CI audits and generates human-friendly Markdown reports — including pull request comparisons against a production baseline.

Use this when you want a **single workflow step** instead of stitching together LHCI, custom report scripts, and artifact uploads.

## Features

- Run Lighthouse CI from one action step
- Simple mode (`urls`) or advanced mode (`config-path`)
- Markdown report: Performance, Accessibility, Best Practices, SEO, Bundle Size, Unused Bundle
- PR vs production score/bundle comparison
- Important pages highlighted with ⭐
- GitHub Step Summary
- Optional Markdown + raw `.lighthouseci` artifact uploads
- Outputs for downstream steps

## Quick start

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
      - uses: actions/checkout@v6

      - name: Lighthouse CI
        id: lighthouse
        uses: amankumarrr/lighthouse-insights-action@v1
        with:
          urls: |
            https://example.com
            https://example.com/about
          upload-report: true
          upload-raw-results: true
```

The action will:

1. Run Lighthouse CI
2. Generate a Markdown report
3. Publish it to the job **Summary**
4. Upload artifacts (when enabled)
5. Set outputs such as `report` and `report-path`

## Inputs

| Input | Description | Default |
| --- | --- | --- |
| `urls` | Newline-separated URLs to audit (simple mode) | |
| `config-path` | Path to a Lighthouse CI config (takes precedence over `urls`) | |
| `results-path` | Directory for Lighthouse CI results | `.lighthouseci` |
| `production-report` | Production baseline Markdown used for PR comparisons | `prod-lighthouse-report.md` |
| `upload-summary` | Publish the report to the GitHub Step Summary | `true` |
| `upload-report` | Upload the Markdown report as an artifact | `true` |
| `upload-raw-results` | Upload the raw `.lighthouseci` results | `false` |
| `report-artifact-name` | Artifact name for the Markdown report | `lighthouse-report` |
| `raw-results-artifact-name` | Artifact name for raw results | `lighthouse-results` |
| `important-paths` | Comma-separated paths to highlight with ⭐ | `/,/consulting/net-upgrade,/consulting/web-applications` |

## Outputs

| Output | Description |
| --- | --- |
| `report` | Generated Markdown report content |
| `report-path` | Path to the written Markdown report file |
| `results-path` | Path to the Lighthouse CI results directory |
| `report-artifact-name` | Uploaded Markdown artifact name (empty if not uploaded) |
| `raw-results-artifact-name` | Uploaded raw-results artifact name (empty if not uploaded) |

Example:

```yaml
- name: Lighthouse CI
  id: lighthouse
  uses: amankumarrr/lighthouse-insights-action@v1
  with:
    urls: |
      https://example.com

- name: Use report output
  run: echo "${{ steps.lighthouse.outputs.report-path }}"
```

## Simple usage (URLs only)

```yaml
- name: Lighthouse CI
  uses: amankumarrr/lighthouse-insights-action@v1
  with:
    urls: |
      https://example.com
      https://example.com/about
```

The action generates a default Lighthouse CI configuration for you.

## Advanced usage (custom config)

When `config-path` is set, it takes precedence over `urls`.

```yaml
- name: Lighthouse CI
  uses: amankumarrr/lighthouse-insights-action@v1
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

1. Reads the production baseline (`production-report`)
2. Compares scores and bundle sizes against the current run
3. Shows improvements (⬆️) and regressions (⬇️) in the Markdown table

Make the baseline available in the PR job (for example by downloading an artifact from `main`):

```yaml
- uses: actions/download-artifact@v4
  with:
    name: lighthouse-report
    path: .

- name: Lighthouse CI
  uses: amankumarrr/lighthouse-insights-action@v1
  with:
    urls: |
      https://pr-slot.example.com
    production-report: prod-lighthouse-report.md
```

On non-PR events the action writes `prod-lighthouse-report.md` (or your `production-report` path) for use as the next baseline.

## Artifact uploads

| Input | What gets uploaded |
| --- | --- |
| `upload-report: true` | Generated Markdown report |
| `upload-raw-results: true` | Full `.lighthouseci` directory (`manifest.json`, `*.report.json`, `*.html`, …) |

```yaml
- name: Lighthouse CI
  uses: amankumarrr/lighthouse-insights-action@v1
  with:
    urls: |
      https://example.com
    upload-report: true
    upload-raw-results: true
    report-artifact-name: lighthouse-report
    raw-results-artifact-name: lighthouse-results
```

## Complete pipeline example

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
      - uses: actions/checkout@v6

      - name: Lighthouse CI
        id: lighthouse
        uses: amankumarrr/lighthouse-insights-action@v1
        with:
          urls: |
            https://example.com
            https://example.com/about
          upload-summary: true
          upload-report: true
          upload-raw-results: false
          production-report: prod-lighthouse-report.md

      - name: Show report path
        run: echo "Report at ${{ steps.lighthouse.outputs.report-path }}"
```

After the job finishes, open the workflow run **Summary** tab to view the Markdown report.

## Versioning

Pin to a major version or a specific release:

```yaml
uses: amankumarrr/lighthouse-insights-action@v1
# or
uses: amankumarrr/lighthouse-insights-action@v1.0.0
```

## Development

Contributor setup, local verification, project layout, and release steps live in **[docs/development.md](docs/development.md)**.
