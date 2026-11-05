# Employee master import

## Latest team update — 5 November 2026

For `UNCIA_Employee_Master_Updated.xlsx`, use `node local/update-satish-team.mjs <extracted.json>` for a preview, `node local/check-satish-team.mjs <extracted.json>` for checks, then add `--apply` to apply. This workflow updates only GoLive, Quality Assurance and GoLive & QA, including Aylwin Titus's move into GoLive. The latest workbook reporting managers override the earlier flat-to-Satish correction. Hari KV, Raghuram Krishnan and Leslie report directly to Sagar, confirmed explicitly by the user. “Aylwin T” is resolved to the existing Aylwin Titus record. Existing designation edits, every vacancy, statuses, counts and unrelated records are retained. New people use Current Designation then Recommended Designation when no title exists. The workbook's framework-review prose is stored as source detail; it does not itself authorise designation changes.

Names ending with a unique E/C/TR employee ID are split into name and Employee ID. “NJ” means hired but not joined, as clarified by the user: those entries have status Yet to join and a blank employee ID marked pending. Conflicting IDs, ambiguous identities and unresolved managers stop the import. The report is `.local-data/imports/updated-satish-team-report.json`. The older full-master and flat GoLive scripts below describe historical imports and must not be used for this updated team workflow. An explicit `--refresh` alongside `--apply` permits reapplying the same source after a confirmed correction; normal repeat imports are blocked.

Correction confirmed on 4 November 2026: every employee whose Function is GoLive or GoLive & QA reports directly to Satish, overriding the workbook's Reporting Manager. Sagar remains the root and Satish reports to Sagar. Other functions continue using the workbook mapping. `node local/fix-golive-reporting.mjs <extracted.json>` applies only this correction, backs up the prior chart, and verifies that names, designations, headcounts, vacancies and all other records are unchanged.

This local workflow reads `Master Sheet` without changing the Excel file. The app and SQLite database remain local.

1. Run `local/extract-employee-master.py <source.xlsx> <ignored-local-output.json>` with the bundled Python runtime (openpyxl is used for reading only).
2. Build the app with `node local/build.mjs`.
3. Run `node local/import-employee-master.mjs <extracted.json>` to review the report without changing the chart.
4. Run `node local/check-employee-master.mjs <extracted.json>` to validate the proposed import.
5. Apply with `node local/import-employee-master.mjs <extracted.json> --apply` and restart the local app if its source changed.

The authorised scope is GoLive, GoLive & QA, Quality Assurance, CNG, CNG - Care, PEG, HR, PMG and IT Infrastructure. The workbook's Reporting Manager is authoritative, including reporting across functions. Sagar remains the root. Managers outside the agreed scope fall back to the functional head and receive a mapping note; missing Infra managers fall back to the existing Infra head. Administration, Finance, Marketing, Sales, UNCIA AI Labs and the workbook's PMO rows are excluded from this import. Existing PMO and AI placeholders remain in the chart.

Current Designation is used first, followed by an existing title, then Recommended Designation without its function suffix. A wholly missing designation stays blank with `designationMissing: true`; the app highlights it and requires a designation before that position can be saved through the editor. Current and recommended source designations remain visible in employee details.

Employee IDs identify named employees; explicit name aliases reconcile existing records with differing master spellings. Vacancies never receive employee IDs because the workbook repeats a real employee's ID on some TBH rows. Specifically labelled vacancies are reserved before generic TBH rows. All existing vacancies are retained, all workbook vacancies have individual records, and a repeated identical import is blocked by its source hash.

Newly identified employees can replace anonymous filled slots in the same functional branch. The source supplies their actual reporting, designation and assignments; reusing a slot does not establish a previous personal identity. Existing named employees and remaining unnamed positions absent from the master are retained and flagged for review. Existing “Yet to join” statuses remain until a source confirms joining.

All populated source columns are retained in employee details with sheet and row provenance. Skills, billing, locations, allocation, remarks, workload and availability are editable by super admins. Source designation and manager fields show the imported values. Search and CSV export include the extra information. Employee IDs must be unique among named non-vacant records. Viewers retain read-only access.

Before changing the chart, the importer writes a chart/catalog backup under `.local-data/backups/`. It updates the chart, catalog, undo history, import marker and audit record in one SQLite transaction. The report is `.local-data/imports/employee-master-validation.json`. The database, source extracts, backups and reports are ignored by Git; commits contain the app, importer and checks rather than live employee records.
