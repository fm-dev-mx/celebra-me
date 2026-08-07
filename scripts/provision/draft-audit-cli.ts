/**
 * Read-only Draft contract audit.
 *
 * Detects non-canonical persisted drafts without rewriting them.
 *
 * Usage:
 *   pnpm invitation:draft-audit --slug <slug> [--target local|preview|production] [--json]
 */
import { auditDraftContract } from '../../src/lib/intake/services/draft-contract-audit.service.ts';
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
	if (!slug || slug.startsWith('--')) throw new Error('SLUG_REQUIRED: pass --slug <invitation-slug>.');
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
if (!state?.draft.content) {
	console.error(`DRAFT_NOT_FOUND: no active draft for ${slug} in ${target}.`);
	process.exitCode = 1;
} else {
	const audit = auditDraftContract(state.draft.content);
	const payload = {
		mode: 'read-only',
		slug,
		target,
		draftUpdatedAt: state.draft.updatedAt,
		publishedVersion: state.published.version,
		...audit,
	};
	if (json) console.log(JSON.stringify(payload, null, 2));
	else {
		console.log(`Draft contract audit — read-only (${target}/${slug})`);
		console.log(`Canonical: ${audit.canonical}`);
		console.log(`Violations (${audit.violations.length}):`);
		for (const violation of audit.violations) {
			console.log(`  - [${violation.kind}] ${violation.path}: ${violation.detail}`);
		}
		if (audit.violations.length === 0) console.log('  none');
	}
	if (!audit.canonical) process.exitCode = 2;
}
