/**
 * db-sync-cli.ts — Canonical CLI for invitation database synchronization facade.
 * Human diagnostics → stderr; --json → stdout. No embedded mutation engines.
 */

import { select } from '@inquirer/prompts';
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
	writeHuman(`db:sync  modo=${result.mode}  estado=${result.status}  ok=${result.ok}`);
	if (result.direction) {
		writeHuman(`Dirección: ${DB_SYNC_DIRECTION_LABELS[result.direction]}`);
	}
	if (result.planId) writeHuman(`Plan ID:   ${result.planId}`);
	writeHuman('Destinos:');
	for (const target of result.targets) {
		writeHuman(
			`  ${target.environment.padEnd(11)} available=${String(target.available).padEnd(5)} ` +
				`schema=${target.schemaLifecycle ?? 'UNVERIFIED'} ` +
				`${target.reason ?? ''}`.trim(),
		);
	}
	if (result.blockers && result.blockers.length > 0) {
		writeHuman('Bloqueos:');
		for (const blocker of result.blockers) writeHuman(`  - ${blocker}`);
	}
	if (result.drifts.length > 0) {
		writeHuman('Diferencias (rutas/resúmenes):');
		for (const drift of result.drifts) {
			const paths = drift.paths?.length ? ` paths=${drift.paths.join(',')}` : '';
			writeHuman(`  - [${drift.kind}] ${drift.entity}: ${drift.detail}${paths}`);
		}
	}
	if (result.plan) {
		writeHuman('Plan:');
		writeHuman(`  Motor:      ${result.plan.delegatedEngine}`);
		writeHuman(`  Operación:  ${result.plan.delegatedOperation}`);
		writeHuman(`  Expira:     ${result.plan.expiresAt}`);
		writeHuman(`  Post-estado:${result.plan.expectedPostState}`);
		if (result.plan.gates.rsvpResetDisclosureRequired) {
			writeHuman(
				'  ADVERTENCIA: Mirror aplica TRUNCATE events CASCADE y reinicia RSVP en Preview.',
			);
		}
	}
	if (result.failures.length > 0) {
		writeHuman('Fallos:');
		for (const failure of result.failures) writeHuman(`  - ${failure}`);
	}
	writeHuman('--------------------------------------------------');
}

function isTty(): boolean {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function runInteractiveWizard(base: OrchestrateDbSyncInput): Promise<DbSyncResult> {
	writeHuman(
		'db:sync interactivo (solo lectura hasta que el orquestador autorice una mutación).',
	);
	const diagnose = await orchestrateDbSync({ ...base, mode: 'diagnose' });
	formatResultHuman(diagnose);

	const mode = await select({
		message: 'Seleccione un modo',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{ name: 'Diagnosticar (solo lectura)', value: 'diagnose' as DbSyncMode },
			{ name: 'Comparar contenido semántico (solo lectura)', value: 'compare' as DbSyncMode },
			{ name: 'Construir plan inmutable (solo lectura)', value: 'plan' as DbSyncMode },
			{ name: 'Aplicar un plan revisado (mutación)', value: 'apply' as DbSyncMode },
		],
	});

	if (mode === 'cancel') {
		return {
			...diagnose,
			mode: 'diagnose',
			ok: false,
			status: 'CANCELLED',
			failures: ['CANCELLED_BY_OPERATOR'],
		};
	}
	if (mode === 'diagnose') return diagnose;

	if (mode === 'compare') {
		return orchestrateDbSync({ ...base, mode: 'compare' });
	}

	const direction = await select({
		message: 'Seleccione la dirección',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			...DB_SYNC_DIRECTIONS.map((value) => ({
				name: DB_SYNC_DIRECTION_LABELS[value],
				value,
			})),
		],
	});
	if (direction === 'cancel') {
		return {
			...diagnose,
			mode: 'plan',
			ok: false,
			status: 'CANCELLED',
			failures: ['CANCELLED_BY_OPERATOR'],
		};
	}

	const planResult = await orchestrateDbSync({
		...base,
		mode: 'plan',
		direction,
	});
	formatResultHuman(planResult);
	if (!planResult.ok || !planResult.plan) return planResult;

	if (mode === 'plan') return planResult;

	const label = DB_SYNC_DIRECTION_LABELS[direction];
	writeHuman(`Plan revisado: ${planResult.plan.planId}`);
	if (planResult.plan.gates.rsvpResetDisclosureRequired) {
		writeHuman('DESTRUCTIVO: Mirror de Production a Preview hará TRUNCATE events CASCADE.');
	}
	const action = await select({
		message: `Operación exacta: ${label}`,
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{
				name: 'Aplicar (delegado al orquestador; auth del dominio si aplica)',
				value: 'apply' as const,
			},
		],
	});
	if (action === 'cancel') {
		const cancelled = { ...planResult, mode: 'apply' as const, ok: false, status: 'CANCELLED' };
		cancelled.failures = ['CANCELLED_BY_OPERATOR'];
		return cancelled;
	}

	// No second YES/confirm here — Preview/Production auth lives in delegated orchestrators.
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
				'NON_INTERACTIVE_REQUIRED: no hay TTY. Pase un modo explícito y --no-interactive.',
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
					new Error('MODE_REQUIRED: pase diagnose|compare|plan|apply o use un TTY'),
				);
				return;
			}
			if (parsed.mode === 'apply' && !parsed.apply) {
				writeError(new Error('APPLY_FLAG_REQUIRED: el modo apply requiere --apply'));
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
