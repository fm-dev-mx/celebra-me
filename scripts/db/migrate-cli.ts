/**
 * Canonical schema migration CLI — adapters only (no embedded DB mutation logic).
 * Help/parse paths stay free of orchestrator imports.
 *
 * Canonical operator entry: pnpm db:migrate -- --target <env>
 */

import { select } from '@inquirer/prompts';
import { parseMigrateCliArgs, printMigrateHelp, type MigrateCliArgs } from './migrate-cli-args.ts';
import { planToJson, type MigrationPlan } from './migration-plan.ts';
import {
	formatOperatorFailure,
	inquirerTheme,
	operatorSymbol,
	renderOperatorError,
	writeHuman,
} from './operator-cli-ux.ts';

function writeJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeError(error: unknown, target: MigrateCliArgs['target'] = null): void {
	renderOperatorError(error, {
		title: 'No se pudo completar la operación',
		retryCommand:
			target === 'production'
				? 'pnpm prod:apply -- --schema'
				: target
					? `pnpm db:migrate -- --target ${target}`
					: 'pnpm db:migrate -- --help',
		noChangesMessage:
			target === 'production' ? undefined : 'No se realizaron escrituras de schema.',
	});
	process.exitCode = 1;
}

async function promptAction(): Promise<'run' | 'review' | 'cancel'> {
	return select({
		message: 'Seleccione una acción',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{ name: 'Revisar cambios', value: 'review' as const },
			{ name: 'Aplicar', value: 'run' as const },
		],
		theme: inquirerTheme(),
	});
}

async function promptTarget(): Promise<MigrateCliArgs['target'] | 'cancel'> {
	return select({
		message: 'Seleccione el destino de migración de schema',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{ name: 'Local (persistent)', value: 'local' as const },
			{ name: 'Preview', value: 'preview' as const },
			{ name: 'Production', value: 'production' as const },
			{ name: 'Disposable-test', value: 'disposable-test' as const },
		],
		theme: inquirerTheme(),
	});
}

function writeApplyHint(
	target: NonNullable<MigrateCliArgs['target']>,
	expectedPin: readonly string[] | null,
): void {
	const expectedSuffix = expectedPin ? ` --expected ${expectedPin.join(',')}` : '';
	if (target === 'production') {
		writeHuman(`Para aplicar: pnpm prod:apply -- --schema${expectedSuffix} --apply`);
		return;
	}
	if (target === 'preview') {
		writeHuman(
			`Para aplicar: CELEBRA_TASK_SCOPE=preview:schema:migrate pnpm db:migrate -- --target preview --apply${expectedSuffix}`,
		);
		return;
	}
	writeHuman(`Para aplicar: pnpm db:migrate -- --target ${target} --apply${expectedSuffix}`);
}

type OrchestratorModule = typeof import('./migrate-orchestrator.ts');

function emitPlan(
	orchestrator: OrchestratorModule,
	plan: MigrationPlan,
	json: boolean,
	compact: boolean,
): void {
	writeHuman(
		compact ? orchestrator.formatPlanReviewCompact(plan) : orchestrator.formatPlanReview(plan),
	);
	if (json) writeJson(planToJson(plan));
}

type BaseMigrateInput = {
	target: NonNullable<MigrateCliArgs['target']>;
	expectedPin: readonly string[] | null;
	maxVersion?: string | null;
	env: NodeJS.ProcessEnv;
	isInteractive: boolean;
};

function writeApplyCompleted(wrote: boolean): void {
	writeHuman(
		wrote
			? `${operatorSymbol('ok')} Apply completado.`
			: `${operatorSymbol('ok')} Apply completado (sin migraciones pendientes).`,
	);
}

function shouldUseGuidedMenu(parsed: MigrateCliArgs, isTty: boolean): boolean {
	// Production authorization lives solely in requireOwnerProductionApply — no outer menu.
	if (parsed.target === 'production') return false;
	if (parsed.interactiveForced === true) return true;
	if (parsed.interactiveForced === false) return false;
	return isTty && !parsed.json && parsed.mode === 'preflight';
}

async function runGuidedApply(options: {
	orchestrator: OrchestratorModule;
	plan: MigrationPlan;
	baseInput: BaseMigrateInput;
	json: boolean;
}): Promise<void> {
	for (;;) {
		const action = await promptAction();
		if (action === 'cancel') {
			writeHuman(
				`${operatorSymbol('info')} Cancelado. No se realizó ninguna escritura de schema.`,
			);
			return;
		}
		if (action === 'review') {
			emitPlan(options.orchestrator, options.plan, options.json, false);
			continue;
		}
		const result = await options.orchestrator.orchestrateMigrate({
			...options.baseInput,
			mode: 'apply',
			reviewedPlan: options.plan,
		});
		emitPlan(options.orchestrator, result.plan, options.json, true);
		writeApplyCompleted(result.wrote);
		return;
	}
}

