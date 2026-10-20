#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';

const TIERS = {
	// Opt-in contracts outside test:e2e:ci, plus authoring guards for invitations that are still
	// active or in progress. Delete a client spec when its invitation is archived.
	extended: [
		'tests/e2e/canonical-managed-contracts.spec.ts',
		'tests/e2e/event-location-navigation-contract.spec.ts',
		'tests/e2e/gallery-mobile-rail.spec.ts',
		'tests/e2e/invitation-motion-system.spec.ts',
		'tests/e2e/invitation-progressive-visibility.spec.ts',
		'tests/e2e/invitation-visual-contracts.spec.ts',
		'tests/e2e/layout-verify-fix.spec.ts',
		'tests/e2e/login.scenarios.test.ts',
		'tests/e2e/raster-seal-layout-regression.spec.ts',
		'tests/e2e/destenid-cover-hero-distinct.spec.ts',
		'tests/e2e/destenid-face-safety.spec.ts',
		'tests/e2e/editorial-cover-collector.spec.ts',
		'tests/e2e/america-invitation.spec.ts',
		'tests/e2e/melissa-y-luis-osmar.spec.ts',
		'tests/e2e/norma-invitation.spec.ts',
		'tests/e2e/xv-demo-premium-audit.spec.ts',
	],
};

// Complete invitation captures resolve published content through the normal server path.
// Synthetic variant fixtures alone do not provision the canonical invitation corpus.
const REQUIRED_SUPABASE_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

const tier = process.argv[2];
if (!tier || !(tier in TIERS)) {
	console.error(`Usage: node scripts/run-e2e-tier.mjs <${Object.keys(TIERS).join('|')}>`);
	process.exit(1);
}

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

const result = spawnSync('pnpm', ['exec', 'playwright', 'test', ...TIERS[tier]], {
	cwd: process.cwd(),
	stdio: 'inherit',
	env: process.env,
	shell: process.platform === 'win32',
	maxBuffer: 10 * 1024 * 1024,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
