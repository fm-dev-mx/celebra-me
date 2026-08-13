/**
 * CLI text for the canonical status view. Formatter only — no classifiers.
 */
import {
	formatPublicationReason,
	formatSchemaMigrationsLabel,
	formatTransitionLabel,
} from '../../src/lib/status/presentation.ts';
import type {
	CanonicalPromotionRow,
	CanonicalStatusView,
	TargetEnv,
} from '../../src/lib/status/types.ts';
import { useCliColor } from '../db/operator-cli-ux.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function envLabel(env: TargetEnv): string {
	if (env === 'local') return 'Local';
	if (env === 'preview') return 'Preview';
	return 'Production';
}

function visibleLength(str: string): number {
	return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padVisible(value: string, width: number): string {
	const len = visibleLength(value);
	if (len >= width) return value;
	return value + ' '.repeat(width - len);
}

function getColors() {
	const enabled = useCliColor();
	return {
		bold: (s: string) => (enabled ? `\x1b[1m${s}\x1b[0m` : s),
		dim: (s: string) => (enabled ? `\x1b[2m${s}\x1b[0m` : s),
		green: (s: string) => (enabled ? `\x1b[32m${s}\x1b[0m` : s),
		brightGreen: (s: string) => (enabled ? `\x1b[1m\x1b[32m${s}\x1b[0m` : s),
		yellow: (s: string) => (enabled ? `\x1b[33m${s}\x1b[0m` : s),
		brightYellow: (s: string) => (enabled ? `\x1b[1m\x1b[33m${s}\x1b[0m` : s),
		red: (s: string) => (enabled ? `\x1b[31m${s}\x1b[0m` : s),
		brightCyan: (s: string) => (enabled ? `\x1b[1m\x1b[36m${s}\x1b[0m` : s),
		bgYellowBold: (s: string) => (enabled ? `\x1b[43m\x1b[1m\x1b[30m ${s} \x1b[0m` : s),
		bgCyanBold: (s: string) => (enabled ? `\x1b[46m\x1b[1m\x1b[30m ${s} \x1b[0m` : s),
		headerTitle: (s: string) => (enabled ? `\x1b[1m\x1b[37m${s}\x1b[0m` : s),
	};
}

export function formatPromotionsSection(promotions: readonly CanonicalPromotionRow[]): string {
	if (promotions.length === 0) {
		return 'PUBLICATION\nAttention: 0 (in sync or none registered)\n';
	}
	const blocks = promotions.map((row, idx) => formatAttentionCard(row, false, idx + 1));
	return `PUBLICATION — NEXT STEPS GUIDE\n\n${blocks.join('\n\n')}\n`;
}

function formatWhyLine(row: CanonicalPromotionRow): string {
	let reason = formatPublicationReason(row.environments, row.reasonCode);
	if (row.uncertaintyNotes.length > 0) {
		reason += ` (${row.uncertaintyNotes.join(', ')})`;
	}
	return reason;
}

export function formatAttentionCard(
	row: CanonicalPromotionRow,
	verbose: boolean,
	index?: number,
): string {
	const c = getColors();
	const prefix = index != null ? `${c.dim(String(index) + '.')} ` : '';
	const transition = formatTransitionLabel(row.source, row.destination);

	const badge = row.handoff.ownerApplyRequired
		? c.bgYellowBold(`🔒 OWNER / HITL REQUIRED (${transition})`)
		: c.bgCyanBold(`➔ ${transition}`);

	const titleLine = `${prefix}${c.bold(row.title)}  ${badge}  ${c.dim(`[${row.action}]`)}`;
	const whyLine = `   ${c.dim('Why:')}     ${formatWhyLine(row)}`;

	const lines: string[] = [titleLine, whyLine];

	const labelWidth = 9;

	if (row.handoff.dryRunCommand) {
		const rawLabel = row.handoff.ownerApplyRequired ? 'Dry-run:' : 'Action:';
		lines.push(
			`   ${c.dim(rawLabel.padEnd(labelWidth))} ${c.brightCyan(row.handoff.dryRunCommand)}`,
		);
	}

	if (row.handoff.ownerApplyRequired && row.handoff.applyCommand) {
		lines.push(
			`   ${c.yellow(c.dim('Apply:'.padEnd(labelWidth)))} ${c.brightYellow(row.handoff.applyCommand)}`,
		);
	} else if (row.handoff.applyCommand && verbose) {
		lines.push(
			`   ${c.dim('Apply:'.padEnd(labelWidth))} ${c.brightCyan(row.handoff.applyCommand)}`,
		);
	}

	if (verbose) {
		lines.push(`   ${c.dim('Evidence:'.padEnd(labelWidth))} ${row.evidence}`);
		lines.push(`   ${c.dim('Steps:'.padEnd(labelWidth))} ${row.handoff.steps.join(' → ')}`);
		lines.push(`   ${c.dim('Reason:'.padEnd(labelWidth))} ${row.reasonCode}`);
		lines.push(
			`   ${c.dim('States:'.padEnd(labelWidth))} local=${row.environments.local} preview=${row.environments.preview} production=${row.environments.production}`,
		);
	}

	return lines.join('\n');
}

export function formatCanonicalStatusView(
	view: CanonicalStatusView,
	options?: { verbose?: boolean; includeInSync?: boolean; diagnostics?: boolean },
): string {
	const verbose = Boolean(options?.verbose);
	const c = getColors();
	const labelCol = 18;
	const envCol = 28;
	const headerWidth = labelCol + envCol * 3;

	const lines: string[] = [
		'',
		c.dim('─'.repeat(headerWidth)),
		`  ${c.headerTitle('CELEBRA-ME OPERATIONAL STATUS')}`,
		c.dim('─'.repeat(headerWidth)),
		'',
		`${padVisible('', labelCol)}${c.brightCyan(padVisible('LOCAL', envCol))}${c.brightCyan(padVisible('PREVIEW', envCol))}${c.brightCyan(padVisible('PRODUCTION', envCol))}`,
		c.dim('─'.repeat(headerWidth)),
	];

	const schemaRow =
		padVisible('Schema', labelCol) +
		ENVS.map((env) => {
			const label = formatSchemaMigrationsLabel(
				view.environments[env].schemaLifecycle,
				view.environments[env].appliedCount,
				view.environments[env].expectedCount,
			).replace('Schema migrations: ', '');
			const isCurrent = label.startsWith('CURRENT');
			const styled = isCurrent ? c.brightGreen(`✓ ${label}`) : c.brightYellow(`⚠ ${label}`);
			return padVisible(styled, envCol);
		}).join('');
	lines.push(schemaRow);

	const invitationRow =
		padVisible('Invitations', labelCol) +
		ENVS.map((env) => {
			const count = view.environments[env].invitationAttentionCount;
			const raw = `${count} attention`;
			const styled = count === 0 ? c.green(`✓ ${raw}`) : c.brightYellow(`! ${raw}`);
			return padVisible(styled, envCol);
		}).join('');
	lines.push(invitationRow);

	const readinessRow =
		padVisible('Readiness', labelCol) +
		ENVS.map((env) => {
			const status = view.environments[env].schemaOperationReadiness;
			const isReady = status === 'READY';
			const styled = isReady ? c.brightGreen(`✓ ${status}`) : c.brightYellow(`⚠ ${status}`);
			return padVisible(styled, envCol);
		}).join('');
	lines.push(readinessRow);

	const evidenceRow =
		padVisible('Evidence', labelCol) +
		ENVS.map((env) => {
			const ev = view.environments[env].evidence;
			const styled = ev === 'LIVE' ? c.green(`✓ ${ev}`) : c.dim(ev);
			return padVisible(styled, envCol);
		}).join('');
	lines.push(evidenceRow);

	const authorizationRow =
		padVisible('Authorization', labelCol) +
		ENVS.map((env) => {
			const status = view.environments[env].authorizationIntegrity;
			const styled =
				status === 'RECORDED'
					? c.brightGreen(`✓ ${status}`)
					: status === 'MISSING'
						? c.brightYellow(`⚠ ${status}`)
						: status === 'GRANDFATHERED'
							? c.yellow(status)
							: c.dim(status);
			return padVisible(styled, envCol);
		}).join('');
	lines.push(authorizationRow);

	lines.push('');
	lines.push(
		c.dim(
			'(Schema = migration history. Authorization = owner-apply evidence. Invitations = registry publication. Readiness = migrate authorization.)',
		),
	);

	const productionAuth = view.environments.production;
	if (productionAuth.authorizationIntegrity === 'MISSING') {
		lines.push('');
		lines.push(c.brightYellow('PRODUCTION AUTHORIZATION: MISSING'));
		lines.push(
			`Missing versions: ${productionAuth.authorizationMissingVersions.join(', ') || '(unknown)'}`,
		);
		lines.push('Schema CURRENT is not owner-authorization evidence.');
	}
	lines.push('');
	lines.push(c.dim('─'.repeat(headerWidth)));
	lines.push(`  ${c.bold('DISPOSABLE-TEST (not a persistent schema environment)')}`);
	const proofStatus = view.disposableProof.status.toUpperCase();
	const proofBadge =
		view.disposableProof.status === 'valid'
			? c.brightGreen(`✓ ${proofStatus}`)
			: c.brightYellow(`MISSING`);

	lines.push(`  Disposable proof: ${proofStatus}`);
	lines.push(`  Status: ${proofBadge} ${c.dim('(Required before future migration operations)')}`);
	if (view.disposableProof.status !== 'valid') {
		lines.push(c.dim('  (Does not mean Local, Preview, or Production schema is behind.)'));
		lines.push(
			`  Remediation: ${c.brightCyan('pnpm db:migrate -- --target disposable-test --apply')}`,
		);
	}

	if (verbose) {
		for (const env of ENVS) {
			const row = view.environments[env];
			lines.push('');
			lines.push(`  ${c.bold(`[${envLabel(env)} schema detail]`)}`);
			lines.push(`    head: ${row.migrationHead ?? '(none)'}`);
			lines.push(`    pending: ${row.pendingMigrations.join(', ') || '(none)'}`);
			lines.push(`    extra: ${row.extraMigrations.join(', ') || '(none)'}`);
			lines.push(`    probedAt: ${row.probedAt ?? '(none)'}`);
		}
	}

	lines.push('');
	lines.push(c.dim('─'.repeat(headerWidth)));
	const registrySummary = `  Registry invitations: ${c.bold(String(view.registryCount))}    In sync: ${c.green(String(view.inSyncCount))}    Attention: ${view.promotions.length > 0 ? c.brightYellow(String(view.promotions.length)) : c.green('0')}`;
	lines.push(registrySummary);
	lines.push(
		`  Active DB rows (not registry): Local ${c.bold(String(view.activeRowCounts.local))} · Preview ${c.bold(String(view.activeRowCounts.preview))} · Production ${c.bold(String(view.activeRowCounts.production))}`,
	);
	if (
		view.identityConflictCounts.local > 0 ||
		view.identityConflictCounts.preview > 0 ||
		view.identityConflictCounts.production > 0
	) {
		lines.push(
			c.red(
				`  Identity conflicts: Local ${view.identityConflictCounts.local} · Preview ${view.identityConflictCounts.preview} · Production ${view.identityConflictCounts.production}`,
			),
		);
	}

	lines.push('');
	if (view.promotions.length === 0) {
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push(`  ${c.bold('PUBLICATION')}`);
		lines.push('  Attention: 0 (in sync or none registered)');
	} else {
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push(
			`  ${c.headerTitle('PUBLICATION — NEXT STEPS GUIDE')} ${c.dim(`(${view.promotions.length} pending)`)}`,
		);
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push('');
		lines.push(
			view.promotions
				.map((row, idx) => formatAttentionCard(row, verbose, idx + 1))
				.join('\n\n'),
		);
	}

	if (options?.includeInSync) {
		lines.push('');
		lines.push(`  ${c.bold(`IN SYNC (${view.inSyncCount})`)}`);
		if (view.inSyncSlugs.length === 0) {
			lines.push(c.dim('  (none)'));
		} else {
			for (const slug of view.inSyncSlugs) lines.push(`    ${slug}`);
		}
	} else if (view.inSyncCount > 0) {
		lines.push('');
		lines.push(c.dim(`  In sync omitted: ${view.inSyncCount} (pass --in-sync to list)`));
	}

	if ((verbose || options?.diagnostics) && view.diagnostics.length > 0) {
		lines.push('');
		lines.push(
			`  ${c.bold('DIAGNOSTICS (enrichment only; does not change publication or readiness)')}`,
		);
		for (const item of view.diagnostics) {
			const scope = [item.environment, item.slug].filter(Boolean).join(' ');
			lines.push(`    ${c.yellow(item.code)}${scope ? ` ${scope}` : ''}`);
			if (item.semanticPaths.length > 0) {
				lines.push(c.dim(`      paths: ${item.semanticPaths.join(', ')}`));
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
