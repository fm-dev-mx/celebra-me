/**
 * Session plumbing for the invitation:release menu: invitation picker, header, root labels,
 * status report, provenance diagnosis, Tools and Options submenus. No writes happen here
 * except the explicit provenance reconcile delegated through `deps`.
 */
import {
	askText,
	confirmAction,
	isPromptExit,
	menu,
	printLine,
	searchOne,
	step,
	theme,
} from '../../lib/cli-prompts.ts';
import type { TargetEnv } from '../../../src/lib/status/types.ts';
import { parseAssetPolicy, type AssetPolicy } from '../asset-reconciliation.ts';
import {
	defaultDestinationFromPromotionAction,
	describeDestination,
} from '../invitation-release-destination.ts';
import type { ReleaseMenuAction, ReleaseMenuState } from '../invitation-release-menu-model.ts';
import { formatPreviewReceiptDiagnosis, printStatusReport } from '../invitation-release-status.ts';
import type { ReleaseWizardSession } from '../invitation-release-wizard.ts';
import { listInvitationDefinitions } from '../invitations/registry.ts';
import { inspectPreviewProvenanceReceipt } from '../preview-provenance-receipt-service.ts';
import type { UpdateScope } from '../semantic-delta.ts';

export interface SessionOverrides {
	updateScope?: UpdateScope;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	sourceDir?: string;
	packageFile?: string;
	allowStalePackage?: boolean;
	rekeyFrom?: string;
	ownerUserId?: string;
	verbose?: boolean;
}

export interface SessionDeps {
	buildSession: (slug: string, overrides: SessionOverrides) => Promise<ReleaseWizardSession>;
	reconcileStaleProvenance: (session: ReleaseWizardSession) => Promise<boolean>;
}

/** Operator-chosen overrides only, so a rebuild re-derives scope/policy from the definition. */
function overridesOf(session: ReleaseWizardSession): SessionOverrides {
	return { ...session.overrides };
}

export function describePackage(session: ReleaseWizardSession): string {
	return `Package ${session.packageHash.slice(0, 8)} · ${session.updateScope} · ${session.assetPolicy}`;
}

export async function chooseSlug(): Promise<string | null> {
	const definitions = listInvitationDefinitions().sort((a, b) =>
		b.createdAt.localeCompare(a.createdAt),
	);
	const selection = await searchOne<string, 'exit'>({
		title: 'Invitation (type to filter; newest first)',
		items: definitions.map((definition) => ({
			value: definition.slug,
			label: `${definition.slug}  ${theme().dim(definition.title)}`,
			keywords: definition.title,
		})),
		backValue: 'exit',
		backLabel: 'Exit',
	});
	return selection === 'exit' ? null : selection;
}

function environmentStateLabel(state: string): { kind: 'ok' | 'warn' | 'pending'; label: string } {
	switch (state) {
		case 'match':
			return { kind: 'ok', label: 'in sync' };
		case 'behind':
			return { kind: 'pending', label: 'update pending' };
		case 'absent':
			return { kind: 'pending', label: 'not released' };
		case 'unknown':
		case 'conflict':
			return { kind: 'warn', label: state };
		default:
			return { kind: 'pending', label: state };
	}
}

export function environmentStateLine(environments?: Record<TargetEnv, string>): string {
	const t = theme();
	if (!environments) return t.mark('warn', 'publication state unverified');
	return (['local', 'preview', 'production'] as const)
		.map((env) => {
			const { kind, label } = environmentStateLabel(environments[env]);
			return `${t.env(env)} ${t.mark(kind, label)}`;
		})
		.join(`  ${t.dim(t.symbol('bullet'))}  `);
}

export function printSessionHeader(session: ReleaseWizardSession, state: ReleaseMenuState): void {
	const t = theme();
	printLine();
	printLine(
		t.header('invitation:release', [
			t.bold(session.slug),
			`pkg ${session.packageHash.slice(0, 8)}`,
			session.updateScope,
			t.dim(session.assetPolicy),
		]),
	);
	printLine(
		state.productionReady
			? t.mark('ok', 'Preview approved for this package; Production apply is prod:apply')
			: state.hasPendingPreviewApproval
				? t.mark('pending', 'Preview approval pending (live checklist)')
				: t.dim('Production needs an exact Preview approval'),
	);
}

