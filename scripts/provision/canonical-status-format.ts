/**
 * CLI text for the canonical status view. Formatter only — no classifiers.
 */
import {
	formatPublicationReason,
	formatSchemaMigrationsLabel,
	formatTransitionLabel,
} from '../../src/lib/status/presentation.ts';
import {
	authorizationSemantic,
	evidenceSemantic,
	readinessSemantic,
	schemaLifecycleSemantic,
} from '../../src/lib/status/semantics.ts';
import {
	aggregateManualPatchStatus,
	buildOperationalActionPlan,
	hasPendingSchemaWork,
	isAuthoringPromotion,
	partitionPromotions,
	releasePromotions,
} from '../../src/lib/status/action-plan.ts';
import type {
	CanonicalPromotionRow,
	CanonicalStatusView,
	MigrationPresence,
	PatchApplicability,
	StatusSemantic,
	TargetEnv,
} from '../../src/lib/status/types.ts';
import { SEMANTIC_LABELS } from '../../src/lib/status/labels.ts';
import {
	displayOperatorCommand,
	operatorCommandWriteLabel,
} from '../../src/lib/status/operator-command-display.ts';
import { useCliColor } from '../db/operator-cli-ux.ts';
import {
	evaluateCriticalBackupHealth,
	type CriticalBackupHealth,
} from '../db/critical-backup-health.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function styleBySemantic(
	c: ReturnType<typeof getColors>,
	semantic: StatusSemantic,
	text: string,
): string {
	if (semantic === 'verified') return c.brightGreen(`✓ ${text}`);
	if (semantic === 'blocked') return c.red(`✗ ${text}`);
	if (semantic === 'neutral') return c.dim(text);
	return c.brightYellow(`⚠ ${text}`);
}

function envLabel(env: TargetEnv): string {
	if (env === 'local') return 'Local';
	if (env === 'preview') return 'Preview';
	return 'Production';
}

