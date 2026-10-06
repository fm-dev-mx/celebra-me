#!/usr/bin/env node
// check-dashboard-styles.mjs
// Checks dashboard SCSS for prohibited token patterns and for custom properties
// that no dashboard preset, partial or global token file defines.
// Scope: the dashboard partials, the dashboard/auth presets and the preview
// banner loaded on the dashboard preview route. Invitation profiles define
// their own local tokens and are out of scope.
// Exit 0 = clean. Exit 1 = violations found.
// Usage: pnpm validate:dashboard-styles

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ok = (label) => console.log(`  OK: ${label}`);
const fail = (label) => {
	console.log(`FAIL: ${label}`);
	return true;
};

const listFiles = (dir, extensions) =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return listFiles(path, extensions);
		return extensions.some((ext) => name.endsWith(ext)) ? [path] : [];
	});
const listScss = (dir) => listFiles(dir, ['.scss']);

const DASHBOARD_PARTIALS = listScss('src/styles/dashboard');
const PRESETS = [
	'src/styles/themes/presets/_dashboard-ivory.scss',
	'src/styles/themes/presets/_auth-dark.scss',
];
const SCOPED_FILES = [
	...DASHBOARD_PARTIALS,
	...PRESETS,
	'src/styles/invitation/_preview-banner.scss',
];
const GLOBAL_TOKEN_FILES = [
	'src/styles/global.scss',
	...listScss('src/styles/tokens'),
	...listScss('src/styles/global'),
];
// Components that set custom properties from JS (e.g. the editor preview scale) count as definitions.
const COMPONENT_DIRS = ['src/components/dashboard', 'src/pages/dashboard', 'src/layouts'];

const readAll = (files) => files.map((file) => ({ file, text: readFileSync(file, 'utf8') }));

const countPattern = (pattern, sources) =>
	sources.reduce((sum, { text }) => sum + (text.match(pattern) ?? []).length, 0);

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const definedTokens = (sources) => {
	const names = new Set();
	for (const { text } of sources) {
		for (const match of stripComments(text).matchAll(/(^|[\s;{])(--[a-z0-9-]+)\s*:/gi)) {
			names.add(match[2]);
		}
	}
	return names;
};

let hasFailures = false;
const scoped = readAll(SCOPED_FILES);
const dashboard = readAll(DASHBOARD_PARTIALS);

console.log('=== Dashboard Style Token Check ===\n');

const PROHIBITED = [
	['--color-state-error', 'use --color-state-danger'],
	['--color-text-inverse', 'use --color-text-on-dark or --color-text-on-light'],
	['--color-bg-subtle', 'use --color-surface-soft'],
	['--color-action-accent-contrast', 'use --color-text-on-light'],
];
for (const [token, hint] of PROHIBITED) {
	if (countPattern(new RegExp(token, 'g'), scoped) > 0)
		hasFailures = fail(`${token} should not exist (${hint})`);
	else ok(`${token} not found`);
}

// Bare --color-text (without suffix like -primary, -secondary)
const bareTextCount = countPattern(/--color-text(?![-a-zA-Z0-9])/g, dashboard);
if (bareTextCount > 0)
	hasFailures = fail(
		`bare --color-text found in dashboard (${bareTextCount} occurrence(s)), should be --color-text-primary`,
	);
else ok('no bare --color-text in dashboard');

// Custom properties consumed without a fallback that nothing in scope defines
const known = definedTokens([...readAll(PRESETS), ...dashboard, ...readAll(GLOBAL_TOKEN_FILES)]);
for (const { text } of readAll(
	COMPONENT_DIRS.flatMap((dir) => listFiles(dir, ['.tsx', '.ts', '.astro'])),
)) {
	for (const match of text.matchAll(/['"](--[a-z0-9-]+)['"]/gi)) known.add(match[1]);
}
const undefinedUses = [];
for (const { file, text } of dashboard) {
	for (const match of stripComments(text).matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)) {
		if (!known.has(match[1])) undefinedUses.push(`${match[1]} in ${file}`);
	}
}
if (undefinedUses.length > 0) {
	hasFailures = fail(
		`${undefinedUses.length} custom propert${undefinedUses.length === 1 ? 'y is' : 'ies are'} used without a definition or fallback:`,
	);
	for (const use of [...new Set(undefinedUses)].sort()) console.log(`      ${use}`);
} else ok('every custom property used in dashboard partials is defined');

console.log('');
if (hasFailures) {
	console.log('✗ Violations found. Fix before merging.');
	process.exit(1);
} else {
	console.log('✓ All checks passed.');
	process.exit(0);
}
