/**
 * Canonical schema migration CLI — adapters only (no embedded DB mutation logic).
 * Help/parse paths stay free of orchestrator imports.
 */

import { select } from '@inquirer/prompts';
import { parseMigrateCliArgs, printMigrateHelp, type MigrateCliArgs } from './migrate-cli-args.ts';
import { planToJson, type MigrationPlan } from './migration-plan.ts';
import {
	formatOperatorFailure,
	operatorSymbol,
	writeHuman,
} from './operator-cli-ux.ts';

function writeJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeError(error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	const codeMatch = /^(?<code>[A-Z][A-Z0-9_]+):/.exec(message);
	const code = codeMatch?.groups?.code;
	if (code) {
		writeHuman(
			formatOperatorFailure({
				title: 'No se pudo completar la operación',
				cause: message.replace(/^[A-Z][A-Z0-9_]+:\s*/, ''),
				code,
				remediation: [
					'Revise la causa anterior y los controles de seguridad aplicables.',
					'Reejecute el preflight y, si corresponde, el apply.',
				],
				retryCommand: 'pnpm db:migrate -- --help',
				noChangesMessage: 'No se realizaron escrituras de schema.',
			}),
		);
	} else {
		writeHuman(`${operatorSymbol('fail')} ${message}`);
	}
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
	});
}

function writeApplyHint(
	target: NonNullable<MigrateCliArgs['target']>,
	expectedPin: readonly string[] | null,
): void {
	const expectedSuffix = expectedPin ? ` --expected ${expectedPin.join(',')}` : '';
	if (target === 'production') {
		writeHuman(
			`Para aplicar: pnpm release-check && pnpm db:migrate -- --target production --apply${expectedSuffix}`,
		);
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

async function runGuidedApply(options: {
	orchestrator: OrchestratorModule;
	plan: MigrationPlan;
	baseInput: {
		target: NonNullable<MigrateCliArgs['target']>;
		expectedPin: readonly string[] | null;
		env: NodeJS.ProcessEnv;
		isInteractive: boolean;
	};
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
		writeHuman(
			result.wrote
				? `${operatorSymbol('ok')} Apply completado.`
				: `${operatorSymbol('ok')} Apply completado (sin migraciones pendientes).`,
		);
		return;
	}
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

	if (!parsed.target) {
		writeHuman(
			formatOperatorFailure({
				title: 'Falta el destino',
				cause: 'Debe indicar --target <local|preview|production|disposable-test>.',
				code: 'TARGET_REQUIRED',
				remediation: ['Ejecute pnpm db:migrate -- --help para ver el uso.'],
				retryCommand: 'pnpm db:migrate -- --help',
				noChangesMessage: 'No se realizaron escrituras de schema.',
			}),
		);
		process.exitCode = 1;
		return;
	}

	// Dynamic import keeps --help / parse-only paths free of mutation modules.
	const [{ parseExpectedConstraint }, orchestrator] = await Promise.all([
		import('./migrate-expected.ts'),
		import('./migrate-orchestrator.ts'),
	]);

	let expectedPin: readonly string[] | null;
	try {
		const parsedExpected = parseExpectedConstraint(parsed.argv, process.env, {
			allowDeprecatedAliases: parsed.target === 'preview',
		});
		for (const warning of parsedExpected.deprecationWarnings) {
			writeHuman(`${operatorSymbol('warn')} ${warning}`);
		}
		expectedPin = parsedExpected.expectedPin;
	} catch (error: unknown) {
		writeError(error);
		return;
	}

	const isTty = Boolean(process.stdin.isTTY && process.stderr.isTTY);
	const guided =
		parsed.interactiveForced === true ||
		(parsed.interactiveForced !== false &&
			isTty &&
			!parsed.json &&
			parsed.mode === 'preflight');
	const baseInput = {
		target: parsed.target,
		expectedPin,
		env: process.env,
		isInteractive: isTty,
	};

	try {
		if (parsed.mode === 'preflight' || guided) {
			const plan = orchestrator.preflightMigrate({ ...baseInput, mode: 'preflight' });
			emitPlan(orchestrator, plan, parsed.json, true);
			if (!guided) {
				writeHuman(
					`${operatorSymbol('ok')} Preflight de solo lectura completado. No se escribió schema.`,
				);
				writeApplyHint(parsed.target, expectedPin);
				return;
			}
			await runGuidedApply({
				orchestrator,
				plan,
				baseInput,
				json: parsed.json,
			});
			return;
		}

		const result = await orchestrator.orchestrateMigrate({ ...baseInput, mode: 'apply' });
		emitPlan(orchestrator, result.plan, parsed.json, true);
		writeHuman(
			result.wrote
				? `${operatorSymbol('ok')} Apply completado.`
				: `${operatorSymbol('ok')} Apply completado (sin migraciones pendientes).`,
		);
	} catch (error: unknown) {
		writeError(error);
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