function visibleLength(str: string): number {
	// eslint-disable-next-line no-control-regex
	return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padVisible(value: string, width: number): string {
	const len = visibleLength(value);
	if (len >= width) return value;
	return value + ' '.repeat(width - len);
}

function getColors(options?: { env?: NodeJS.ProcessEnv }) {
	const enabled = useCliColor(options?.env);
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

function formatTaskPromptCommand(
	label: string,
	command: string,
	indent: string,
	color: (value: string) => string,
	suffix = '',
): string[] {
	const display = displayOperatorCommand(command);
	if (display.surface === 'terminal') {
		const lines = [`${indent}${label}:${suffix}`, `${indent}  Terminal`];
		if (display.envAssignment) lines.push(`${indent}  ${color(display.envAssignment)}`);
		lines.push(`${indent}  ${color(display.prompt)}`);
		return lines;
	}
	return [
		`${indent}${label}:${suffix}`,
		`${indent}  Task: ${display.task}`,
		`${indent}  Escribir: ${color(operatorCommandWriteLabel(display))}`,
	];
}

export function formatPromotionsSection(
	promotions: readonly CanonicalPromotionRow[],
	options?: { env?: NodeJS.ProcessEnv },
): string {
	if (promotions.length === 0) {
		return 'PUBLICATION\nAttention: 0 (in sync or none registered)\n';
	}
	const blocks = promotions.map((row, idx) =>
		isAuthoringPromotion(row)
			? formatAuthoringCard(row, idx + 1, options)
			: formatAttentionCard(row, false, idx + 1, options),
	);
	return `PUBLICATION — NEXT STEPS GUIDE\n\n${blocks.join('\n\n')}\n`;
}

function formatWhyLine(row: CanonicalPromotionRow): string {
	let reason = formatPublicationReason(row.environments, row.reasonCode, {
		preflightBlockCode: row.preflightBlockCode,
		preflightReason: row.preflightReason,
	});
	if (row.uncertaintyNotes.length > 0) {
		reason += ` (${row.uncertaintyNotes.join(', ')})`;
	}
	return reason;
}

export function formatAttentionCard(
	row: CanonicalPromotionRow,
	verbose: boolean,
	index?: number,
	options?: { env?: NodeJS.ProcessEnv },
): string {
	const c = getColors(options);
	const prefix = index != null ? `${c.dim(String(index) + '.')} ` : '';
	const transition = formatTransitionLabel(row.source, row.destination);

	const badge = row.handoff.ownerApplyRequired
		? c.bgYellowBold(`🔒 OWNER / HITL REQUIRED (${transition})`)
		: c.bgCyanBold(`➔ ${transition}`);

	const stepBadge =
		row.handoff.applyCommand &&
		row.handoff.dryRunCommand &&
		row.handoff.dryRunStepType !== row.handoff.applyStepType
			? `[${row.handoff.dryRunStepType} → ${row.handoff.applyStepType}]`
			: `[${row.handoff.applyCommand ? row.handoff.applyStepType : row.handoff.dryRunStepType}]`;

	const titleLine = `${prefix}${c.bold(row.title)}  ${badge}  ${c.dim(`[${row.action}] ${stepBadge}`)}`;
	const whyLine = `   ${c.dim('Why:')}     ${formatWhyLine(row)}`;

	const lines: string[] = [titleLine, whyLine];

	if (row.handoff.dryRunCommand) {
		const label =
			row.handoff.dryRunStepType === 'Diagnose'
				? 'Diagnose'
				: row.handoff.dryRunStepType === 'Verify'
					? 'Verify'
					: 'Action';
		lines.push(
			...formatTaskPromptCommand(label, row.handoff.dryRunCommand, '   ', c.brightCyan),
		);
	}

	if (row.handoff.applyCommand) {
		const owner = row.handoff.ownerApplyRequired ? ' (🔒 OWNER / HITL REQUIRED)' : '';
		const color = row.handoff.ownerApplyRequired ? c.brightYellow : c.brightCyan;
		lines.push(
			...formatTaskPromptCommand('Apply', row.handoff.applyCommand, '   ', color, owner),
		);
	} else if (!row.handoff.dryRunCommand) {
		lines.push(`   ${c.dim('Remedy:')} ${c.yellow('No canonical command available')}`);
	}

	if (row.handoff.optionalDiagnosticCommand) {
		lines.push(
			...formatTaskPromptCommand(
				'Optional',
				row.handoff.optionalDiagnosticCommand,
				'   ',
				c.brightCyan,
				' (diagnostic only; does not remediate UNKNOWN)',
			),
		);
	}

	if (verbose) {
		const labelWidth = 10;
		lines.push(`   ${c.dim('Evidence:'.padEnd(labelWidth))} ${row.evidence}`);
		lines.push(`   ${c.dim('Steps:'.padEnd(labelWidth))} ${row.handoff.steps.join(' → ')}`);
		lines.push(`   ${c.dim('Reason:'.padEnd(labelWidth))} ${row.reasonCode}`);
		lines.push(
			`   ${c.dim('States:'.padEnd(labelWidth))} local=${row.environments.local} preview=${row.environments.preview} production=${row.environments.production}`,
		);
	}

	return lines.join('\n');
}

function formatStatusRows(
	view: CanonicalStatusView,
	labelCol: number,
	envCol: number,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);

	const schemaRow =
		padVisible('Schema', labelCol) +
		ENVS.map((env) => {
			const row = view.environments[env];
			const label = formatSchemaMigrationsLabel(
				row.schemaLifecycle,
				row.appliedCount,
				row.expectedCount,
			).replace('Schema migrations: ', '');
			const styled = styleBySemantic(
				c,
				schemaLifecycleSemantic(row.schemaLifecycle, row.evidence),
				label,
			);
			return padVisible(styled, envCol);
		}).join('');

	const invitationRow =
		padVisible('Invitations', labelCol) +
		ENVS.map((env) => {
			const row = view.environments[env];
			const raw =
				row.evidence === 'UNVERIFIED'
					? 'UNVERIFIED'
					: `${row.invitationAttentionCount} attention`;
			const semantic =
				row.evidence === 'UNVERIFIED'
					? 'unverified'
					: row.identityConflictsCount > 0
						? 'blocked'
						: row.invitationAttentionCount === 0
							? 'verified'
							: 'unverified';
			return padVisible(styleBySemantic(c, semantic, raw), envCol);
		}).join('');

	const readinessRow =
		padVisible('Readiness', labelCol) +
		ENVS.map((env) => {
			const status = view.environments[env].schemaOperationReadiness;
			return padVisible(styleBySemantic(c, readinessSemantic(status), status), envCol);
		}).join('');

	const evidenceRow =
		padVisible('Evidence', labelCol) +
		ENVS.map((env) => {
			const ev = view.environments[env].evidence;
			return padVisible(styleBySemantic(c, evidenceSemantic(ev), ev), envCol);
		}).join('');

	const authorizationRow =
		padVisible('Authorization', labelCol) +
		ENVS.map((env) => {
			const status = view.environments[env].authorizationIntegrity;
			return padVisible(styleBySemantic(c, authorizationSemantic(status), status), envCol);
		}).join('');

	const patchRow =
		padVisible('Manual patches', labelCol) +
		ENVS.map((env) => {
			const aggregate = aggregateManualPatchStatus(view, env);
			return padVisible(styleBySemantic(c, aggregate.semantic, aggregate.label), envCol);
		}).join('');

	return [schemaRow, invitationRow, readinessRow, evidenceRow, authorizationRow, patchRow];
}

function formatCriticalBackupHealthSection(
	headerWidth: number,
	options?: { env?: NodeJS.ProcessEnv; backupHealth?: CriticalBackupHealth },
): string[] {
	const c = getColors(options);
	const health = options?.backupHealth ?? evaluateCriticalBackupHealth();
	const badge = health.attention
		? styleBySemantic(c, 'unverified', health.summary)
		: styleBySemantic(c, 'verified', health.summary);
	return [
		c.dim('─'.repeat(headerWidth)),
		`  ${c.bold('CRITICAL BACKUP')}: ${badge}`,
		c.dim(
			'  Daily = RPO 24h (pnpm db:prod:backup:daily). Mutation gates reuse a critical set ≤15m.',
		),
	];
}

function formatDisposableProofSection(
	view: CanonicalStatusView,
	headerWidth: number,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const lines: string[] = [
		c.dim('─'.repeat(headerWidth)),
		`  ${c.bold('DISPOSABLE-TEST (not a persistent schema environment)')}`,
	];

	const proofStatus = view.disposableProof.status.toUpperCase();
	const pendingSchema = hasPendingSchemaWork(view);
	const proofBadge =
		view.disposableProof.status === 'valid'
			? c.brightGreen(`✓ ${proofStatus}`)
			: pendingSchema
				? c.red(`✗ ${proofStatus}`)
				: c.brightYellow(`⚠ ${proofStatus}`);

	lines.push(`  Disposable proof: ${proofStatus}`);
	lines.push(`  Status: ${proofBadge} ${c.dim('(Required before future migration operations)')}`);
	if (view.disposableProof.status !== 'valid') {
		lines.push(c.dim('  (Does not mean Local, Preview, or Production schema is behind.)'));
		if (pendingSchema) {
			lines.push(c.dim('  Remediation is listed once in NEXT ACTIONS.'));
		}
	}
	return lines;
}

function formatMigrationPresence(
	presence: MigrationPresence,
	c: ReturnType<typeof getColors>,
): string {
	if (presence === 'APPLIED') return c.brightGreen('APPLIED');
	if (presence === 'NOT_APPLIED') return c.dim('NOT_APPLIED');
	return c.brightYellow('UNVERIFIED');
}

function formatRecentMigrationsSection(
	view: CanonicalStatusView,
	headerWidth: number,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	if (!view.recentMigrations || view.recentMigrations.length === 0) return [];
	const c = getColors(options);
	const lines: string[] = [
		c.dim('─'.repeat(headerWidth)),
		`  ${c.bold('RECENT MIGRATIONS (Authoritative DB records; probe time is not apply time)')}`,
	];
	for (const rec of view.recentMigrations) {
		const local = formatMigrationPresence(rec.presence.local, c);
		const preview = formatMigrationPresence(rec.presence.preview, c);
		const prod = formatMigrationPresence(rec.presence.production, c);
		const name = rec.name ? ` (${rec.name})` : '';
		lines.push(`  - ${rec.version}${name}: local=${local} preview=${preview} prod=${prod}`);
	}
	return lines;
}

function formatPatchStatus(status: PatchApplicability, c: ReturnType<typeof getColors>): string {
	if (status === 'PENDING') return c.brightYellow(status);
	if (status === 'BLOCKED') return c.red(status);
	if (status === 'UNVERIFIED') return c.brightYellow(status);
	if (status === 'NOT_NEEDED') return c.brightGreen(status);
	return c.dim(status);
}

function formatManualPatchesSection(
	view: CanonicalStatusView,
	headerWidth: number,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const lines = [
		c.dim('─'.repeat(headerWidth)),
		`  ${c.bold('ACTIVE MANUAL PATCHES (0 rows = NOT_NEEDED, not applied)')}`,
	];
	for (const patch of view.manualPatches) {
		const envs = ENVS.map(
			(env) => `${envLabel(env)}=${formatPatchStatus(patch.environments[env].status, c)}`,
		).join(' ');
		const production = patch.environments.production;
		lines.push(`  - ${patch.scriptId}: ${envs}`);
		lines.push(`    File: ${patch.file}`);
		lines.push(`    Reason: ${production.reason}`);
		if (production.matchingRowCount !== null)
			lines.push(
				`    Count: ${production.matchingRowCount} (approved ${patch.expectedRowsMin}-${patch.expectedRowsMax})`,
			);
		if (production.verifiedAt) lines.push(`    Verified: ${production.verifiedAt}`);
		if (production.projectRef) lines.push(`    Project: ${production.projectRef}`);
		if (production.affectedRows && production.affectedRows.length > 0) {
			const rows = production.affectedRows
				.map(
					(row) =>
						`${row.store}/${row.slug ?? row.key}${row.version === null ? '' : `@v${row.version}`}`,
				)
				.join(', ');
			lines.push(`    Rows: ${rows}`);
		}
		if (production.status === 'PENDING' || production.status === 'BLOCKED') {
			lines.push(c.dim('    Apply command lives once in NEXT ACTIONS.'));
		}
	}
	return lines;
}

function formatPublicationSummaryCard(
	row: CanonicalPromotionRow,
	index: number,
	options?: { env?: NodeJS.ProcessEnv },
): string {
	const c = getColors(options);
	const transition = formatTransitionLabel(row.source, row.destination);
	const lines = [
		`${c.dim(String(index) + '.')} ${c.bold(row.title)}  ${c.dim(`[${row.action}] ${transition}`)}`,
		`   ${c.dim('Why:')}     ${formatWhyLine(row)}`,
	];
	lines.push(`   ${c.dim('Command lives once in NEXT ACTIONS.')}`);
	return lines.join('\n');
}

function formatAuthoringCard(
	row: CanonicalPromotionRow,
	index: number,
	options?: { env?: NodeJS.ProcessEnv },
): string {
	const c = getColors(options);
	return [
		`${c.dim(String(index) + '.')} ${c.bold(row.title)}  ${c.dim('[in_progress] Authoring')}`,
		`   ${c.dim('Why:')}     ${formatWhyLine(row)}`,
		`   ${c.dim('Not a release obligation. Do not invitation:release or prod:apply until lifecycle is published.')}`,
	].join('\n');
}

function formatPublicationOverview(
	view: CanonicalStatusView,
	headerWidth: number,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const lines: string[] = [];
	const { release: queue, authoring } = partitionPromotions(view.promotions);

	if (queue.length === 0 && authoring.length === 0) {
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push(`  ${c.bold('PUBLICATION')}`);
		const remoteUnverified =
			view.environments.local.evidence === 'UNVERIFIED' &&
			view.environments.preview.evidence === 'UNVERIFIED' &&
			view.environments.production.evidence === 'UNVERIFIED';
		if (remoteUnverified) {
			lines.push(c.brightYellow('  Attention: UNVERIFIED (empty queue is not in-sync)'));
			lines.push(...formatTaskPromptCommand('Next', 'pnpm dbs', '  ', c.brightCyan));
			lines.push(c.dim('  Verify when live evidence classifies the registry.'));
		} else {
			lines.push('  Attention: 0 (in sync or none registered)');
		}
		return lines;
	}

	if (queue.length > 0) {
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push(
			`  ${c.headerTitle('PUBLICATION')} ${c.dim(`(${queue.length} release · commands in NEXT ACTIONS)`)}`,
		);
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push('');
		lines.push(
			queue
				.map((row, idx) => formatPublicationSummaryCard(row, idx + 1, options))
				.join('\n\n'),
		);
	}

	if (authoring.length > 0) {
		if (lines.length > 0) lines.push('');
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push(
			`  ${c.headerTitle('AUTHORING')} ${c.dim(`(${authoring.length} in_progress · not release debt)`)}`,
		);
		lines.push(c.dim('─'.repeat(headerWidth)));
		lines.push('');
		lines.push(
			authoring.map((row, idx) => formatAuthoringCard(row, idx + 1, options)).join('\n\n'),
		);
	}
	return lines;
}

function formatProductionAuthWarning(
	productionAuth: CanonicalStatusView['environments']['production'],
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	if (productionAuth.authorizationIntegrity !== 'MISSING') return [];
	const c = getColors(options);
	return [
		'',
		c.brightYellow('PRODUCTION AUTHORIZATION: MISSING (informational)'),
		`Missing versions: ${productionAuth.authorizationMissingVersions.join(', ') || '(unknown)'}`,
		'Schema CURRENT is not owner-authorization evidence.',
		'The owner-apply ledger is local to this worktree. No canonical command backfills historical records.',
	];
}

function formatVerboseSchemaDetails(
	view: CanonicalStatusView,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const lines: string[] = [];
	for (const env of ENVS) {
		const row = view.environments[env];
		lines.push('');
		lines.push(`  ${c.bold(`[${envLabel(env)} schema detail]`)}`);
		lines.push(`    head: ${row.migrationHead ?? '(none)'}`);
		lines.push(`    pending: ${row.pendingMigrations.join(', ') || '(none)'}`);
		lines.push(`    extra: ${row.extraMigrations.join(', ') || '(none)'}`);
		lines.push(`    probedAt: ${row.probedAt ?? '(none)'}`);
	}
	return lines;
}

function formatRegistrySummarySection(
	view: CanonicalStatusView,
	headerWidth: number,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const attention = releasePromotions(view.promotions).length;
	const lines: string[] = [
		'',
		c.dim('─'.repeat(headerWidth)),
		`  Registry invitations: ${c.bold(String(view.registryCount))}    In sync: ${c.green(String(view.inSyncCount))}    Attention: ${attention > 0 ? c.brightYellow(String(attention)) : c.green('0')}`,
		`  Active DB rows (not registry): Local ${c.bold(String(view.activeRowCounts.local))} · Preview ${c.bold(String(view.activeRowCounts.preview))} · Production ${c.bold(String(view.activeRowCounts.production))}`,
	];

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
	return lines;
}

function formatInSyncSection(
	view: CanonicalStatusView,
	includeInSync?: boolean,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const lines: string[] = [];
	if (includeInSync) {
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
	return lines;
}

function formatDiagnosticsSection(
	view: CanonicalStatusView,
	verbose: boolean,
	diagnosticsOption?: boolean,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const lines: string[] = [];
	if ((verbose || diagnosticsOption) && view.diagnostics.length > 0) {
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
	return lines;
}

function formatOperationalActionPlan(
	view: CanonicalStatusView,
	headerWidth: number,
	options?: { env?: NodeJS.ProcessEnv },
): string[] {
	const c = getColors(options);
	const plan = buildOperationalActionPlan(view);
	const healthText = `${plan.health.label} (${plan.health.unresolvedChecks} acción(es))`;
	const lines = [
		c.dim('─'.repeat(headerWidth)),
		`  ${c.bold('OPERATIONAL HEALTH')}: ${styleBySemantic(c, plan.health.status === 'GREEN' ? 'verified' : plan.health.status === 'ACTION_REQUIRED' ? 'blocked' : 'unverified', healthText)}`,
		`  ${c.dim(plan.health.summary)}`,
		c.dim('─'.repeat(headerWidth)),
		`  ${c.bold('NEXT ACTIONS')}`,
	];
	if (plan.actions.length === 0) {
		lines.push(c.brightGreen('  ✓ No hay acciones pendientes.'));
		return lines;
	}
	for (const [index, action] of plan.actions.entries()) {
		lines.push(
			`  ${index + 1}. ${c.bold(action.title)} ${styleBySemantic(c, action.semantic, SEMANTIC_LABELS[action.semantic] ?? action.semantic)}`,
		);
		lines.push(`     ${action.summary}`);
		for (const step of action.steps) {
			const owner = step.requiresOwner ? ' 🔒 OWNER / HITL' : '';
			if (!step.command) {
				lines.push(
					`     ${step.label}: ${c.yellow('Revisión manual; sin comando canónico')}${owner}`,
				);
			} else {
				lines.push(
					...formatTaskPromptCommand(
						step.label,
						step.command,
						'     ',
						c.brightCyan,
						owner,
					),
				);
			}
			if (step.prerequisite) lines.push(`       Prerequisito: ${step.prerequisite}`);
		}
		lines.push(`     Verificar cuando: ${action.verifyWhen}`);
	}
	return lines;
}

export function formatCanonicalStatusView(
	view: CanonicalStatusView,
	options?: {
		verbose?: boolean;
		includeInSync?: boolean;
		diagnostics?: boolean;
		env?: NodeJS.ProcessEnv;
		backupHealth?: CriticalBackupHealth;
	},
): string {
	const verbose = Boolean(options?.verbose);
	const c = getColors(options);
	const labelCol = 18;
	const envCol = 28;
	const headerWidth = labelCol + envCol * 3;

	const lines: string[] = [
		'',
		c.dim('─'.repeat(headerWidth)),
		`  ${c.headerTitle('CELEBRA-ME OPERATIONAL STATUS')}`,
		c.dim('─'.repeat(headerWidth)),
		view.freshnessMeta
			? `  Evidence freshness: ${view.freshnessMeta.status} (verified ${view.freshnessMeta.lastVerifiedAt})`
			: `  Evidence: ${view.evidence}`,
		...formatOperationalActionPlan(view, headerWidth, options),
		'',
		`${padVisible('', labelCol)}${c.brightCyan(padVisible('LOCAL', envCol))}${c.brightCyan(padVisible('PREVIEW', envCol))}${c.brightCyan(padVisible('PRODUCTION', envCol))}`,
		c.dim('─'.repeat(headerWidth)),
		...formatStatusRows(view, labelCol, envCol, options),
		'',
		c.dim(
			'(Schema = migration history. Authorization = owner-apply evidence. Invitations = registry publication. Readiness = migrate authorization.)',
		),
		...formatProductionAuthWarning(view.environments.production, options),
		'',
		...formatDisposableProofSection(view, headerWidth, options),
		...formatCriticalBackupHealthSection(headerWidth, options),
		...formatRecentMigrationsSection(view, headerWidth, options),
		...formatManualPatchesSection(view, headerWidth, options),
	];

	if (verbose) {
		lines.push(...formatVerboseSchemaDetails(view, options));
	}

	lines.push(...formatRegistrySummarySection(view, headerWidth, options));
	lines.push('');
	lines.push(...formatPublicationOverview(view, headerWidth, options));
	lines.push(...formatInSyncSection(view, options?.includeInSync, options));
	lines.push(...formatDiagnosticsSection(view, verbose, options?.diagnostics, options));
	lines.push('');

	return lines.join('\n');
}

export function formatSlugStatusView(
	view: CanonicalStatusView,
	slug: string,
	options?: { verbose?: boolean; env?: NodeJS.ProcessEnv },
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
	lines.push(
		isAuthoringPromotion(row)
			? formatAuthoringCard(row, 1, options)
			: formatAttentionCard(row, Boolean(options?.verbose), undefined, options),
	);
	lines.push('');
	return lines.join('\n');
}
