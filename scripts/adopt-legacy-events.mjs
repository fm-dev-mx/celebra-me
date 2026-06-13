#!/usr/bin/env node

const ADOPT_LEGACY_EVENTS_DISABLED = true;

if (ADOPT_LEGACY_EVENTS_DISABLED) {
	console.error(
		'Blocked: adopt-legacy-events is disabled because it can mutate production with the service role.',
	);
	console.error(
		'Create a manifest-bearing production patch and run `pnpm db:prod:patch -- --file <path>` for dry-run linting.',
	);
	process.exit(1);
}
