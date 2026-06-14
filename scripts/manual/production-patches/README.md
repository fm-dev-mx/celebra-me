# Manual Production Patches

This folder contains historical production repair scripts and current manifest-bearing patch
preparation files.

## Current Rule

New or reusable production SQL patches must include the required manual SQL manifest and must pass
both:

```bash
pnpm db:sql:lint -- --file <path>
pnpm db:prod:patch -- --file <path>
```

`pnpm db:prod:patch` is dry-run lint only. It does not open a database connection and does not
execute SQL.

## Historical Records

Older files in this directory that do not start with `-- @script-id:` predate the current manifest
contract. They are retained only as historical records. Do not copy them as templates for new
production work.
