/**
 * Read-only Published content migration audit.
 *
 * Inventories legacy venue date/time prose and showFlourishes ownership conflicts.
 * Never mutates data.
 *
 * Usage:
 *   pnpm invitation:published-audit --slug <slug> [--target local|preview|production] [--json]
 */
import { auditPublishedContent } from '../../src/lib/intake/services/published-content-audit.service.ts';
import type { DraftCanonicalizationTarget } from './draft-canonicalization.ts';
import {
	readDraftCanonicalizationState,
	resolveTargetDbUrl,
} from './draft-canonicalization-service.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');

function value(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function requireSlug(): string {
	const slug = value('--slug');
	if (!slug || slug.startsWith('--'))
		throw new Error('SLUG_REQUIRED: pass --slug <invitation-slug>.');
	return slug;
}

function requireTarget(): DraftCanonicalizationTarget {
	const target = value('--target') ?? 'local';
	if (target !== 'local' && target !== 'preview' && target !== 'production') {
		throw new Error('TARGET_INVALID: --target must be local, preview or production.');
	}
	return target;
}

const slug = requireSlug();
const target = requireTarget();
const dbUrl = resolveTargetDbUrl(target);
const state = readDraftCanonicalizationState(slug, dbUrl);
if (!state?.published.content) {
	console.error(`PUBLISHED_NOT_FOUND: no published content for ${slug} in ${target}.`);
	process.exitCode = 1;
} else {
	const audit = auditPublishedContent(state.published.content as Record<string, unknown>);
	const actionable = audit.findings.filter((f) => f.kind !== 'canonical_datetime');
	const payload = {
		mode: 'read-only',
		slug,
		target,
		publishedVersion: state.published.version,
		...audit,
		actionableFindings: actionable,
	};
	if (json) {
		console.log(JSON.stringify(payload, null, 2));
	} else {
		console.log(`Published content audit — read-only (${target}/${slug})`);
		console.log(`Ready for machine migration: ${audit.readyForMachineMigration}`);
		console.log(
			`Legacy date/time: ${audit.legacyDateTimeCount}; safe conversions: ${audit.safeConversionCount}; unparseable: ${audit.unparseableCount}; showFlourishes conflicts: ${audit.showFlourishesConflicts}`,
		);
		console.log(`Findings (${actionable.length}):`);
		for (const finding of actionable) {
			const conversion = finding.canonical ? ` → ${finding.canonical}` : '';
			console.log(
				`  - [${finding.kind}] ${finding.path}: ${finding.detail}${finding.current ? ` (${finding.current}${conversion})` : ''}`,
			);
		}
		if (actionable.length === 0) console.log('  none');
	}
	if (!audit.readyForMachineMigration) process.exitCode = 2;
}
