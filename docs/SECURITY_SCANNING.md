# APP2 Security Scanning

This guide describes the automated security checks added on the
`security-tooling/app2-scanners-2026-11-25` branch. It supplements the
existing CodeQL, npm audit and Dependabot workflows; it does not replace them.

## Existing repository controls

The published APP2 baseline already contains:

- **GitHub CodeQL** for JavaScript and TypeScript static analysis.
- **npm audit** for frontend and backend dependency audits, with the existing
  workflow configured to fail on high-severity findings.
- **Dependabot** for weekly updates to the root and backend npm dependencies.

The extended workflow adds the scanners below.

## Extended scanners

| Tool | Coverage | Execution and data handling |
| --- | --- | --- |
| Semgrep Community Edition | JavaScript/TypeScript and other supported source patterns; security-audit rules | Runs in a local container on the GitHub Actions runner. The Community Edition analyzes source locally and does not upload source code to Semgrep. Rule configuration is retrieved from the Semgrep registry. |
| Gitleaks | Secrets in the reachable Git commit history | Runs locally in a pinned container. The scan uses full redaction for reported secret values. |
| OSV-Scanner | Known vulnerabilities in supported dependency manifests and lockfiles | Uses Google's pinned OSV-Scanner action and OSV advisory data. Package names, versions and ecosystem metadata are queried; application source code is not uploaded. |
| Trivy | Dependency vulnerabilities, infrastructure/configuration misconfigurations and secrets | Runs filesystem scanning locally in a pinned container. It retrieves vulnerability databases; application source is not uploaded to Aqua. |

The Semgrep Community Edition is a useful baseline, not a complete substitute
for commercial cross-file and cross-function taint analysis. Findings require
human review. A clean scan is not proof that the application is secure.

## When the workflow runs

`.github/workflows/security-scans.yml` runs:

- On pushes to `main` and `security-tooling/**`.
- On pull requests targeting `main` or
  `publication/app2-clean-2026-11-18`.
- Weekly on Monday at 07:30 East Africa Time.
- Manually through GitHub Actions' `workflow_dispatch`.

Semgrep, Gitleaks and Trivy upload SARIF findings to GitHub Code Scanning.
OSV-Scanner runs as a separate CI job and reports dependency findings in its job output.
High/critical Trivy findings and scanner findings configured as errors fail
their respective jobs. Existing npm audit remains a separate check.

The automated Gitleaks job scans the current committed source snapshot. A separate
full-history Gitleaks job is available through the workflow's manual
`workflow_dispatch` trigger; that job scans all refs and has a 20-minute limit.
Historical scanning can reveal credentials that no longer exist in the current
files. A confirmed exposed credential must be revoked or rotated; deleting it from
the latest source tree is not sufficient.

## Run the local container scans from PowerShell

Open PowerShell in the app2 project root. These commands use Docker Desktop,
mount the source tree read-only, and do not install scanner packages into app2.

### Semgrep

```powershell
docker run --rm -e SEMGREP_SEND_METRICS=off -v "${PWD.Path}:/src:ro" -w /src semgrep/semgrep:1.187.0 semgrep scan --config p/security-audit --error .
```

### Gitleaks

```powershell
docker run --rm -v "${PWD.Path}:/repo:ro" -w /repo ghcr.io/gitleaks/gitleaks:v8.30.1 git --log-opts="--all" --redact=100 --no-banner /repo
```

### Trivy

```powershell
docker run --rm -v "${PWD.Path}:/workspace:ro" -w /workspace aquasec/trivy:0.76.2 fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL --exit-code 1 --skip-dirs .git /workspace
```

OSV-Scanner is run in GitHub Actions through Google's reusable workflow. A
standalone Windows CLI scan can be added to the local process after the
standalone binary's installation and version have been separately approved.

## Safe handling of findings

1. Review scanner output and confirm the finding before changing code.
2. For a real credential exposure, revoke/rotate the credential first and then
   assess repository-history remediation.
3. Do not automatically accept package upgrades. Check release notes,
   compatibility and app2 regression tests.
4. Record false positives with a narrow, documented exception; do not disable
   a scanner globally to hide one finding.
5. Re-run the relevant scanner and app2 regression tests after a correction.

These scanners do not modify app2 data, install dependencies into the project,
run database migrations, or start Felix/Ollama.
