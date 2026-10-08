/**
 * Read-only dbs views shared by the flag-driven CLI and the interactive menu.
 * Every function probes fresh evidence and prints; none writes to any database.
 */
import { statusScopeJson } from './dbs-options.ts';
import type { TargetEnv } from './dbs-status.ts';
import {
	MANAGED_STATUS_DEFAULT_TIMEOUT_MS,
	runCompactManagedStatusSafe,
} from './managed-status.ts';
import {
	buildMediaOperationalPlan,
	formatMediaReferences,
	readMediaReferencesStatus,
} from './dbs-media-references.ts';
import {
	buildOperationalActionPlan,
	type OperationalActionPlan,
} from '../../src/lib/status/action-plan.ts';
import type { MediaReferencesStatus } from '../../src/lib/status/media-reference-types.ts';
import type { CanonicalStatusView } from '../../src/lib/status/types.ts';

export interface DbsViewOptions {
	json?: boolean;
	verbose?: boolean;
	includeInSync?: boolean;
	diagnostics?: boolean;
	targets?: TargetEnv[];
}

export interface DbsCompactOptions {
	json?: boolean;
	timeoutMs?: number;
	aggregateContent?: boolean;
	targets?: TargetEnv[];
	slug?: string;
}

export function readTimeoutMs(args: readonly string[]): number {
	const idx = args.indexOf('--timeout-ms');
	if (idx === -1) return MANAGED_STATUS_DEFAULT_TIMEOUT_MS;
	const raw = args[idx + 1];
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 500 || parsed > 60_000) {
		throw new Error('--timeout-ms must be a number between 500 and 60000.');
	}
	return Math.floor(parsed);
}

export interface DbsEvidence {
	view: CanonicalStatusView;
	media: MediaReferencesStatus;
	plan: OperationalActionPlan;
}

function reportRefineError(error: unknown): void {
	console.error(
		error instanceof Error
			? `Production preflight did not finish: ${error.message}`
			: 'Production preflight did not finish.',
	);
}

/**
 * Fast canonical view, promotion refine (falls back to the fast view on failure), media
 * references and the merged operational plan. Shared by the flag views and the menu.
 */
export async function loadDbsEvidence(
	options: Pick<DbsViewOptions, 'targets' | 'diagnostics'> & { slug?: string },
	onRefineError: (error: unknown) => void = reportRefineError,
): Promise<DbsEvidence> {
	const { buildCanonicalStatusView, refineCanonicalStatusViewPromotions } =
		await import('./canonical-status.ts');
	const { targets, slug } = options;
	const slugScope = slug ? { slugs: [slug] } : {};
	const fast = await buildCanonicalStatusView({
		...slugScope,
		diagnostics: options.diagnostics,
		environments: targets,
		includeProductionPreflight: false,
	});
	const refine = async (): Promise<CanonicalStatusView> => {
		try {
			return await refineCanonicalStatusViewPromotions(fast, {
				...slugScope,
				resetSession: false,
			});
		} catch (error) {
			onRefineError(error);
			return fast;
		}
	};
	// Media inventories do not depend on the promotion refine; read them concurrently.
	const [view, media] = await Promise.all([
		refine(),
		readMediaReferencesStatus(slug ? { targets, slug } : { targets }),
	]);
	return {
		view,
		media,
		plan: buildMediaOperationalPlan(buildOperationalActionPlan(view), media),
	};
}

export async function runGeneralView(options: DbsViewOptions = {}): Promise<void> {
	const { formatCanonicalStatusView } = await import('./canonical-status-format.ts');
	const targets = options.targets;
	const { view, media: mediaReferences, plan: operationalPlan } = await loadDbsEvidence(options);
	if (options.json) {
		const { DbsStatusJsonSchema } = await import('../../src/lib/status/dbs-json.ts');
		const excludedTargets = targets
			? (['local', 'preview', 'production'] as const).filter((env) => !targets.includes(env))
			: undefined;
		const payload = DbsStatusJsonSchema.parse({
			...view,
			mediaReferences,
			operationalPlan,
			...(excludedTargets ? { excludedTargets } : {}),
		});
		console.log(statusScopeJson(payload, targets));
		return;
	}
	process.stdout.write(
		formatCanonicalStatusView(view, {
			verbose: options.verbose,
			includeInSync: options.includeInSync,
			diagnostics: options.diagnostics,
			operationalPlan,
		}) +
			`Estado operativo: ${operationalPlan.health.status}\n` +
			formatMediaReferences(mediaReferences, { verbose: options.verbose }),
	);
}

export async function runInvitationView(slug: string, options: DbsViewOptions = {}): Promise<void> {
	const { formatSlugStatusView } = await import('./canonical-status-format.ts');
	const targets = options.targets;
	const {
		view,
		media: mediaReferences,
		plan: operationalPlan,
	} = await loadDbsEvidence({ ...options, slug });
	if (options.json) {
		const promotion = view.promotions.find((row) => row.slug === slug) ?? null;
		console.log(
			statusScopeJson(
				{
					slug,
					selectedTargets: targets,
					inSync: view.inSyncSlugs.includes(slug),
					promotion,
					mediaReferences,
					operationalPlan,
					environments: view.environments,
					evidence: view.evidence,
				},
				targets,
			),
		);
		return;
	}
	process.stdout.write(
		formatSlugStatusView(view, slug, { verbose: options.verbose }) +
			`Estado operativo: ${operationalPlan.health.status}\n` +
			formatMediaReferences(mediaReferences, { verbose: options.verbose, slug }),
	);
}

export async function runCompactView(options: DbsCompactOptions = {}): Promise<void> {
	const result = await runCompactManagedStatusSafe({
		slug: options.slug,
		timeoutMs: options.timeoutMs ?? MANAGED_STATUS_DEFAULT_TIMEOUT_MS,
		aggregateContent: options.aggregateContent ?? false,
		environments: options.targets,
	});
	if (options.json) {
		if (!result.ok) {
			console.log(
				JSON.stringify(
					{
						ok: false,
						error: result.text.trim(),
						readOnly: true,
						mediaReferences: 'NOT_EVALUATED',
					},
					null,
					2,
				),
			);
			process.exit(0);
		}
		console.log(
			statusScopeJson(
				{ ...result.status, mediaReferences: 'NOT_EVALUATED' },
				options.targets,
			),
		);
		return;
	}
	process.stdout.write(result.text + '\nImágenes publicadas: no evaluadas en --compact.\n');
	if (!result.ok) {
		process.exit(0);
	}
}
