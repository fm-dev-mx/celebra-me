/**
 * Interactive pnpm prod:apply. Read-only planning by default; apply options are never
 * preselected and always run through the existing orchestrator and owner gate
 * (requireOwnerProductionApply: Cancel-default intent menu + typed bound code).
 */
import { existsSync } from 'node:fs';
import {
	askText,
	confirmDanger,
	isPromptExit,
	menu,
	pickMany,
	printLine,
	runInteractive,
	step,
	theme,
} from '../lib/cli-prompts.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import { evaluateCriticalBackupHealth } from './critical-backup-health.ts';
import { renderOperatorError, shortSha, writeHuman } from './operator-cli-ux.ts';
import {
	parseProductionApplyCliArgs,
	type ProductionApplyCliArgs,
} from './production-apply-cli-args.ts';
import {
	formatProductionApplyPlan,
	formatProductionApplyResult,
	toPublicProductionApplyPlan,
} from './production-apply-format.ts';
import {
	applyOffersFromPlan,
	argvFromSelection,
	describeSelection,
	imageNamespaceOffer,
	productionApplyRootMenu,
	summarizePlanRows,
	type ProductionApplyOffer,
	type ProductionApplyRootAction,
	type ProductionApplySelection,
} from './production-apply-menu-model.ts';
import {
	applyProductionApplyPlan,
	buildProductionApplyPlan,
} from './production-apply-orchestrator.ts';
import { mutationItemsOf, type ProductionApplyPlan } from './production-apply-plan.ts';
import { runProductionImageNamespaceApply } from './production-image-namespace-apply.ts';
import { readReleaseCheckEvidence } from './release-check.ts';

function parseSelection(selection: ProductionApplySelection): ProductionApplyCliArgs {
	return parseProductionApplyCliArgs([
		'node',
		'production-apply-cli.ts',
		...argvFromSelection(selection),
	]);
}

function headerFacts(): string[] {
	const t = theme();
	const facts: string[] = [];
	const evidence = readReleaseCheckEvidence();
	facts.push(
		evidence
			? t.mark('ok', `release evidence ${shortSha(evidence.sha)}`)
			: t.mark('warn', 'release evidence missing (pnpm release-check)'),
	);
	try {
		const backup = evaluateCriticalBackupHealth();
		facts.push(
			t.mark(
				backup.attention ? 'warn' : 'ok',
				`backup${backup.checkoutLabel ? ` [${backup.checkoutLabel}]` : ''} ${backup.summary}`,
			),
		);
	} catch {
		facts.push(t.mark('warn', 'backup health unknown'));
	}
	return facts;
}

function splitList(value: string): string[] {
	return value
		.split(/[\s,]+/)
		.map((part) => part.trim())
		.filter(Boolean);
}

async function askExpectedPin(): Promise<string[] | undefined> {
	const raw = await askText({
		title: 'Pin expected pending versions (comma separated, Enter for none)',
	});
	const versions = splitList(raw);
	return versions.length > 0 ? versions : undefined;
}

function existingFile(extension: string): (value: string) => true | string {
	return (value) => {
		if (!value) return 'A path is required.';
		if (!value.toLowerCase().endsWith(extension)) return `Expected a ${extension} file.`;
		if (!existsSync(value)) return 'File not found (paths are relative to the repo root).';
		return true;
	};
}