export function rootItems(
	order: ReleaseMenuAction[],
	state: ReleaseMenuState,
): Array<{ value: ReleaseMenuAction; label: string; hint?: string }> {
	// Soft default from the same publication SSOT as pnpm dbs.
	const recommended = defaultDestinationFromPromotionAction(state.promotionAction);
	const labels: Record<ReleaseMenuAction, { label: string; hint?: string }> = {
		local: { label: describeDestination('local'), hint: 'Plan, confirm and apply to Local' },
		prepare_preview: {
			label: describeDestination('prepare_preview'),
			hint: 'Local + Preview apply, live checklist, approval',
		},
		approve_preview: {
			label: 'Approve Preview (live checklist)',
			hint: 'Verify the pending Preview release and record the approval',
		},
		production: {
			label: describeDestination('production'),
			hint: state.productionReady
				? 'Read-only preflight; apply is pnpm prod:apply'
				: 'Requires an exact Preview approval',
		},
		status: { label: 'Status (local inventory)', hint: 'invitation:release --status' },
		tools: {
			label: 'Tools…',
			hint: 'Refresh package, Preview provenance, options (scope, policy, source)',
		},
		change: { label: 'Change invitation' },
		menu: { label: 'Back to menu' },
		exit: { label: 'Exit' },
	};
	return order.map((value) => ({
		value,
		...labels[value],
		...(value === recommended
			? { hint: `${labels[value].hint ?? ''} · recommended by dbs`.trim() }
			: {}),
	}));
}

export async function runStatus(session: ReleaseWizardSession): Promise<void> {
	await printStatusReport({ slug: session.slug, targets: ['local'], json: false });
}

async function runProvenanceDiagnosis(session: ReleaseWizardSession): Promise<void> {
	if (!session.packagePath) return;
	const result = await step('Inspecting Preview receipts (read-only)', () =>
		inspectPreviewProvenanceReceipt({ packagePath: session.packagePath! }),
	);
	console.log(formatPreviewReceiptDiagnosis(result));
}

type OptionChoice =
	'scope' | 'policy' | 'prune' | 'source' | 'rekey' | 'owner' | 'verbose' | 'back';

function describeSource(session: ReleaseWizardSession): string {
	if (session.packageFile) return `file ${session.packageFile}`;
	if (session.sourceDir) return `dir ${session.sourceDir}`;
	return 'definition (auto-export)';
}

async function askOptionChoice(current: ReleaseWizardSession): Promise<OptionChoice> {
	return menu<OptionChoice>({
		title: 'Options (same meaning as the CLI flags)',
		items: [
			{
				value: 'scope',
				label: `Update scope: ${current.updateScope}`,
				hint: '--update-scope',
			},
			{
				value: 'policy',
				label: `Asset policy: ${current.assetPolicy}`,
				hint: '--asset-policy',
			},
			{
				value: 'prune',
				label: `Prune unreferenced assets: ${current.pruneAssets ? 'yes' : 'no'}`,
				hint: '--prune-assets / --no-prune-assets',
			},
			{
				value: 'source',
				label: `Package source: ${describeSource(current)}`,
				hint: '--source-dir / --package / --allow-stale-package',
			},
			{
				value: 'rekey',
				label: `Rekey from: ${current.rekeyFrom ?? 'none'}`,
				hint: '--rekey-from (Local/Preview only)',
			},
			{
				value: 'owner',
				label: `Owner user id: ${current.ownerUserId ?? 'default host'}`,
				hint: '--owner-user-id',
			},
			{
				value: 'verbose',
				label: `Verbose output: ${current.verbose ? 'on' : 'off'}`,
				hint: '--verbose',
			},
			{ value: 'back', label: 'Back' },
		],
		initial: 'back',
	});
}

async function askScope(current: ReleaseWizardSession, overrides: SessionOverrides): Promise<void> {
	overrides.updateScope = await menu<UpdateScope>({
		title: 'Update scope',
		items: [
			{ value: 'content-and-assets', label: 'content-and-assets' },
			{ value: 'content-only', label: 'content-only' },
			{ value: 'assets-only', label: 'assets-only' },
		],
		initial: current.updateScope,
	});
	overrides.assetPolicy = undefined;
	overrides.pruneAssets = undefined;
}

async function askPolicy(
	current: ReleaseWizardSession,
	overrides: SessionOverrides,
): Promise<void> {
	overrides.assetPolicy = parseAssetPolicy(
		await menu<'verify' | 'missing' | 'sync' | 'preserve'>({
			title: 'Asset policy',
			items: [
				{ value: 'missing', label: 'missing (upload missing assets)' },
				{ value: 'verify', label: 'verify (fail on missing assets)' },
				{ value: 'sync', label: 'sync (upload and replace)' },
				{ value: 'preserve', label: 'preserve (content-only)' },
			],
			initial: current.assetPolicy,
		}),
	);
}

