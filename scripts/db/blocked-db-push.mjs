#!/usr/bin/env node

console.error(
	'Blocked: `pnpm db:push` is intentionally disabled because it can target a linked remote Supabase project.',
);
console.error(
	'Use local reset/validation commands for local work, or `pnpm db:prod:migrate` for reviewed production migrations.',
);
process.exit(1);
