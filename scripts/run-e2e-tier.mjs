#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';

const TIERS = {
	infra: ['tests/e2e/social-preview.audit.spec.ts', 'tests/e2e/layout-verify-fix.spec.ts'],
	visual: [
		'tests/e2e/valentina-face-audit.spec.ts',
		'tests/e2e/ximena-premiere.audit.spec.ts',
		'tests/e2e/xv-demo-premium-audit.spec.ts',
		'tests/e2e/structural-variant-portability.spec.ts',
		'tests/e2e/canonical-invitation-page-parity.spec.ts',
	],
};

// Supabase credentials are required for infra tier (invitation routes read from DB).
// The visual/portability tier is self-contained: it uses only the Astro dev server
// with synthetic fixture data and does not need live Supabase credentials.
const SUPABASE_REQUIRED_TIERS = new Set(['infra']);
const REQUIRED_SUPABASE_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

const tier = process.argv[2];
if (!tier || !(tier in TIERS)) {
	console.error(`Usage: node scripts/run-e2e-tier.mjs <${Object.keys(TIERS).join('|')}>`);
	process.exit(1);
}

if (SUPABASE_REQUIRED_TIERS.has(tier)) {
	const fileEnv = loadEnv('development', process.cwd(), '');
	const missingEnv = REQUIRED_SUPABASE_ENV.filter(
		(key) => !process.env[key]?.trim() && !fileEnv[key]?.trim(),
	);
	if (missingEnv.length > 0) {
		console.error(`Cannot run test:e2e:${tier}; missing required environment variables:`);
		for (const key of missingEnv) console.error(`  - ${key}`);
		console.error('Configure the local Supabase environment described in docs/env-workflow.md.');
		process.exit(1);
	}
}

const result = spawnSync('pnpm', ['exec', 'playwright', 'test', ...TIERS[tier]], {
	cwd: process.cwd(),
	stdio: 'inherit',
	env: process.env,
	shell: process.platform === 'win32',
	maxBuffer: 10 * 1024 * 1024,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
