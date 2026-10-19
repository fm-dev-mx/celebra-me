import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

// Vercel and Cloudinary are retired: hosting runs on Cloudflare Workers and invitation media on
// R2. Any new mention outside the history below means a removed path is coming back. The mode
// stays `warn` while the remaining documentation is rewritten; switch it to `error` once the
// tracked tree is clean so CI rejects regressions.
const RETIRED_PROVIDER_REFERENCE_MODE = 'warn';

const RETIRED_PROVIDERS = [
	{ name: 'Vercel', pattern: /vercel/i },
	{ name: 'Cloudinary', pattern: /cloudinary/i },
];

// History and guards that must keep naming the retired providers.
const RETIRED_PROVIDER_ALLOWLIST = new Set([
	'CHANGELOG.md',
	'pnpm-lock.yaml',
	'supabase/migration-rollout-registry.json',
	'.agent/plans/active/cloudflare-workers-migration.md',
	'.agent/plans/active/vercel-cloudflare-closeout.md',
	'scripts/validate-retired-provider-references.mjs',
	'scripts/validate-structure.mjs',
	'tests/unit/validate-structure-script.test.ts',
	'tests/unit/layout-web-analytics.test.ts',
]);
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

/** Prints the findings to stderr without failing the run. */
export function reportRetiredProviderWarnings(warnings) {
	if (warnings.length === 0) return;
	console.warn(`Structural validation warnings (${warnings.length}): retired providers named.`);
	for (const warning of warnings) console.warn(`  - ${warning}`);
}
