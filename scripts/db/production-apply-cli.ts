/**
 * Owner-only Production apply CLI.
 *
 * Default: read-only plan. --apply mutates through canonical domain primitives
 * after one owner TTY confirmation bound to the plan fingerprint.
 * On a terminal without flags an interactive menu plans scopes; every flag below is also a
 * menu option and apply is never preselected.
 */
import {
	parseProductionApplyCliArgs,
	printProductionApplyHelp,
} from './production-apply-cli-args.ts';
import {
	formatProductionApplyPlan,
	formatProductionApplyResult,
	toPublicProductionApplyPlan,
} from './production-apply-format.ts';
import {
	applyProductionApplyPlan,
	buildProductionApplyPlan,
} from './production-apply-orchestrator.ts';
import { renderOperatorError, writeHuman } from './operator-cli-ux.ts';
import { productionApplyHandoff } from './production-apply-plan.ts';
import { runProductionImageNamespaceApply } from './production-image-namespace-apply.ts';
import { isInteractiveSession } from '../lib/cli-prompts.ts';
import { shouldOpenProductionApplyMenu } from './production-apply-menu-model.ts';

function writeJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
	// Terminal without flags: interactive read-only plan menu. Agents and pipes keep the
	// non-interactive read-only inspect-all plan below.
	if (shouldOpenProductionApplyMenu(process.argv.slice(2), isInteractiveSession())) {
		const { runProductionApplyInteractive } = await import('./production-apply-interactive.ts');
		await runProductionApplyInteractive();
		return;
	}
	let parsed;
	try {
		parsed = parseProductionApplyCliArgs(process.argv);
	} catch (error) {
		renderOperatorError(error, {
			title: 'Argumentos inválidos',
			retryCommand: 'pnpm prod:apply -- --help',
			noChangesMessage: 'No se realizaron escrituras en Production.',
		});
		process.exitCode = 1;
		return;
	}

	if (parsed.help) {
		printProductionApplyHelp();
		return;
	}

	try {
		if (parsed.imageManifestPath) {
			await runProductionImageNamespaceApply({
				manifestPath: parsed.imageManifestPath,
				apply: parsed.apply,
				rollback: Boolean(parsed.imageRollback),
			});
			return;
		}
		if (!parsed.apply) {
			const plan = await buildProductionApplyPlan(parsed);
			if (parsed.json) {
				writeJson(toPublicProductionApplyPlan(plan));
			} else {
				writeHuman(formatProductionApplyPlan(plan));
			}
			if (parsed.json) {
				writeHuman(productionApplyHandoff(plan));
			}
			return;
		}

		const execution = await applyProductionApplyPlan(parsed);
		if (parsed.json) {
			writeJson({
				plan: toPublicProductionApplyPlan(execution.plan),
				wrote: execution.wrote,
				outcomes: execution.outcomes,
			});
		} else {
			writeHuman(formatProductionApplyResult(execution));
		}
	} catch (error) {
		renderOperatorError(error, {
			title: 'No se pudo completar Production apply',
			retryCommand: 'pnpm prod:apply',
			noChangesMessage: parsed.apply
				? undefined
				: 'No se realizaron escrituras en Production.',
		});
		process.exitCode = 1;
	}
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /production-apply-cli\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	void main();
}
