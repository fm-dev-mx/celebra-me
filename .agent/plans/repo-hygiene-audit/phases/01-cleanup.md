# Phase 01: Initial Purge

## Objective

Remove transient logs and orphaned directories that clutter the repository root and increase
cognitive load.

## Tasks

- [ ] Delete `full_test.log`, `test.log`, `test_output.txt`, `tests_out.log`, `tests_out_esm.log`
      from root. [weight: 40%]
- [ ] Remove `tracking/` directory (orphaned README). [weight: 20%]
- [ ] Evaluate and remove `archive/` root directory (archive contents to be moved to
      `src/content/archive` if needed). [weight: 30%]
- [ ] Verify `.gitignore` explicitly covers all `*.log` patterns. [weight: 10%]

## Acceptance Criteria

- No log files exist in the project root.
- `tracking/` and `archive/` directories are removed.
- `git status` shows no untracked log files.

## References

- Root Directory Audit Findings (Audit Dimensional 1)
