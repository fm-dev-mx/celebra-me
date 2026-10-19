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
	'tests/unit/validate-structure-script.test.ts',
	'tests/unit/layout-web-analytics.test.ts',
	'tests/unit/hostname-validation.test.ts',
	'tests/unit/env-templates.test.ts',
	'tests/unit/deployment-workflow-contract.test.ts',
	'tests/unit/post-deploy-smoke.test.ts',
	'tests/scripts/operational-contracts.test.ts',
	// Until the owner closes the Vercel project and deletes the local `.vercel/` directory:
	// ignore rules, the Sign Worker origin of the backup deployment, and the rollback runbook.
	'.gitignore',
	'.prettierignore',
	'.vscode/settings.json',
	'eslint.config.js',
	'jest.config.cjs',
	// Until the contract migration drops provider='cloudinary': tests that prove legacy
	// Cloudinary rows and URLs are rejected, ignored or pruned.
	'tests/db/preview-sync-invitations.test.ts',
	'tests/provision/approval-asset-hashes.test.ts',
	'tests/provision/asset-reconciliation.test.ts',
	'tests/provision/content-parity.test.ts',
	'tests/provision/hosted-apply-post-verify.test.ts',
	'tests/provision/local-final-asset-verification.test.ts',
	'tests/provision/plan-id-fingerprint.test.ts',
	'tests/provision/preview-approval-service.test.ts',
	'tests/provision/preview-live-verification.test.ts',
	'tests/provision/promotion-comparison.test.ts',
	'tests/provision/promotional-fingerprint.test.ts',
	'tests/provision/semantic-delta.test.ts',
	'tests/unit/asset-delivery.test.ts',
	'tests/unit/draft-mutation.service.test.ts',
	'tests/unit/image-delivery-server.test.ts',
	'tests/unit/invitation-music-player-visibility.test.ts',
	'tests/unit/invitation-preview/preview-media-source.test.ts',
]);
// Migrations are history; database tests follow the schema they check.
const RETIRED_PROVIDER_ALLOWLIST_PREFIXES = ['supabase/migrations/', 'supabase/tests/'];

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
