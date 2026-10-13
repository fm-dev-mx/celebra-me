/** Read-only audit of persisted draft documents. */
import { auditDraftContract } from '../../src/lib/intake/services/draft-contract-audit.service.ts';
import { flagValue, requireEnvironmentTarget } from '../lib/cli-args.ts';
import {
	listDraftInvitationSlugs,
	readPersistedInvitationContent,
	resolveTargetDbUrl,
	type PersistedContentTarget,
} from './persisted-invitation-content.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');

function auditSlug(slug: string, target: PersistedContentTarget, dbUrl: string) {
	const state = readPersistedInvitationContent(slug, dbUrl);
	if (!state?.draft.content) return null;
	return {
		mode: 'read-only' as const,
		slug,
		target,
		draftUpdatedAt: state.draft.updatedAt,
		publishedVersion: state.published.version,
		...auditDraftContract(state.draft.content),
	};
}

const target = requireEnvironmentTarget(args);
const dbUrl = resolveTargetDbUrl(target);
const slug = flagValue(args, '--slug');

if (args.includes('--all')) {
	const rows = listDraftInvitationSlugs(dbUrl)
		.map((item) => auditSlug(item, target, dbUrl))
		.filter((item): item is NonNullable<typeof item> => item !== null);
	const payload = {
		mode: 'read-only-inventory' as const,
		target,
		draftCount: rows.length,
		nonCanonicalCount: rows.filter((row) => !row.canonical).length,
		rows,
	};
	if (json) console.log(JSON.stringify(payload, null, 2));
	else
		console.log(
			`Draft contract inventory — read-only (${target}): ${payload.draftCount} drafts; ${payload.nonCanonicalCount} non-canonical.`,
		);
	if (payload.nonCanonicalCount > 0) process.exitCode = 2;
} else {
	if (!slug || slug.startsWith('--')) {
		throw new Error('SLUG_REQUIRED: pass --slug <invitation-slug> or --all.');
	}
	const payload = auditSlug(slug, target, dbUrl);
	if (!payload) {
		console.error(`DRAFT_NOT_FOUND: no active draft for ${slug} in ${target}.`);
		process.exitCode = 1;
	} else {
		if (json) console.log(JSON.stringify(payload, null, 2));
		else {
			console.log(`Draft contract audit — read-only (${target}/${slug})`);
			console.log(`Canonical: ${payload.canonical}`);
			for (const violation of payload.violations) {
				console.log(`  - [${violation.kind}] ${violation.path}: ${violation.detail}`);
			}
			if (payload.violations.length === 0) console.log('  none');
		}
		if (!payload.canonical) process.exitCode = 2;
	}
}
