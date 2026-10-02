/**
 * Read-only Published content migration audit.
 *
 * Inventories legacy venue date/time prose and showFlourishes ownership conflicts.
 * With --usage it reports the shapes every active invitation row still carries (identity
 * columns, variants, asset namespaces, superseded fields) for published and draft documents.
 * Never mutates data.
 *
 * Usage:
 *   pnpm invitation:published-audit --slug <slug> [--target local|preview|production] [--json]
 *   pnpm invitation:published-audit --usage [--slug <slug>] [--target local|preview|production] [--json]
 */
import { auditPublishedContent } from '../../src/lib/intake/services/published-content-audit.service.ts';
import { summarizeContentUsage } from './content-usage-audit.ts';
import {
	listPersistedInvitationRows,
	readPersistedInvitationContent,
	resolveTargetDbUrl,
	type PersistedContentTarget,
} from './persisted-invitation-content.ts';

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

function requireTarget(): PersistedContentTarget {
	const target = value('--target') ?? 'local';
	if (target !== 'local' && target !== 'preview' && target !== 'production') {
		throw new Error('TARGET_INVALID: --target must be local, preview or production.');
	}
	return target;
}

function runMigrationAudit(target: PersistedContentTarget, dbUrl: string): void {
	const slug = requireSlug();
	const state = readPersistedInvitationContent(slug, dbUrl);
	if (!state?.published.content) {
		console.error(`PUBLISHED_NOT_FOUND: no published content for ${slug} in ${target}.`);
		process.exitCode = 1;
		return;
	}
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

function runUsageReport(target: PersistedContentTarget, dbUrl: string): void {
	const onlySlug = value('--slug');
	const rows = listPersistedInvitationRows(dbUrl)
		.filter((row) => !onlySlug || row.slug === onlySlug)
		.map((row) => {
			const state = readPersistedInvitationContent(row.slug, dbUrl);
			const published = state?.published.content;
			const draft = state?.draft.content;
			// Drafts follow the editor contract, so the published schema verdict does not apply.
			const draftUsage = draft ? summarizeContentUsage(draft) : null;
			return {
				...row,
				publishedVersion: state?.published.version ?? null,
				published: published
					? {
							...summarizeContentUsage(published),
							legacyDateTimeCount:
								auditPublishedContent(published).legacyDateTimeCount,
						}
					: null,
				draft: draftUsage
					? {
							variants: draftUsage.variants,
							assets: draftUsage.assets,
							supersededShapes: draftUsage.supersededShapes,
						}
					: null,
			};
		});
	const payload = { mode: 'read-only-usage' as const, target, rowCount: rows.length, rows };
	if (json) {
		console.log(JSON.stringify(payload, null, 2));
		return;
	}
	console.log(`Persisted content usage — read-only (${target}): ${rows.length} active rows.`);
	for (const row of rows) {
		const shapes = Object.keys(row.published?.supersededShapes ?? {});
		const verdict = row.published ? (row.published.strictParse.ok ? 'ok' : 'FAILS') : 'none';
		console.log(
			`  - ${row.slug} [${row.kind}] base=${row.baseDemoId} theme=${row.themeId} strict=${verdict} superseded=${shapes.length ? shapes.join(',') : 'none'}`,
		);
	}
}

const target = requireTarget();
const dbUrl = resolveTargetDbUrl(target);
if (args.includes('--usage')) runUsageReport(target, dbUrl);
else runMigrationAudit(target, dbUrl);
