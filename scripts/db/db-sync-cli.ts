/**
 * db-sync-cli.ts — Canonical CLI for invitation database synchronization facade.
 * Human diagnostics → stderr; --json → stdout. No embedded mutation engines.
 */

import { confirm, select } from '@inquirer/prompts';
import { redactCredentials } from './db-target-config.ts';
import { parseDbSyncArgs, printDbSyncHelp } from './db-sync-args.ts';
import { orchestrateDbSync, type OrchestrateDbSyncInput } from './db-sync-orchestrator.ts';
import {
	DB_SYNC_DIRECTION_LABELS,
	DB_SYNC_DIRECTIONS,
	exitCodeForResult,
	resultToJson,
	type DbSyncMode,
	type DbSyncResult,
} from './db-sync-types.ts';

function writeHuman(message = ''): void {
	process.stderr.write(`${redactCredentials(message)}\n`);
}

function writeJson(value: unknown): void {
	process.stdout.write(typeof value === 'string' ? value : resultToJson(value as DbSyncResult));
}

function writeError(error: unknown): void {
	writeHuman(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}

function formatResultHuman(result: DbSyncResult): void {
	writeHuman('--------------------------------------------------');
	writeHuman(`db:sync  mode=${result.mode}  status=${result.status}  ok=${result.ok}`);
	if (result.direction) {
		writeHuman(`Direction: ${DB_SYNC_DIRECTION_LABELS[result.direction]}`);
	}
	if (result.planId) writeHuman(`Plan ID:   ${result.planId}`);
	writeHuman('Targets:');
	for (const target of result.targets) {
		writeHuman(
			`  ${target.environment.padEnd(11)} available=${String(target.available).padEnd(5)} ` +
				`schema=${target.schemaLifecycle ?? 'UNVERIFIED'} ` +
				`${target.reason ?? ''}`.trim(),
		);
	}
	if (result.blockers && result.blockers.length > 0) {
		writeHuman('Blockers:');
		for (const blocker of result.blockers) writeHuman(`  - ${blocker}`);
	}
	if (result.drifts.length > 0) {
		writeHuman('Drifts (paths/summaries only):');
		for (const drift of result.drifts) {
			const paths = drift.paths?.length ? ` paths=${drift.paths.join(',')}` : '';
			writeHuman(`  - [${drift.kind}] ${drift.entity}: ${drift.detail}${paths}`);
		}
	}
	if (result.plan) {
		writeHuman('Plan:');
		writeHuman(`  Engine:     ${result.plan.delegatedEngine}`);
		writeHuman(`  Operation:  ${result.plan.delegatedOperation}`);
		writeHuman(`  Expires:    ${result.plan.expiresAt}`);
		writeHuman(`  Post-state: ${result.plan.expectedPostState}`);
		if (result.plan.gates.rsvpResetDisclosureRequired) {
			writeHuman(
				'  WARNING: Mirror apply truncates Preview events (CASCADE) and resets RSVP children.',
			);
		}
	}
	if (result.failures.length > 0) {
		writeHuman('Failures:');
		for (const failure of result.failures) writeHuman(`  - ${failure}`);
	}
	writeHuman('--------------------------------------------------');
}

function isTty(): boolean {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function runInteractiveWizard(base: OrchestrateDbSyncInput): Promise<DbSyncResult> {
	writeHuman('db:sync interactive workflow (read-only until you confirm a specific mutation).');
	const diagnose = await orchestrateDbSync({ ...base, mode: 'diagnose' });
	formatResultHuman(diagnose);

	const mode = await select({
		message: 'Select mode',
		choices: [
			{ name: 'Diagnose only (read-only)', value: 'diagnose' as DbSyncMode },
			{ name: 'Compare semantic content (read-only)', value: 'compare' as DbSyncMode },
			{ name: 'Build immutable plan (read-only)', value: 'plan' as DbSyncMode },
			{ name: 'Apply a reviewed plan (mutation)', value: 'apply' as DbSyncMode },
		],
	});

	if (mode === 'diagnose') return diagnose;

	if (mode === 'compare') {
		return orchestrateDbSync({ ...base, mode: 'compare' });
	}

	const direction = await select({
		message: 'Select direction',
		choices: DB_SYNC_DIRECTIONS.map((value) => ({
			name: DB_SYNC_DIRECTION_LABELS[value],
			value,
		})),
	});

	const planResult = await orchestrateDbSync({
		...base,
		mode: 'plan',
		direction,
	});
	formatResultHuman(planResult);
	if (!planResult.ok || !planResult.plan) return planResult;

	if (mode === 'plan') return planResult;

	const label = DB_SYNC_DIRECTION_LABELS[direction];
	writeHuman(`Reviewed planId: ${planResult.plan.planId}`);
	if (planResult.plan.gates.rsvpResetDisclosureRequired) {
		writeHuman(
			'DESTRUCTIVE: Mirror Production content into Preview will TRUNCATE events CASCADE.',
		);
	}
	const confirmed = await confirm({
		message: `Confirm exact operation: ${label}?`,
		default: false,
	});
	if (!confirmed) {
		const cancelled = { ...planResult, mode: 'apply' as const, ok: false, status: 'CANCELLED' };
		cancelled.failures = ['CANCELLED_BY_OPERATOR'];
		return cancelled;
	}

	return orchestrateDbSync({
		...base,
		mode: 'apply',
		direction,
		apply: true,
		reviewedPlan: planResult.plan,
		expectedPlan: planResult.plan.planId,
	});
}

export async function runDbSyncCli(argv: string[] = process.argv.slice(2)): Promise<void> {
	let parsed;
	try {
		parsed = parseDbSyncArgs(argv);
	} catch (error: unknown) {
		writeError(error);
		return;
	}

	if (parsed.help) {
		printDbSyncHelp();
		return;
	}

	const interactive = isTty() && !parsed.noInteractive && !parsed.mode;
	if (!isTty() && !parsed.noInteractive && !parsed.mode) {
		writeError(
			new Error(
				'NON_INTERACTIVE_REQUIRED: no TTY detected. Pass an explicit mode and --no-interactive.',
			),
		);
		return;
	}

	const base: OrchestrateDbSyncInput = {
		mode: parsed.mode ?? 'diagnose',
		direction: parsed.direction,
		slug: parsed.slug,
		eventType: parsed.eventType,
		packagePath: parsed.packagePath,
		expectedPlan: parsed.expectedPlan,
		backupManifest: parsed.backupManifest,
		apply: parsed.apply,
		strict: parsed.strict || parsed.mode === 'diagnose' || parsed.mode === 'apply',
		envs: parsed.envs,
	};

	try {
		let result: DbSyncResult;
		if (interactive) {
			result = await runInteractiveWizard(base);
		} else {
			if (!parsed.mode) {
				writeError(
					new Error('MODE_REQUIRED: pass diagnose|compare|plan|apply or use a TTY'),
				);
				return;
			}
			if (parsed.mode === 'apply' && !parsed.apply) {
				writeError(new Error('APPLY_FLAG_REQUIRED: apply mode requires --apply'));
				return;
			}
			result = await orchestrateDbSync(base);
		}

		if (!parsed.json) formatResultHuman(result);
		if (parsed.json) writeJson(result);
		process.exitCode = exitCodeForResult(result, { strict: true });
	} catch (error: unknown) {
		writeError(error);
	}
}

if (typeof process.argv[1] === 'string' && /db-sync-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1])) {
	void runDbSyncCli().catch((error: unknown) => {
		writeError(error);
		process.exitCode = 1;
	});
}
