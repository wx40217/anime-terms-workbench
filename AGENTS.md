<INSTRUCTIONS>
Always respond in Chinese-simplified.

## Before Working

- Read `CONTEXT.md`.
- Read the ADRs in `docs/adr/` that touch the task.

## Repository Boundary

- This repository owns anime glossary research, evidence, local tooling, candidate data, and review records.
- `/Users/zhuleiye02/Git/terms` is the delivery repository. Keep its `main` branch clean.
- Create a short-lived feature branch in the delivery repository only when preparing upstreamable metadata, glossary CSV files, public index changes, or repository-wide validation improvements.
- Do not copy raw pages, caches, temporary artifacts, browser data, credentials, or secrets into either repository.

## Editing

- Keep changes limited to the active task.
- Use `apply_patch` for manual file edits.
- Do not commit generated delivery files here unless they are fixtures explicitly used by workbench tests.
</INSTRUCTIONS>
