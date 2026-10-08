/** Read-only terminal navigation for dbs. Prompt choices never execute remedies. */
import type { CanonicalStatusView } from '../../src/lib/status/types.ts';
import {
	askNumber,
	confirmAction,
	menu,
	pickMany,
	printLine,
	runInteractive,
	searchOne,
	step,
	theme,
} from '../lib/cli-prompts.ts';
import { formatMediaReferences } from './dbs-media-references.ts';
import { formatCanonicalStatusView } from './canonical-status-format.ts';
import {
	buildInvitationChoices,
	dbsEnvironmentFacts,
	dbsNextStep,
	dbsRootMenu,
	type DbsMenuAction,
	type DbsMenuState,
} from './dbs-interactive-model.ts';
import { formatInvitationDetail } from './dbs-interactive-format.ts';
import type { TargetEnv } from './dbs-status.ts';
import {
	MANAGED_STATUS_DEFAULT_TIMEOUT_MS,
	runCompactManagedStatusSafe,
} from './managed-status.ts';
import {
	loadDbsEvidence,
	runGeneralView,
	runInvitationView,
	type DbsEvidence as InteractiveState,
} from './dbs-views.ts';

interface ViewOptions {
	targets?: TargetEnv[];
	verbose: boolean;
	includeInSync: boolean;
	diagnostics: boolean;
}

const ALL_TARGETS: readonly TargetEnv[] = ['local', 'preview', 'production'];

function loadState(options: ViewOptions): Promise<InteractiveState> {
	// Stay silent on a refine failure (it would garble the spinner); the fast view's evidence
	// markers remain visible.
	return loadDbsEvidence(options, () => {});
}

function environmentLine(view: CanonicalStatusView): string {
	const t = theme();
	const facts = dbsEnvironmentFacts(view).map((fact) => {
		const kind =
			fact.evidence === 'UNVERIFIED'
				? 'warn'
				: fact.schema !== 'CURRENT' || fact.attention > 0
					? 'pending'
					: 'ok';
		const detail =
			fact.evidence === 'UNVERIFIED'
				? 'unverified'
				: [
						fact.schema === 'CURRENT' ? 'schema current' : `schema ${fact.schema}`,
						fact.attention > 0 ? `${fact.attention} pending` : null,
					]
						.filter(Boolean)
						.join(', ');
		return `${t.env(fact.env)} ${t.mark(kind, detail)}`;
	});
	return facts.join(`  ${t.dim(t.symbol('bullet'))}  `);
}

function healthSummary(state: InteractiveState, pendingCount: number): string {
	const t = theme();
	const status = state.plan.health.status;
	const kind = status === 'GREEN' ? 'ok' : status === 'ACTION_REQUIRED' ? 'fail' : 'warn';
	return t.summary(null, [
		['Health', t.mark(kind, `${status} · ${state.plan.health.summary}`)],
		['Next actions', String(state.plan.actions.length)],
		['Pending invitations', String(pendingCount)],
	]);
}

async function showOverview(state: InteractiveState, options: ViewOptions): Promise<void> {
	process.stdout.write(
		formatCanonicalStatusView(state.view, {
			verbose: options.verbose,
			includeInSync: options.includeInSync,
			diagnostics: options.diagnostics,
			operationalPlan: state.plan,
		}) + formatMediaReferences(state.media, { verbose: options.verbose }),
	);
}

async function showInvitation(state: InteractiveState): Promise<boolean> {
	const t = theme();
	const choices = buildInvitationChoices(state.view, state.media);
	for (const target of ['preview', 'production'] as const)
		if (state.media[target]?.status === 'UNVERIFIED')
			printLine(
				t.mark('warn', `${t.env(target)}: unverified; pending invitations may be missing.`),
			);
	if (choices.length === 0) {
		printLine(t.mark('info', 'No confirmed pending invitations to inspect.'));
		return false;
	}
	const selection = await searchOne({
		title: 'Invitation (type to filter by slug)',
		items: choices.map((choice) => ({
			value: choice.route,
			label: choice.label,
			keywords: choice.route,
		})),
	});
	if (selection === 'back') return false;
	const choice = choices.find((item) => item.route === selection);
	if (choice) process.stdout.write(formatInvitationDetail({ choice, ...state }));
	return true;
}

