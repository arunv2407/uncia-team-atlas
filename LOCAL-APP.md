# UNCIA Team Atlas — local app

Run `Start-Org-Chart.ps1`, then open http://127.0.0.1:5174/. Run `Stop-Org-Chart.ps1` to stop it. The app listens only on this computer, requires Node.js 24+, and does not use ChatGPT sign-in.

Only super admins can change the chart, add/edit/remove people, change reporting, undo edits, restore backups, or add designations and products through Manage lists. Every other account is a read-only Viewer, including the existing shared functional-head account. Viewers can search, filter, expand/collapse, inspect people, and export the directory. Everyone can change their own login password through My account. Super admins can manage logins and reset or disable accounts. The last active super admin cannot be disabled.

Designation is a required dropdown when adding or editing a person. Product/Assignment is an optional dropdown populated from existing assignment entries, with original client/product combinations retained. On the first upgrade, existing entries are copied into the product field; explicitly clearing it later remains cleared after restart. Separate client/project notes are retained.

Manage lists lets super admins add and rename both designations and products/assignments. Renaming updates all linked people atomically and records the change in history. Matching mirrored assignment text is updated too; distinct client/project notes are retained. Duplicate names are rejected. Undo restores both the catalog name and the affected people. Catalogs are saved in the same local database. Existing legacy `editor` database roles are interpreted as Viewer for compatibility; they have no chart-write access.

The database is `.local-data/atlas.sqlite`. It contains chart data, account password hashes, sessions and account activity. Do not publish this folder or include it in source control. Use the chart's Download backup for a portable JSON export of chart data; this does not include login accounts. For a complete backup, stop the app and copy `.local-data/`. Restart it afterward.

Local passwords use salted scrypt hashes. Session cookies are HttpOnly and SameSite=Strict. Sessions expire after 30 minutes idle or 8 hours total. Resetting a password or disabling an account revokes that account's sessions. Account and IP sign-in attempt limits apply. State-changing requests require a session CSRF token and matching origin.

## Later hosting and company sign-in

IT should provide a company server/cloud host, a company DNS name, HTTPS, persistent database storage, automatic service startup, backups, logging, and approved-user access rules. For this initial small deployment, one application instance with a persistent SQLite volume is sufficient. Use PostgreSQL before running multiple app replicas.

Integrate Microsoft Entra ID for Microsoft 365 or Google OpenID Connect for Google Workspace. Register the final HTTPS callback address, use the provider's stable subject ID to link identities, validate tokens on the server, enforce the approved user/group list, and retain a super-admin role. Company-email single sign-on is not implemented in this local release.

Before exposing the app to a network, configure its network binding and canonical HTTPS origin, secure cookies, reverse-proxy trust, and production deployment settings. The current server deliberately accepts only localhost requests. Do not simply expose port 5174 publicly.

Build changes with `node local/build.mjs`. Test with `node local/check-auth.mjs`. Source files are under `app/` and `local/`; generated browser assets and shared chart validators are in `local-dist/`. Existing Sites files are retained for history, but the standalone local app does not use them.

## Engineering and CARE screenshot imports — 2 November 2026

`local/peg-structure.mjs` transcribes the Engineering screenshot. Each named leader is counted once as a Technical Lead; unnamed contributors are designation-level groups. Engineering reconciles to 30 positions: 28 filled and 2 Software Engineer vacancies, including Denslyn. Product totals are LEAP 18, FLOW 8, PRIME 3, plus the head. Employment is Not specified because the screenshot does not identify which people are the two contract staff and one trainee. Validate with `node local/check-peg.mjs`.

`local/care-structure.mjs` reconciles CARE while reusing the existing named people and all nine vacancies. CARE reconciles to 27 positions: 16 filled, including 4 pending moves, 2 Yet to join, and 9 vacancies. Proposed reporting for pending moves is shown and the old manager is retained in notes. Six unmatched existing people keep their original reporting, designations and product fields and are flagged Mapping to confirm. One additional unnamed group of three filled positions records the remaining source headcount; its team/designation mapping is deliberately unassigned. Detailed per-product allocations remain provisional until these mappings are confirmed. Validate with `node local/check-care.mjs`.

The import scripts create chart-only backups under `.local-data/backups/`, record history, reject duplicate imports and preserve existing entries outside the affected scope. They have already been applied to this local database; do not rerun them on the same database. Account passwords and sessions are not included in the chart backups.

Unnamed resources and vacancies are individual count-one entries, including resources originally supplied as grouped designation counts. Filled placeholders have a blank name with Name pending, so each can be edited independently later. Existing names, reporting, products and statuses are preserved. Group by designation keeps these unnamed placeholders separate. Selecting Name not yet available allows a new unnamed person; entering a count greater than one creates that many separate entries on save. `node local/check-individual-entries.mjs` checks conversion and count preservation. The local database conversion script is idempotent and keeps a chart backup.
