import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

// Vercel and Cloudinary are retired: hosting runs on Cloudflare Workers and invitation media on
// R2. Any new mention outside the allow-list below means a removed path is coming back, so CI
// rejects it.
const RETIRED_PROVIDER_REFERENCE_MODE = 'error';

const RETIRED_PROVIDERS = [
	{ name: 'Vercel', pattern: /vercel/i },
	{ name: 'Cloudinary', pattern: /cloudinary/i },
];

const RETIRED_PROVIDER_ALLOWLIST = new Set([
	// History.
	'CHANGELOG.md',
	'pnpm-lock.yaml',
	'supabase/migration-rollout-registry.json',
	// Guards and their tests: they name the providers to reject them.
	'scripts/validate-retired-provider-references.mjs',
	'scripts/validate-structure.mjs',
	'scripts/agent/env-files.ts',
	'scripts/security/scan-secrets.mjs',
	'tests/unit/validate-structure-script.test.ts',
	'tests/unit/layout-web-analytics.test.ts',
	'tests/unit/hostname-validation.test.ts',
	'tests/unit/env-templates.test.ts',
	'tests/unit/deployment-workflow-contract.test.ts',
	'tests/unit/post-deploy-smoke.test.ts',
	'tests/scripts/operational-contracts.test.ts',
	// Proves the schema rejects live Cloudinary rows and keeps soft-deleted ones as history.
	'supabase/tests/invitation_assets_r2_provider.test.sql',
	// Proves the purge migration deletes only soft-deleted Cloudinary rows.
	'tests/unit/invitation-assets-cloudinary-purge-migration.test.ts',
]);
// Migrations are history.
const RETIRED_PROVIDER_ALLOWLIST_PREFIXES = ['supabase/migrations/'];

function isAllowlisted(relativeFile) {
	return (
		RETIRED_PROVIDER_ALLOWLIST.has(relativeFile) ||
		RETIRED_PROVIDER_ALLOWLIST_PREFIXES.some((prefix) => relativeFile.startsWith(prefix))
	);
}

/** One finding per file and provider, with the count and the first line that mentions it. */
function findRetiredProviderReferences(root, trackedFiles) {
	const findings = [];
	for (const trackedFile of trackedFiles) {
		const relativeFile = normalizePath(trackedFile);
		if (isAllowlisted(relativeFile)) continue;
		const absolute = path.join(root, ...relativeFile.split('/'));
		if (!existsSync(absolute)) continue;
		let content;
		try {
			content = readFileSync(absolute, 'utf8');
		} catch {
			continue;
		}
		if (content.includes('\0')) continue;
		const lines = content.split(/\r?\n/);
		for (const provider of RETIRED_PROVIDERS) {
			let count = 0;
			let firstLine = 0;
			lines.forEach((lineText, idx) => {
				if (!provider.pattern.test(lineText)) return;
				count += 1;
				if (firstLine === 0) firstLine = idx + 1;
			});
			if (count > 0) {
				findings.push(
					`${relativeFile}:${firstLine}: names retired provider ${provider.name} on ${count} line(s).`,
				);
			}
		}
	}
	return findings;
}

/** Routes the findings to errors or warnings according to the mode. */
export function validateNoVercelReferences(
	root,
	trackedFiles,
	mode = RETIRED_PROVIDER_REFERENCE_MODE,
) {
	const findings = findRetiredProviderReferences(root, trackedFiles);
	return mode === 'error'
		? { errors: findings, warnings: [] }
		: { errors: [], warnings: findings };
}

/** Prints warning-mode findings to stderr without failing the run. */
export function reportRetiredProviderWarnings(warnings) {
	if (warnings.length === 0) return;
	console.warn(`Structural validation warnings (${warnings.length}): retired providers named.`);
	for (const warning of warnings) console.warn(`  - ${warning}`);
}