async function collectSelection(
	choice: Exclude<ProductionApplyRootAction, 'json' | 'exit'>,
): Promise<ProductionApplySelection | null> {
	switch (choice) {
		case 'inspect_all':
			return { kind: 'inspect_all' };
		case 'schema':
			return { kind: 'schema', expectedPin: await askExpectedPin() };
		case 'all_ready':
			return { kind: 'all_ready', expectedPin: await askExpectedPin() };
		case 'invitations': {
			const definitions = listInvitationDefinitions().sort((a, b) =>
				a.slug.localeCompare(b.slug),
			);
			const slugs = await pickMany({
				title: 'Invitations to plan (space to select, Enter to confirm)',
				items: definitions.map((definition) => ({
					value: definition.slug,
					label: `${definition.slug}  ${theme().dim(definition.title)}`,
				})),
				required: false,
			});
			if (slugs.length === 0) {
				printLine(theme().mark('info', 'No invitation selected.'));
				return null;
			}
			return { kind: 'invitations', slugs };
		}
		case 'patch': {
			const patchFile = await askText({
				title: 'Patch file (.sql with manifest)',
				required: true,
				validate: existingFile('.sql'),
			});
			const ownerUserId = await askText({
				title: 'Owner user id (only when the patch reads app.owner_user_id; Enter to skip)',
			});
			return { kind: 'patch', patchFile, ownerUserId: ownerUserId || undefined };
		}
		case 'image_namespace': {
			const direction = await menu<'migrate' | 'rollback' | 'back'>({
				title: 'Image namespace operation',
				items: [
					{ value: 'migrate', label: 'Migration (reviewed manifest)' },
					{ value: 'rollback', label: 'Rollback (reviewed manifest)' },
					{ value: 'back', label: 'Back' },
				],
				initial: 'migrate',
			});
			if (direction === 'back') return null;
			const imageManifestPath = await askText({
				title: 'Manifest path (.json)',
				required: true,
				validate: existingFile('.json'),
			});
			return {
				kind: 'image_namespace',
				imageManifestPath,
				imageRollback: direction === 'rollback',
			};
		}
	}
}

function planDoneLine(plan: ProductionApplyPlan): string {
	const mutations = mutationItemsOf(plan);
	const blocked = plan.items.filter((item) => item.readiness === 'BLOCKED').length;
	const parts = [`plan ${shortSha(plan.planId)}`, `${mutations.length} mutation(s)`];
	if (blocked > 0) parts.push(`${blocked} blocked`);
	return `Plan ready · ${parts.join(' · ')}`;
}

async function planSelection(selection: ProductionApplySelection): Promise<ProductionApplyPlan> {
	const parsed = parseSelection(selection);
	const plan = await step(
		`Planning Production (read-only): ${describeSelection(selection)}`,
		() => buildProductionApplyPlan(parsed),
		{ done: planDoneLine },
	);
	writeHuman(formatProductionApplyPlan(plan));
	printLine();
	printLine(theme().summary('Summary', summarizePlanRows(plan)));
	return plan;
}

async function runApply(
	offer: ProductionApplyOffer,
	plan: ProductionApplyPlan | null,
): Promise<void> {
	const t = theme();
	const selection = { ...offer.selection, apply: true };
	const facts = [
		`Target: ${t.envName('production')}`,
		`Scope: ${describeSelection(selection)}`,
		plan ? `Reviewed plan ${shortSha(plan.planId)} (re-planned before writing)` : null,
		selection.acknowledgeDiscardUnpublishedDraft
			? 'Unpublished target drafts will be discarded'
			: null,
		'Owner confirmation follows: Cancel is the default, then a typed bound code',
	].filter((fact): fact is string => Boolean(fact));
	const proceed = await confirmDanger({
		title: 'PRODUCTION WRITE',
		facts,
		question: 'Continue to the owner confirmation?',
	});
	if (!proceed) {
		printLine(t.mark('info', 'No writes. Production is unchanged.'));
		return;
	}
	try {
		if (selection.kind === 'image_namespace') {
			await runProductionImageNamespaceApply({
				manifestPath: selection.imageManifestPath!,
				apply: true,
				rollback: Boolean(selection.imageRollback),
			});
			printLine(t.mark('ok', `${describeSelection(selection)} finished.`));
			return;
		}
		const parsed = parseSelection(selection);
		const execution = await applyProductionApplyPlan(parsed);
		writeHuman(formatProductionApplyResult(execution));
		printLine(
			t.summary('Summary', [
				['Target', t.env('production')],
				['Scope', describeSelection(selection)],
				['Wrote', execution.wrote ? t.ok('yes') : 'no'],
				[
					'Outcomes',
					execution.outcomes.map((row) => `${row.id}: ${row.outcome}`).join(', '),
				],
				['Next', 'pnpm dbs to confirm the new state'],
			]),
		);
	} catch (error) {
		if (isPromptExit(error)) throw error;
		renderOperatorError(error, {
			title: 'No se pudo completar Production apply',
			retryCommand: `pnpm prod:apply -- ${argvFromSelection(selection).join(' ')}`,
		});
		process.exitCode = 1;
	}
}

