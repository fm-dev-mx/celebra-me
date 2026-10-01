/**
 * ship:preview — carry committed schema migrations from the disposable reference to Local and
 * Preview in one process: availability → disposable → Local → Local audit → Preview → Preview audit.
 *
 * Without --apply every step is a read-only preflight. With --apply each write still goes through
 * the canonical migrate orchestrator and keeps its own authorization (Preview requires its task
 * scope or a typed YES). The first failure stops the sequence, so Preview is never touched after a
 * Local failure. Production is out of scope: its owner path stays `pnpm prod:apply -- --schema`.
 */

import { runCommand } from './db-workflow-lib.ts';
import type { MigrationPlan } from './migration-plan.ts';
import { operatorSymbol, renderOperatorError, writeHuman } from './operator-cli-ux.ts';

type ShipTarget = 'disposable-test' | 'local' | 'preview';

export interface ShipPreviewDeps {
	verifyAvailability: () => Promise<{ environment: string; available: boolean }[]>;
	preflight: (target: ShipTarget) => MigrationPlan;
	apply: (target: ShipTarget) => Promise<{ plan: MigrationPlan; wrote: boolean }>;
	audit: (target: 'local' | 'preview') => void;
	summarize: () => void;
}

export interface ShipPreviewResult {
	applied: boolean;
	steps: string[];
}

const TARGETS: readonly ShipTarget[] = ['disposable-test', 'local', 'preview'];

function pendingSummary(plan: MigrationPlan): string {
	const pending = plan.pendingVersions.filter((version) => version !== 'none');
	return pending.length === 0 ? 'sin pendientes' : `pendientes: ${pending.join(', ')}`;
}

export async function shipPreview(
	options: { apply: boolean },
	deps: ShipPreviewDeps,
): Promise<ShipPreviewResult> {
	const steps: string[] = [];
	const availability = await deps.verifyAvailability();
	const unavailable = availability.filter((result) => !result.available);
	if (unavailable.length > 0) {
		throw new Error(
			`Bases no disponibles: ${unavailable.map((result) => result.environment).join(', ')}. ` +
				'No se infiere estado sin evidencia.',
		);
	}
	steps.push('availability');

	for (const target of TARGETS) {
		if (!options.apply) {
			const plan = deps.preflight(target);
			writeHuman(`${operatorSymbol('info')} ${target}: ${pendingSummary(plan)}`);
			steps.push(`preflight:${target}`);
			if (target === 'disposable-test' && plan.pendingVersions.some((v) => v !== 'none')) {
				// Local and Preview require the disposable proof that only this apply records.
				writeHuman(
					`${operatorSymbol('info')} Local y Preview se planifican después de aplicar en disposable-test.`,
				);
				break;
			}
			continue;
		}
		const result = await deps.apply(target);
		writeHuman(
			`${operatorSymbol('ok')} ${target}: ${result.wrote ? 'aplicado' : 'sin cambios'} (${pendingSummary(result.plan)})`,
		);
		steps.push(`apply:${target}`);
		if (target !== 'disposable-test') {
			deps.audit(target);
			steps.push(`audit:${target}`);
		}
	}

	if (options.apply) {
		deps.summarize();
		steps.push('summary');
	} else {
		writeHuman(
			`${operatorSymbol('info')} Solo plan. Para aplicar: pnpm ship:preview -- --apply`,
		);
	}
	return { applied: options.apply, steps };
}

function runPnpm(args: string[]): void {
	const result = runCommand('pnpm', args, { throwOnError: false, inherit: true });
	if (result.status !== 0) {
		throw new Error(`pnpm ${args.join(' ')} falló (exit ${String(result.status)}).`);
	}
}

async function defaultDeps(): Promise<ShipPreviewDeps> {
	const [{ preflightMigrate, orchestrateMigrate }, { verifyRequiredDatabaseAvailability }] =
		await Promise.all([
			import('./migrate-orchestrator.ts'),
			import('./verify-required-database-availability.ts'),
		]);
	const isInteractive = Boolean(process.stdin.isTTY && process.stderr.isTTY);
	return {
		verifyAvailability: () => verifyRequiredDatabaseAvailability(['local', 'preview']),
		preflight: (target) =>
			preflightMigrate({ target, mode: 'preflight', expectedPin: null, isInteractive }),
		apply: (target) =>
			orchestrateMigrate({ target, mode: 'apply', expectedPin: null, isInteractive }),
		audit: (target) => runPnpm([`db:${target}:audit`]),
		summarize: () => runPnpm(['dbs', '--', '--targets', 'local,preview']),
	};
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
	const args = argv.filter((arg) => arg !== '--');
	if (args.includes('--help') || args.includes('-h')) {
		writeHuman(
			'Uso: pnpm ship:preview [-- --apply]\n' +
				'Sin --apply: preflight de solo lectura en disposable-test, local y preview.\n' +
				'Con --apply: aplica en ese orden, audita local y preview, y resume el estado.\n' +
				'Preview exige CELEBRA_TASK_SCOPE=preview:schema:migrate o confirmación YES.',
		);
		return;
	}
	const unknown = args.filter((arg) => arg !== '--apply');
	if (unknown.length > 0) throw new Error(`Argumento no reconocido: ${unknown.join(' ')}`);
	await shipPreview({ apply: args.includes('--apply') }, await defaultDeps());
}

if (process.argv[1]?.endsWith('ship-preview-cli.ts')) {
	main().catch((error: unknown) => {
		renderOperatorError(error, {
			title: 'ship:preview se detuvo',
			retryCommand: 'pnpm ship:preview',
			noChangesMessage: 'Los pasos posteriores al fallo no se ejecutaron.',
		});
		process.exitCode = 1;
	});
}
