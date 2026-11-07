# UNCIA Team Atlas

Organisation chart for Sagar's team, with employee details, individual vacancies, pending joiners, search and a collapsible hierarchy.

## Local application

Use Node.js 24 or newer. Install dependencies with `pnpm install --frozen-lockfile`, then build with `node local/build.mjs`. On an existing configured workspace, run `Start-Org-Chart.ps1` and open `http://127.0.0.1:5174/`. Stop with `Stop-Org-Chart.ps1`.

Viewing requires no login. **Sign in to edit** opens administrator authentication; only authenticated super admins can change the chart or manage lists and accounts. **Finish editing** ends the editor session and returns to read-only viewing. Credentials are provisioned separately and never stored in source or documentation.

The application server is `local/server.mjs`. Persistent data, password hashes, sessions, extracted workbooks and backups live under ignored `.local-data/`. A fresh checkout needs account/data setup; see `local/setup.mjs` and [LOCAL-APP.md](LOCAL-APP.md). Migrate live data privately when moving to another machine.

## Verification and master updates

- Build: `node local/build.mjs`
- Type check: `node node_modules/typescript/bin/tsc --noEmit`
- Public-view and authentication checks: `node local/check-auth.mjs`
- Consolidated master checks: `node local/check-consolidated.mjs <extracted-master.json>`
- Preview: `node local/import-consolidated.mjs <extracted-master.json>`; add `--apply` to save with a backup, undo history and audit entry.

Workbooks are read without modification through `local/extract-employee-master.py`. Earlier workflows are documented in [local/EMPLOYEE_MASTER_IMPORT.md](local/EMPLOYEE_MASTER_IMPORT.md). The consolidated workflow follows reporting ancestry connected to Sagar, reports other records separately and preserves vacancies, pending joiners and unmatched earlier positions for confirmation.

## Hosting

The repository contains application source. Live data and deployment credentials are supplied separately. IT must configure persistent storage, service startup, HTTPS/reverse proxy settings and backups. The local server binds to loopback and accepts localhost hosts only; review the host/origin and cookie configuration in [LOCAL-APP.md](LOCAL-APP.md) before hosting. Company-email SSO is not implemented. The retained Sites/Vinext files are historical framework support; the standalone Node server is the current application entry point.