async function runImageNamespacePlan(selection: ProductionApplySelection): Promise<void> {
	await step(
		`Planning ${describeSelection(selection)} (read-only)`,
		() =>
			runProductionImageNamespaceApply({
				manifestPath: selection.imageManifestPath!,
				apply: false,
				rollback: Boolean(selection.imageRollback),
			}),
		{ done: () => 'Image namespace plan printed' },
	);
}

async function printJsonPlan(): Promise<void> {
	const parsed = parseSelection({ kind: 'inspect_all', json: true });
	const plan = await step('Planning Production (read-only, JSON)', () =>
		buildProductionApplyPlan(parsed),
	);
	process.stdout.write(`${JSON.stringify(toPublicProductionApplyPlan(plan), null, 2)}\n`);
}

type NextStep = 'exit' | 'replan' | 'menu' | `apply:${number}`;

export async function runProductionApplyInteractive(): Promise<void> {
	await runInteractive(async () => {
		const t = theme();
		printLine(t.header('prod:apply', [t.env('production'), ...headerFacts()]));
		printLine(
			t.dim('Read-only planning. Enter never writes; apply options are never preselected.'),
		);
		printLine();

		let selection: ProductionApplySelection | null = null;
		for (;;) {
			if (!selection) {
				const root = productionApplyRootMenu();
				const choice = await menu({
					title: 'Plan scope (read-only)',
					items: root.items,
					initial: root.initial,
				});
				if (choice === 'exit') return;
				if (choice === 'json') {
					await printJsonPlan();
					const after = await menu<'menu' | 'exit'>({
						title: 'Next step',
						items: [
							{ value: 'exit', label: 'Exit' },
							{ value: 'menu', label: 'Back to menu' },
						],
						initial: 'exit',
					});
					if (after === 'exit') return;
					continue;
				}
				selection = await collectSelection(choice);
				if (!selection) continue;
			}

			let plan: ProductionApplyPlan | null = null;
			let offers: ProductionApplyOffer[];
			try {
				if (selection.kind === 'image_namespace') {
					await runImageNamespacePlan(selection);
					offers = [imageNamespaceOffer(selection)];
				} else {
					plan = await planSelection(selection);
					offers = applyOffersFromPlan(plan, selection);
				}
			} catch (error) {
				if (isPromptExit(error)) throw error;
				renderOperatorError(error, {
					title: 'No se pudo completar Production apply',
					retryCommand: 'pnpm prod:apply',
					noChangesMessage: 'No se realizaron escrituras en Production.',
				});
				selection = null;
				continue;
			}

			printLine();
			if (offers.length === 0) {
				printLine(t.mark('info', 'Nothing applicable in this scope. No writes.'));
			}
			const next = await menu<NextStep>({
				title: 'Next step',
				items: [
					{ value: 'exit', label: 'Exit' },
					{ value: 'replan', label: 'Replan this scope' },
					{ value: 'menu', label: 'Change scope' },
					...offers.map((offer, index) => ({
						value: `apply:${index}` as const,
						label: `${offer.label}  — writes to PRODUCTION`,
						danger: true,
					})),
				],
				initial: 'exit',
			});
			if (next === 'exit') return;
			if (next === 'replan') continue;
			if (next === 'menu') {
				selection = null;
				continue;
			}
			const offer = offers[Number(next.slice('apply:'.length))];
			if (!offer) continue;
			await runApply(offer, plan);
			const after = await menu<'exit' | 'replan'>({
				title: 'Next step',
				items: [
					{ value: 'exit', label: 'Exit' },
					{ value: 'replan', label: 'Replan to review the new state' },
				],
				initial: 'exit',
			});
			if (after === 'exit') return;
		}
	});
}
