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

function formatStatusRows(view: CanonicalStatusView, labelCol: number, envCol: number): string[] {
	const c = getColors();

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

function formatDisposableProofSection(view: CanonicalStatusView, headerWidth: number): string[] {
	const c = getColors();
	const lines: string[] = [
		c.dim('─'.repeat(headerWidth)),
		`  ${c.bold('DISPOSABLE-TEST (not a persistent schema environment)')}`,
	];

	const proofStatus = view.disposableProof.status.toUpperCase();
	const proofBadge =
		view.disposableProof.status === 'valid'
			? c.brightGreen(`✓ ${proofStatus}`)
			: c.red(`✗ ${proofStatus}`);

	lines.push(`  Disposable proof: ${proofStatus}`);
	lines.push(`  Status: ${proofBadge} ${c.dim('(Required before future migration operations)')}`);
	if (view.disposableProof.status !== 'valid') {
		lines.push(c.dim('  (Does not mean Local, Preview, or Production schema is behind.)'));
		lines.push(
			...formatTaskPromptCommand(
				'Remediation',
				'pnpm db:migrate -- --target disposable-test --apply',
				'  ',
				c.brightCyan,
			),
		);
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

function formatRecentMigrationsSection(view: CanonicalStatusView, headerWidth: number): string[] {
	if (!view.recentMigrations || view.recentMigrations.length === 0) return [];
	const c = getColors();
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

function formatManualPatchesSection(view: CanonicalStatusView, headerWidth: number): string[] {
	const c = getColors();
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
		if (production.planCommand) {
			lines.push(
				...formatTaskPromptCommand(
					'Plan',
					production.planCommand.replace('<file>', patch.file),
					'    ',
					c.brightCyan,
				),
			);
		}
	}
	return lines;
}

function formatPublicationOverview(
	view: CanonicalStatusView,
	headerWidth: number,
	verbose: boolean,
): string[] {
	const c = getColors();
	const lines: string[] = [];

	if (view.promotions.length === 0) {
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
	return lines;
}

function formatProductionAuthWarning(
	productionAuth: CanonicalStatusView['environments']['production'],
): string[] {
	if (productionAuth.authorizationIntegrity !== 'MISSING') return [];
	const c = getColors();
	return [
		'',
		c.red('PRODUCTION AUTHORIZATION: MISSING'),
		`Missing versions: ${productionAuth.authorizationMissingVersions.join(', ') || '(unknown)'}`,
		'Schema CURRENT is not owner-authorization evidence.',
		'No canonical command backfills historical owner-apply records.',
	];
}

function formatVerboseSchemaDetails(view: CanonicalStatusView): string[] {
	const c = getColors();
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

function formatRegistrySummarySection(view: CanonicalStatusView, headerWidth: number): string[] {
	const c = getColors();
	const lines: string[] = [
		'',
		c.dim('─'.repeat(headerWidth)),
		`  Registry invitations: ${c.bold(String(view.registryCount))}    In sync: ${c.green(String(view.inSyncCount))}    Attention: ${view.promotions.length > 0 ? c.brightYellow(String(view.promotions.length)) : c.green('0')}`,
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

function formatInSyncSection(view: CanonicalStatusView, includeInSync?: boolean): string[] {
	const c = getColors();
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
): string[] {
	const c = getColors();
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

function formatOperationalActionPlan(view: CanonicalStatusView, headerWidth: number): string[] {
	const c = getColors();
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
		view.freshnessMeta
			? `  Evidence freshness: ${view.freshnessMeta.status} (verified ${view.freshnessMeta.lastVerifiedAt})`
			: `  Evidence: ${view.evidence}`,
		...formatOperationalActionPlan(view, headerWidth),
		'',
		`${padVisible('', labelCol)}${c.brightCyan(padVisible('LOCAL', envCol))}${c.brightCyan(padVisible('PREVIEW', envCol))}${c.brightCyan(padVisible('PRODUCTION', envCol))}`,
		c.dim('─'.repeat(headerWidth)),
		...formatStatusRows(view, labelCol, envCol),
		'',
		c.dim(
			'(Schema = migration history. Authorization = owner-apply evidence. Invitations = registry publication. Readiness = migrate authorization.)',
		),
		...formatProductionAuthWarning(view.environments.production),
		'',
		...formatDisposableProofSection(view, headerWidth),
		...formatRecentMigrationsSection(view, headerWidth),
		...formatManualPatchesSection(view, headerWidth),
	];

	if (verbose) {
		lines.push(...formatVerboseSchemaDetails(view));
	}

	lines.push(...formatRegistrySummarySection(view, headerWidth));
	lines.push('');
	lines.push(...formatPublicationOverview(view, headerWidth, verbose));
	lines.push(...formatInSyncSection(view, options?.includeInSync));
	lines.push(...formatDiagnosticsSection(view, verbose, options?.diagnostics));
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
