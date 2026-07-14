# Development guide

This document is for contributors working on **lighthouse-insights-action** itself.  
For using the action in a pipeline, see the root [README.md](../README.md).

## Requirements

- Node.js 20+ (24 recommended for CI parity)
- npm
- Chrome/Chromium for live Lighthouse audits

## Setup

```bash
npm install

# On Windows, if Biome postinstall fails:
npm install --ignore-scripts
```

## Common commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run all          # lint + typecheck + test + build
```

`npm run build` bundles the action into `dist/` with `@vercel/ncc`. The committed `dist/` directory is what GitHub Actions executes.

## Local verification

### Offline (fixtures, no Chrome / network)

```bash
npm run local:fixture
npm run local:fixture:pr
```

### Live audit

```bash
npm run local -- https://example.com
npm run local:live          # audits https://aman-kumar.dev
```

### Report-only (existing `.lighthouseci`)

```bash
npm run local -- https://example.com   # collect first
npm run local:report
```

### CLI flags

| Flag | Purpose |
| --- | --- |
| `--fixture` | Use `fixtures/lighthouseci` (offline) |
| `--skip-collect` | Skip LHCI; only generate Markdown |
| `--pr` | PR comparison mode |
| `--production-report <file>` | Baseline Markdown for comparisons |
| `--out <file>` | Output path for the generated report |
| `--config <path>` | Custom LHCI config |
| `--help` | Show CLI help |

Successful runs print the Markdown table, write a report file, and exit `0` only if verification passes. Logs are also written to `local-run.log`.

## Repo CI workflows

| Workflow | When | What |
| --- | --- | --- |
| `.github/workflows/ci.yml` | PR + push to main | Lint, typecheck, unit tests, build, fixture verification |
| `.github/workflows/lighthouse-pr.yml` | PR + push to main | Live audit of `https://aman-kumar.dev` |

Live audit behavior:

- **Pull requests** — report posted/updated as a PR comment and written to the job summary
- **Merges to main** — report written to the job summary only

## Project layout

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
  prod-lighthouse-report.md       # Baseline used by local:fixture:pr
docs/
  development.md                  # This file
```

Report generation behavior is intentionally aligned with `scripts/generate-lighthouse-report.py`. Do **not** invoke the Python script from the GitHub Action — TypeScript is the production implementation.

## Architecture notes

- Keep business logic independent from `@actions/*` so it stays unit-testable.
- `src/index.ts` should only orchestrate inputs → LHCI → parse → report → GitHub side effects.
- Prefer small single-responsibility modules.

## Release process

1. Update the version in `package.json` if needed
2. Run `npm run all` and fix any failures
3. Commit the built `dist/` directory (required for GitHub Actions consumers)
4. Tag and push a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

5. Optionally move the major version tag (`v1`) to the new release

Consumers should pin to `@v1` or a specific release tag.
