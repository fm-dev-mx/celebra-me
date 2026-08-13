/**
 * CLI text for the canonical status view. Formatter only — no classifiers.
 */
import {
	formatPublicationReason,
	formatSchemaMigrationsLabel,
	formatTransitionLabel,
} from '../../src/lib/status/presentation.ts';
import type { CanonicalPromotionRow, CanonicalStatusView, TargetEnv } from '../../src/lib/status/types.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function envLabel(env: TargetEnv): string {
	if (env === 'local') return 'Local';
	if (env === 'preview') return 'Preview';
	return 'Production';
}

function pad(value: string, width: number): string {
	return value.padEnd(width, ' ');
}

export function formatPromotionsSection(promotions: readonly CanonicalPromotionRow[]): string {
	if (promotions.length === 0) {
		return 'PUBLICATION\nAttention: 0 (in sync or none registered)\n';
	}
	const blocks = promotions.map((row) => formatAttentionCard(row, false));
	return `PUBLICATION\n\n${blocks.join('\n\n')}\n`;
}

export function formatAttentionCard(row: CanonicalPromotionRow, verbose: boolean): string {
	const lines = [
		row.title,
		formatTransitionLabel(row.source, row.destination),
		row.action,
		'',
		formatPublicationReason(row.environments, row.reasonCode),
	];
	if (row.uncertaintyNotes.length > 0) {
		lines.push(row.uncertaintyNotes.join(', '));
	}
	lines.push('', `Evidence: ${row.evidence}`);
	if (row.handoff.ownerApplyRequired) {
		lines.push('OWNER / HITL REQUIRED');
	}
	lines.push(`Next: ${row.handoff.steps.join(' → ')}`);
	if (row.handoff.dryRunCommand) {
		lines.push(`Dry-run: ${row.handoff.dryRunCommand}`);
	}
	if (row.handoff.ownerApplyRequired && row.handoff.applyCommand) {
		lines.push(`OWNER APPLY: ${row.handoff.applyCommand}`);
	} else if (row.handoff.applyCommand && verbose) {
		lines.push(`Apply (authorized workflow): ${row.handoff.applyCommand}`);
	}
	if (verbose) {
		lines.push(`reasonCode: ${row.reasonCode}`);
		lines.push(
			`states: local=${row.environments.local} preview=${row.environments.preview} production=${row.environments.production}`,
		);
	}
	return lines.join('\n');
}