async function runCompact(options: ViewOptions): Promise<void> {
	const aggregateContent = await confirmAction({
		question: 'Aggregate content status across environments?',
		initial: false,
	});
	const timeoutMs = await askNumber({
		title: 'Remote probe budget in ms',
		initial: MANAGED_STATUS_DEFAULT_TIMEOUT_MS,
		min: 500,
		max: 60_000,
	});
	const result = await step(
		'Probing connectivity',
		() =>
			runCompactManagedStatusSafe({
				timeoutMs,
				aggregateContent,
				environments: options.targets,
			}),
		{ done: (r) => (r.ok ? 'Connectivity check finished' : 'Connectivity check degraded') },
	);
	process.stdout.write(result.text + '\n');
	printLine(theme().dim('Published images are not evaluated in compact mode.'));
}

async function editOptions(options: ViewOptions): Promise<{ targetsChanged: boolean }> {
	const current = options.targets ?? ALL_TARGETS;
	const targets = await pickMany<TargetEnv>({
		title: 'Environments to probe',
		items: ALL_TARGETS.map((env) => ({
			value: env,
			label: theme().env(env),
			checked: current.includes(env),
		})),
		required: true,
	});
	const nextTargets = targets.length === ALL_TARGETS.length ? undefined : targets;
	const targetsChanged =
		(nextTargets ?? ALL_TARGETS).join(',') !== (options.targets ?? ALL_TARGETS).join(',');
	options.targets = nextTargets;
	options.verbose = await confirmAction({
		question: 'Verbose (migration IDs, env states, reason codes)?',
		initial: options.verbose,
	});
	options.includeInSync = await confirmAction({
		question: 'List in-sync invitations?',
		initial: options.includeInSync,
	});
	const diagnostics = await confirmAction({
		question: 'Include diagnostics enrichment?',
		initial: options.diagnostics,
	});
	const diagnosticsChanged = diagnostics !== options.diagnostics;
	options.diagnostics = diagnostics;
	return { targetsChanged: targetsChanged || diagnosticsChanged };
}

async function printJson(options: ViewOptions, state: InteractiveState | null): Promise<void> {
	const choices = state ? buildInvitationChoices(state.view, state.media) : [];
	const scope = await menu<'overview' | 'slug' | 'back'>({
		title: 'JSON for',
		items: [
			{ value: 'overview', label: 'Status overview' },
			{
				value: 'slug',
				label: 'One invitation…',
				disabled: choices.length === 0 ? 'load the overview first' : false,
			},
			{ value: 'back', label: 'Back' },
		],
		initial: 'overview',
	});
	if (scope === 'back') return;
	if (scope === 'overview') {
		await runGeneralView({ json: true, ...options });
		return;
	}
	const selection = await searchOne({
		title: 'Invitation',
		items: choices.map((choice) => ({ value: choice.slug, label: choice.label })),
	});
	if (selection === 'back') return;
	await runInvitationView(selection, { json: true, ...options });
}

export async function runDbsInteractive(): Promise<void> {
	await runInteractive(async () => {
		const t = theme();
		printLine(t.header('dbs', [t.dim('read-only environment status')]));
		const options: ViewOptions = { verbose: false, includeInSync: false, diagnostics: false };
		const menuState: DbsMenuState = { loaded: false, pendingCount: 0, lastAction: null };
		let state: InteractiveState | null = null;

		const ensureLoaded = async (): Promise<InteractiveState> => {
			if (state) return state;
			const loaded = await step('Probing environments', () => loadState(options), {
				done: () => 'Evidence loaded',
			});
			state = loaded;
			menuState.loaded = true;
			menuState.pendingCount = buildInvitationChoices(loaded.view, loaded.media).length;
			printLine(environmentLine(loaded.view));
			return loaded;
		};

		let action: DbsMenuAction = 'menu';
		for (;;) {
			if (action === 'menu') {
				const root = dbsRootMenu(menuState);
				action = await menu({
					title: 'What do you want to see?',
					items: root.items,
					initial: root.initial,
				});
			}
			if (action === 'exit') return;

			if (action === 'overview') {
				const loaded = await ensureLoaded();
				await showOverview(loaded, options);
				printLine(healthSummary(loaded, menuState.pendingCount));
			} else if (action === 'invitation') {
				const loaded = await ensureLoaded();
				const shown = await showInvitation(loaded);
				if (!shown) {
					action = 'menu';
					continue;
				}
			} else if (action === 'compact') {
				await runCompact(options);
			} else if (action === 'options') {
				const { targetsChanged } = await editOptions(options);
				if (targetsChanged) {
					state = null;
					menuState.loaded = false;
				}
				action = 'menu';
				continue;
			} else if (action === 'json') {
				await printJson(options, state);
			} else if (action === 'refresh') {
				state = null;
				await ensureLoaded();
				action = 'menu';
				continue;
			}

			menuState.lastAction = action;
			const next = dbsNextStep(menuState);
			printLine();
			action = await menu({ title: 'Next step', items: next.items, initial: next.initial });
		}
	});
}