/** Returns false when the operator backed out without changing the source. */
async function askSource(overrides: SessionOverrides): Promise<boolean> {
	const source = await menu<'definition' | 'dir' | 'file' | 'back'>({
		title: 'Package source',
		items: [
			{ value: 'definition', label: 'Managed definition (auto-export)' },
			{ value: 'dir', label: 'Source assets directory…' },
			{ value: 'file', label: 'Immutable package file…' },
			{ value: 'back', label: 'Back' },
		],
		initial: 'definition',
	});
	if (source === 'back') return false;
	overrides.sourceDir = undefined;
	overrides.packageFile = undefined;
	overrides.allowStalePackage = undefined;
	if (source === 'dir') {
		overrides.sourceDir = await askText({ title: 'Source directory', required: true });
	} else if (source === 'file') {
		overrides.packageFile = await askText({ title: 'Package file path', required: true });
		overrides.allowStalePackage = await confirmAction({
			question: 'Allow a stale package (sourceHash differs from the definition)?',
			initial: false,
		});
	}
	return true;
}

async function applyOptionChoice(
	choice: Exclude<OptionChoice, 'back'>,
	current: ReleaseWizardSession,
	overrides: SessionOverrides,
): Promise<boolean> {
	switch (choice) {
		case 'scope':
			await askScope(current, overrides);
			return true;
		case 'policy':
			await askPolicy(current, overrides);
			return true;
		case 'prune':
			overrides.pruneAssets = await confirmAction({
				question: `${theme().red('Remove unreferenced managed assets')} during apply?`,
				initial: false,
			});
			return true;
		case 'source':
			return askSource(overrides);
		case 'rekey': {
			const value = await askText({
				title: 'Previous slug (Enter to clear)',
				initial: current.rekeyFrom,
			});
			overrides.rekeyFrom = value || undefined;
			return true;
		}
		case 'owner': {
			const value = await askText({
				title: 'Owner user id (Enter to clear)',
				initial: current.ownerUserId,
			});
			overrides.ownerUserId = value || undefined;
			return true;
		}
		case 'verbose':
			overrides.verbose = !current.verbose;
			return true;
	}
}

async function runOptions(
	session: ReleaseWizardSession,
	deps: SessionDeps,
): Promise<ReleaseWizardSession> {
	let current = session;
	for (;;) {
		const choice = await askOptionChoice(current);
		if (choice === 'back') return current;
		const overrides = overridesOf(current);
		const changed = await applyOptionChoice(choice, current, overrides);
		if (!changed) continue;
		try {
			current = await step(
				'Rebuilding package',
				() => deps.buildSession(current.slug, overrides),
				{
					done: describePackage,
				},
			);
		} catch (error) {
			if (isPromptExit(error)) throw error;
			printLine(theme().mark('fail', error instanceof Error ? error.message : String(error)));
		}
	}
}

export async function runTools(
	session: ReleaseWizardSession,
	deps: SessionDeps,
): Promise<ReleaseWizardSession> {
	const choice = await menu<'refresh' | 'diagnose' | 'reconcile' | 'options' | 'back'>({
		title: 'Tools',
		items: [
			{
				value: 'refresh',
				label: 'Refresh package from definition',
				hint: 'Re-export after editing the definition',
			},
			{
				value: 'diagnose',
				label: 'Preview provenance: diagnose receipts',
				hint: 'Read-only (--preview-provenance --diagnose-receipt)',
			},
			{
				value: 'reconcile',
				label: 'Preview provenance: reconcile stale baseline',
				hint: 'Metadata-only Preview write after typed YES (--reconcile-stale)',
				danger: true,
			},
			{
				value: 'options',
				label: 'Options…',
				hint: 'Scope, asset policy, prune, source, rekey, verbose',
			},
			{ value: 'back', label: 'Back' },
		],
		initial: 'refresh',
	});
	switch (choice) {
		case 'refresh':
			return step(
				'Refreshing package',
				() => deps.buildSession(session.slug, overridesOf(session)),
				{
					done: describePackage,
				},
			);
		case 'diagnose':
			await runProvenanceDiagnosis(session);
			return session;
		case 'reconcile':
			await deps.reconcileStaleProvenance(session);
			return session;
		case 'options':
			return runOptions(session, deps);
		default:
			return session;
	}
}