export function formatCanonicalStatusView(
	view: CanonicalStatusView,
	options?: { verbose?: boolean; includeInSync?: boolean; diagnostics?: boolean },
): string {
	const verbose = Boolean(options?.verbose);
	const col = 14;
	const lines: string[] = [
		'',
		'============================================================',
		' Celebra-me operational status',
		'============================================================',
		'',
		`${pad('', 18)}${pad('LOCAL', col)}${pad('PREVIEW', col)}${pad('PRODUCTION', col)}`,
		'-'.repeat(18 + col * 3),
	];

	const schemaRow =
		pad('Schema', 18) +
		ENVS.map((env) =>
			pad(
				formatSchemaMigrationsLabel(
					view.environments[env].schemaLifecycle,
					view.environments[env].appliedCount,
					view.environments[env].expectedCount,
				).replace('Schema migrations: ', ''),
				col,
			),
		).join('');
	lines.push(schemaRow);

	const invitationRow =
		pad('Invitations', 18) +
		ENVS.map((env) =>
			pad(`${view.environments[env].invitationAttentionCount} attention`, col),
		).join('');
	lines.push(invitationRow);

	const readinessRow =
		pad('Readiness', 18) +
		ENVS.map((env) => pad(view.environments[env].schemaOperationReadiness, col)).join('');
	lines.push(readinessRow);

	const evidenceRow =
		pad('Evidence', 18) +
		ENVS.map((env) => pad(view.environments[env].evidence, col)).join('');
	lines.push(evidenceRow);

	const authorizationRow =
		pad('Authorization', 18) +
		ENVS.map((env) => pad(view.environments[env].authorizationIntegrity, col)).join('');
	lines.push(authorizationRow);

	lines.push('');
	lines.push(
		'(Schema = migration history. Authorization = owner-apply evidence. Invitations = registry publication. Readiness = migrate authorization.)',
	);

	const productionAuth = view.environments.production;
	if (productionAuth.authorizationIntegrity === 'MISSING') {
		lines.push('');
		lines.push('PRODUCTION AUTHORIZATION: MISSING');
		lines.push(
			`Missing versions: ${productionAuth.authorizationMissingVersions.join(', ') || '(unknown)'}`,
		);
		lines.push('Schema CURRENT is not owner-authorization evidence.');
	}
	lines.push('');
	lines.push('DISPOSABLE-TEST (not a persistent schema environment)');
	lines.push(`Disposable proof: ${view.disposableProof.status.toUpperCase()}`);
	lines.push('Required before future migration operations');
	if (view.disposableProof.status !== 'valid') {
		lines.push('(Does not mean Local, Preview, or Production schema is behind.)');
	}

	if (verbose) {
		for (const env of ENVS) {
			const row = view.environments[env];
			lines.push('');
			lines.push(`[${envLabel(env)} schema detail]`);
			lines.push(`  head: ${row.migrationHead ?? '(none)'}`);
			lines.push(`  pending: ${row.pendingMigrations.join(', ') || '(none)'}`);
			lines.push(`  extra: ${row.extraMigrations.join(', ') || '(none)'}`);
			lines.push(`  probedAt: ${row.probedAt ?? '(none)'}`);
		}
	}

	lines.push('');
	lines.push(
		`Registry invitations: ${view.registryCount}    In sync: ${view.inSyncCount}    Attention: ${view.promotions.length}`,
	);
	lines.push(
		`Active DB rows (not registry): Local ${view.activeRowCounts.local} · Preview ${view.activeRowCounts.preview} · Production ${view.activeRowCounts.production}`,
	);
	if (
		view.identityConflictCounts.local > 0 ||
		view.identityConflictCounts.preview > 0 ||
		view.identityConflictCounts.production > 0
	) {
		lines.push(
			`Identity conflicts: Local ${view.identityConflictCounts.local} · Preview ${view.identityConflictCounts.preview} · Production ${view.identityConflictCounts.production}`,
		);
	}

	lines.push('');
	if (view.promotions.length === 0) {
		lines.push('PUBLICATION');
		lines.push('Attention: 0 (in sync or none registered)');
	} else {
		lines.push('PUBLICATION — attention queue');
		lines.push('');
		lines.push(view.promotions.map((row) => formatAttentionCard(row, verbose)).join('\n\n'));
	}

	if (options?.includeInSync) {
		lines.push('');
		lines.push(`IN SYNC (${view.inSyncCount})`);
		if (view.inSyncSlugs.length === 0) {
			lines.push('(none)');
		} else {
			for (const slug of view.inSyncSlugs) lines.push(`  ${slug}`);
		}
	} else if (view.inSyncCount > 0) {
		lines.push('');
		lines.push(`In sync omitted: ${view.inSyncCount} (pass --in-sync to list)`);
	}

	if ((verbose || options?.diagnostics) && view.diagnostics.length > 0) {
		lines.push('');
		lines.push('DIAGNOSTICS (enrichment only; does not change publication or readiness)');
		for (const item of view.diagnostics) {
			const scope = [item.environment, item.slug].filter(Boolean).join(' ');
			lines.push(`  ${item.code}${scope ? ` ${scope}` : ''}`);
			if (item.semanticPaths.length > 0) {
				lines.push(`    paths: ${item.semanticPaths.join(', ')}`);
			}
		}
	}

	lines.push('');
	return lines.join('\n');
}

export function formatSlugStatusView(
	view: CanonicalStatusView,
	slug: string,
	options?: { verbose?: boolean },
): string {
	const row = view.promotions.find((item) => item.slug === slug);
	const inSync = view.inSyncSlugs.includes(slug);
	const lines = [
		'',
		'============================================================',
		` Publication status: ${row?.title ?? slug}`,
		'============================================================',
		'',
	];
	if (inSync) {
		lines.push('Publication: NONE (IN_SYNC)');
		lines.push('Local, Preview, and Production match canonical.');
		lines.push('');
		return lines.join('\n');
	}
	if (!row) {
		lines.push('Publication: UNKNOWN (not in registry attention set)');
		lines.push('');
		return lines.join('\n');
	}
	lines.push(formatAttentionCard(row, Boolean(options?.verbose)));
	lines.push('');
	return lines.join('\n');
}