async function runPreflightOrGuided(options: {
	orchestrator: OrchestratorModule;
	baseInput: BaseMigrateInput;
	json: boolean;
	guided: boolean;
}): Promise<void> {
	const plan = options.orchestrator.preflightMigrate({
		...options.baseInput,
		mode: 'preflight',
	});
	emitPlan(options.orchestrator, plan, options.json, true);
	if (options.guided) {
		await runGuidedApply({
			orchestrator: options.orchestrator,
			plan,
			baseInput: options.baseInput,
			json: options.json,
		});
		return;
	}
	writeHuman(
		`${operatorSymbol('ok')} Preflight de solo lectura completado. No se escribió schema.`,
	);
	if (plan.pendingVersions.length === 0) {
		writeHuman(`${operatorSymbol('info')} No hay migraciones pendientes.`);
	} else {
		writeApplyHint(options.baseInput.target, options.baseInput.expectedPin);
	}
}

async function runProductionApply(options: {
	expectedPin: readonly string[] | null;
	json: boolean;
}): Promise<void> {
	const expectedSuffix = options.expectedPin
		? ` --expected ${options.expectedPin.join(',')}`
		: '';
	writeHuman(
		`${operatorSymbol('info')} Production apply usa pnpm prod:apply -- --schema${expectedSuffix} --apply.`,
	);
	const { applyProductionApplyPlan } = await import('./production-apply-orchestrator.ts');
	const { formatProductionApplyResult, toPublicProductionApplyPlan } =
		await import('./production-apply-format.ts');
	const execution = await applyProductionApplyPlan({
		help: false,
		json: options.json,
		apply: true,
		schema: true,
		slugs: [],
		allReady: false,
		inspectAll: false,
		expectedPin: options.expectedPin ? [...options.expectedPin] : null,
	});
	if (options.json) {
		writeJson({
			plan: toPublicProductionApplyPlan(execution.plan),
			wrote: execution.wrote,
			outcomes: execution.outcomes,
		});
		return;
	}
	writeHuman(formatProductionApplyResult(execution));
}

function writeMissingTargetFailure(): void {
	writeHuman(
		formatOperatorFailure({
			title: 'Falta el destino',
			cause: 'Sin TTY debe indicar --target <local|preview|production|disposable-test>.',
			code: 'TARGET_REQUIRED',
			remediation: [
				'En terminal interactiva: pnpm db:migrate (selector con Cancelar por defecto)',
				'Para Production: pnpm db:migrate -- --target production (preflight) o pnpm prod:apply -- --schema',
				'Ayuda: pnpm db:migrate -- --help',
			],
			retryCommand: 'pnpm db:migrate -- --help',
			noChangesMessage: 'No se realizaron escrituras de schema.',
		}),
	);
	process.exitCode = 1;
}

export async function runMigrateCli(argv: string[] = process.argv): Promise<void> {
	let parsed: MigrateCliArgs;
	try {
		parsed = parseMigrateCliArgs(argv);
	} catch (error: unknown) {
		writeError(error);
		return;
	}

	if (parsed.help) {
		printMigrateHelp();
		return;
	}

	const isTty = Boolean(process.stdin.isTTY && process.stderr.isTTY);
	let target = parsed.target;
	if (!target) {
		if (!isTty || parsed.json || parsed.interactiveForced === false) {
			writeMissingTargetFailure();
			return;
		}
		const selected = await promptTarget();
		if (selected === 'cancel' || selected === null) {
			writeHuman(
				`${operatorSymbol('info')} Cancelado. No se realizó ninguna escritura de schema.`,
			);
			return;
		}
		target = selected;
		parsed = { ...parsed, target };
	}

	// Dynamic import keeps --help / parse-only paths free of mutation modules.
	const [{ parseExpectedConstraint }, orchestrator] = await Promise.all([
		import('./migrate-expected.ts'),
		import('./migrate-orchestrator.ts'),
	]);

	let expectedPin: readonly string[] | null;
	try {
		expectedPin = parseExpectedConstraint(parsed.argv, process.env).expectedPin;
	} catch (error: unknown) {
		writeError(error, target);
		return;
	}

	if (parsed.maxVersion && target !== 'disposable-test') {
		writeError(new Error('--max-version is only valid with --target disposable-test.'), target);
		return;
	}

	const guided = shouldUseGuidedMenu(parsed, isTty);
	const baseInput: BaseMigrateInput = {
		target,
		expectedPin,
		maxVersion: parsed.maxVersion,
		env: process.env,
		isInteractive: isTty,
	};

	try {
		if (parsed.mode === 'preflight' || guided) {
			await runPreflightOrGuided({
				orchestrator,
				baseInput,
				json: parsed.json,
				guided,
			});
			return;
		}

		if (target === 'production') {
			await runProductionApply({
				expectedPin,
				json: parsed.json,
			});
			return;
		}

		const result = await orchestrator.orchestrateMigrate({ ...baseInput, mode: 'apply' });
		emitPlan(orchestrator, result.plan, parsed.json, true);
		writeApplyCompleted(result.wrote);
	} catch (error: unknown) {
		writeError(error, parsed.target);
	}
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /migrate-cli\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	void runMigrateCli().catch((error: unknown) => {
		writeError(error);
		process.exit(1);
	});
}
