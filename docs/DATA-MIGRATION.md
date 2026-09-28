# Legacy audit and import decisions

Source branch: feature/crm-v2, base commit 3811c023bbebe943ca8f9ed3ea610bc0f2af3ef5.

All original tracked files were inspected: index.html, app.js, styles.css, serve.sh, README.md, CODEX_PROMPT.md and all three JSON datasets. The original static files and datasets remain unchanged. Next.js serves the new UI; the old HTML is a preserved reference, not a production entry point.

- data/projects.json: 372 objects; stable string IDs (`city-001`, regional IDs), 331 coordinate pairs. All original properties persist under projects.legacy. Explicit columns cover current editable values. Text dates remain text because many values are qualified estimates rather than dates.
- data/participants.json: 796 participant records. `objectIds` link to project `shaffofId`. A participant can link to many projects.
- data/meta.json: original export metadata.
- developer/client/designer/contractor become explicit company-role links. Embedded participantLinks are imported too and duplicate relationships are suppressed by stable ID.
- Names and all source statements are retained verbatim. Free-text participant descriptions are not interpreted as verified people or legal entities.
- Company identity: exact INN first; a unique known INN for an exact normalized name second; normalized name for unidentified companies otherwise. Conflicting INNs are kept separate. Fuzzy results are review suggestions only, never automatic merge criteria.
- Company, contact, participant and source UUIDs are deterministic SHA-256-derived IDs. This makes imports repeatable without modifying the source.
- Existing CRM records are conflict-ignored on reimport, preserving edits. This is an initial import, not an upstream synchronization system. Updating source data later requires a reviewed migration.
- The import is a single database transaction, executable only by service_role. Errors roll back the entire import.
- Data with ambiguous names stays visible and is flagged in work/import-report.json. No inferred split into multiple companies is performed.

Verified dry-run results:

```
Projects imported: 372
Companies created: 810
Companies matched: 2386
Participants created: 1755
Coordinates imported: 331
Warnings: 7
```

`Companies matched` counts encounters resolved to an existing company during transformation, not separate companies or writes. Counts are prepared records; on subsequent --apply runs existing records are not rewritten.

Warnings include combined CMWP/anchor tenant text, Radisson memorandum text, Chapman Taylor/L.BURO/Daikin text, and four compound legal-name/alias records. Review these manually before treating them as verified identities.

Files previously uploaded into MVP IndexedDB are local to the browser, not present in Git. Download those originals in the old MVP and upload them into the new project cards. The importer cannot retrieve another browser's IndexedDB.
