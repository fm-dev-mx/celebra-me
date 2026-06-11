#!/usr/bin/env node
// check-dashboard-styles.mjs
// Checks dashboard SCSS for prohibited token patterns.
// Exit 0 = clean. Exit 1 = violations found.
// Usage: node scripts/check-dashboard-styles.mjs

import { execSync } from 'child_process';

const ok = (label) => console.log(`  OK: ${label}`);
const fail = (label) => {
	console.log(`FAIL: ${label}`);
	return true;
};

const rg = (pattern, path) => {
	try {
		const out = execSync(`rg -c -e "${pattern}" "${path}"`, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const total = out
			.trim()
			.split('\n')
			.reduce((sum, line) => {
				const m = line.match(/:(\d+)$/);
				return sum + (m ? parseInt(m[1], 10) : 0);
			}, 0);
		return total;
	} catch {
		return 0;
	}
};

let hasFailures = false;
const allStyles = 'src/styles';
const dashboard = 'src/styles/dashboard';

console.log('=== Dashboard Style Token Check ===\n');

// --color-state-error
if (rg('--color-state-error', allStyles) > 0)
	hasFailures = fail('--color-state-error should not exist (use --color-state-danger)');
else ok('--color-state-error not found');

// --color-text-inverse
if (rg('--color-text-inverse', allStyles) > 0)
	hasFailures = fail('--color-text-inverse should not exist');
else ok('--color-text-inverse not found');

// --color-bg-subtle
if (rg('--color-bg-subtle', allStyles) > 0)
	hasFailures = fail('--color-bg-subtle should not exist');
else ok('--color-bg-subtle not found');

// --color-action-accent-contrast
if (rg('--color-action-accent-contrast', allStyles) > 0)
	hasFailures = fail('--color-action-accent-contrast should not exist');
else ok('--color-action-accent-contrast not found');

// Bare --color-text (without suffix like -primary, -secondary)
const bareTextCount = rg('--color-text[^-a-zA-Z0-9]', dashboard) + rg('--color-text$', dashboard);
if (bareTextCount > 0)
	hasFailures = fail(
		`bare --color-text found in dashboard (${bareTextCount} occurrence(s)), should be --color-text-primary`,
	);
else ok('no bare --color-text in dashboard');

console.log('');
if (hasFailures) {
	console.log('✗ Violations found. Fix before merging.');
	process.exit(1);
} else {
	console.log('✓ All checks passed.');
	process.exit(0);
}
