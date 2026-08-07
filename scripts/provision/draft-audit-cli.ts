/**
 * Read-only Draft contract audit.
 *
 * Detects non-canonical persisted drafts without rewriting them.
 *
 * Usage:
 *   pnpm invitation:draft-audit --slug <slug> [--target local|preview|production] [--json]
 *   pnpm invitation:draft-audit --all [--target local|preview|production] [--json]
 */
import { auditDraftContract } from '../../src/lib/intake/services/draft-contract-audit.service.ts';
import {
	buildDraftCanonicalizationPlan,
	type DraftCanonicalizationTarget,
} from './draft-canonicalization.ts';
import {
	listDraftInvitationSlugs,
	readDraftCanonicalizationState,
	resolveTargetDbUrl,
} from './draft-canonicalization-service.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const all = args.includes('--all');

function value(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function requireTarget(): DraftCanonicalizationTarget {
	const target = value('--target') ?? 'local';
	if (target !== 'local' && target !== 'preview' && target !== 'production') {
		throw new Error('TARGET_INVALID: --target must be local, preview or production.');
	}
	return target;
}

function shapeKey(path: string): string {
	return path
		.replace(/\[\d+\]/g, '[]')
		.replace(/\.items$/, '.items')
		.trim();
}

interface InventoryRow {
	slug: string;
	canonical: boolean;
	violationShapes: string[];
	remediation: 'none' | 'safe_automatic_repair' | 'manual_review';
	remediationDetail?: string;
	effectiveContentUnchanged?: boolean;
}

function classifyRemediation(
	target: DraftCanonicalizationTarget,
	slug: string,
	state: NonNullable<ReturnType<typeof readDraftCanonicalizationState>>,
): Pick<InventoryRow, 'remediation' | 'remediationDetail' | 'effectiveContentUnchanged'> {
	if (!state.draft.content || !state.published.content) {
		return {
			remediation: 'manual_review',
			remediationDetail: 'missing draft or published content',
		};
	}
	try {
		const plan = buildDraftCanonicalizationPlan({
			target,
			slug,
			draftContent: state.draft.content,
			publishedContent: state.published.content,
			draftStatus: state.draft.status,
			draftUpdatedAt: state.draft.updatedAt,
			publishedVersion: state.published.version,
		});
		if (plan.alreadyCanonical) {
			return { remediation: 'none', effectiveContentUnchanged: true };
		}
		if (plan.effectiveContentUnchanged) {
			return {
				remediation: 'safe_automatic_repair',
				effectiveContentUnchanged: true,
			};
		}
		return {
			remediation: 'manual_review',
			remediationDetail: 'canonicalization would change effective content',
			effectiveContentUnchanged: false,
		};
	} catch (error) {
		return {
			remediation: 'manual_review',
			remediationDetail: error instanceof Error ? error.message : String(error),
		};
	}
}

function runSingle(slug: string, target: DraftCanonicalizationTarget, dbUrl: string): void {
	const state = readDraftCanonicalizationState(slug, dbUrl);
	if (!state?.draft.content) {
		console.error(`DRAFT_NOT_FOUND: no active draft for ${slug} in ${target}.`);
		process.exitCode = 1;
		return;
	}
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

function runInventory(target: DraftCanonicalizationTarget, dbUrl: string): void {
	const slugs = listDraftInvitationSlugs(dbUrl);
	const rows: InventoryRow[] = [];
	const shapeCounts = new Map<string, { invitations: Set<string>; kinds: Set<string> }>();

	for (const slug of slugs) {
		const state = readDraftCanonicalizationState(slug, dbUrl);
		if (!state?.draft.content) continue;
		const audit = auditDraftContract(state.draft.content);
		const violationShapes = [
			...new Set(audit.violations.map((violation) => shapeKey(violation.path))),
		].sort();
		const remediation = audit.canonical
			? { remediation: 'none' as const, effectiveContentUnchanged: true }
			: classifyRemediation(target, slug, state);

		rows.push({
			slug,
			canonical: audit.canonical,
			violationShapes,
			...remediation,
		});

		for (const violation of audit.violations) {
			const key = `${violation.kind}:${shapeKey(violation.path)}`;
			const entry = shapeCounts.get(key) ?? {
				invitations: new Set<string>(),
				kinds: new Set<string>(),
			};
			entry.invitations.add(slug);
			entry.kinds.add(violation.kind);
			shapeCounts.set(key, entry);
		}
	}

	const byShape = [...shapeCounts.entries()]
		.map(([key, value]) => {
			const [kind, ...pathParts] = key.split(':');
			const path = pathParts.join(':');
			const affected = [...value.invitations].sort();
			const sampleRows = rows.filter((row) => affected.includes(row.slug));
			const allSafe = sampleRows.every((row) => row.remediation === 'safe_automatic_repair');
			const anyManual = sampleRows.some((row) => row.remediation === 'manual_review');
			return {
				shape: path,
				kind,
				invitationsAffected: affected.length,
				slugs: affected,
				autoCanonicalizable: allSafe && !anyManual,
				action: allSafe
					? 'mapper/strip via invitation:draft-canonicalize'
					: anyManual
						? 'manual review'
						: 'mixed — inspect per invitation',
			};
		})
		.sort(
			(a, b) =>
				b.invitationsAffected - a.invitationsAffected || a.shape.localeCompare(b.shape),
		);

	const payload = {
		mode: 'read-only-inventory',
		target,
		draftCount: rows.length,
		nonCanonicalCount: rows.filter((row) => !row.canonical).length,
		safeAutomaticRepair: rows
			.filter((row) => row.remediation === 'safe_automatic_repair')
			.map((row) => row.slug),
		manualReview: rows
			.filter((row) => row.remediation === 'manual_review')
			.map((row) => ({
				slug: row.slug,
				detail: row.remediationDetail,
				shapes: row.violationShapes,
			})),
		byShape,
		rows,
	};

	if (json) {
		console.log(JSON.stringify(payload, null, 2));
	} else {
		console.log(`Draft contract inventory — read-only (${target})`);
		console.log(
			`Drafts: ${payload.draftCount}; non-canonical: ${payload.nonCanonicalCount}; safe automatic: ${payload.safeAutomaticRepair.length}; manual review: ${payload.manualReview.length}`,
		);
		console.log('By shape/root cause:');
		if (byShape.length === 0) console.log('  none');
		for (const entry of byShape) {
			console.log(
				`  - ${entry.shape} [${entry.kind}] ×${entry.invitationsAffected} auto=${entry.autoCanonicalizable} → ${entry.action}`,
			);
		}
		if (payload.safeAutomaticRepair.length > 0) {
			console.log(`Safe automatic repair slugs: ${payload.safeAutomaticRepair.join(', ')}`);
		}
		if (payload.manualReview.length > 0) {
			console.log('Manual review:');
			for (const row of payload.manualReview) {
				console.log(
					`  - ${row.slug}: ${row.detail ?? 'see shapes'} (${row.shapes.join(', ')})`,
				);
			}
		}
	}

	if (payload.nonCanonicalCount > 0) process.exitCode = 2;
}

const target = requireTarget();
const dbUrl = resolveTargetDbUrl(target);

if (all) {
	if (value('--slug')) {
		throw new Error('FLAG_CONFLICT: use either --slug or --all, not both.');
	}
	runInventory(target, dbUrl);
} else {
	const slug = value('--slug');
	if (!slug || slug.startsWith('--')) {
		throw new Error('SLUG_REQUIRED: pass --slug <invitation-slug> or --all.');
	}
	runSingle(slug, target, dbUrl);
}
