/**
 * Read-only managed promotion status for pnpm dbs and the canonical status view.
 * Composes fingerprint + grouped evidence + pure decision + presentation. No apply policy.
 */
import {
	mapPool,
	readGroupedPromotionalEvidence,
	type LiveInvitationEvidenceRow,
	type StatusProbeSession,
} from '../status-core/index.ts';
import { getOrCreateStatusProbeSession, resolveDbUrlForEnv, type TargetEnv } from './dbs-status.ts';
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';
import type { InvitationDefinition } from './invitations/invitation-definition.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import { runPromotionPreflight, type PromotionPreflightReport } from './invitation-promote.ts';
import { resolvePromotionUpdateScope } from './invitation-update-options.ts';
import {
	buildCanonicalPromotionalFingerprint,
	classifyLiveInvitation,
	type EnvironmentPromotionState,
} from './promotional-fingerprint.ts';
import { decidePromotionAction } from '../../src/lib/status/decision.ts';
import { presentPromotionRow } from '../../src/lib/status/presentation.ts';
import type { CanonicalPromotionRow, EvidenceState } from '../../src/lib/status/types.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];
const PRODUCTION_PREFLIGHT_CONCURRENCY = 2;
const PRODUCTION_PREFLIGHT_TIMEOUT_MS = 120_000;

export interface ManagedPromotionStatus {
	promotions: CanonicalPromotionRow[];
	inSyncSlugs: string[];
	environmentsBySlug: Record<string, Record<TargetEnv, EnvironmentPromotionState>>;
	envEvidence: Record<TargetEnv, EvidenceState>;
	canonicalAvailableBySlug: Record<string, boolean>;
	rowsByEnv: Record<TargetEnv, LiveInvitationEvidenceRow[]>;
}

interface ManagedPromotionStatusOptions {
	session?: StatusProbeSession;
	definitions?: InvitationDefinition[];
	slugs?: readonly string[];
	environments?: readonly TargetEnv[];
	diagnostics?: boolean;
	resolvePackage?: (slug: string) => Promise<InvitationPackageData>;
	runProductionPreflight?: (
		packageData: InvitationPackageData,
	) => Promise<PromotionPreflightReport>;
	productionPreflightTimeoutMs?: number;
}

type CanonicalPromotionFingerprint = { fingerprint: string; assetKeys: readonly string[] };

async function buildCanonicalFingerprints(
	definitions: readonly InvitationDefinition[],
): Promise<Map<string, CanonicalPromotionFingerprint>> {
	const canonicalBySlug = new Map<string, CanonicalPromotionFingerprint>();
	await Promise.all(
		definitions.map(async (definition) => {
			const canonical = await buildCanonicalPromotionalFingerprint(definition);
			if (canonical.ok) {
				canonicalBySlug.set(definition.slug, {
					fingerprint: canonical.fingerprint,
					assetKeys: canonical.assetKeys,
				});
			}
		}),
	);
	return canonicalBySlug;
}

async function probeManagedPromotionEnvironment(input: {
	env: TargetEnv;
	session: StatusProbeSession;
	definitions: readonly InvitationDefinition[];
	slugs: readonly string[];
	canonicalBySlug: ReadonlyMap<string, CanonicalPromotionFingerprint>;
	diagnostics: boolean;
}): Promise<{
	states: Map<string, EnvironmentPromotionState>;
	evidence: EvidenceState;
	rows: LiveInvitationEvidenceRow[];
}> {
	const states = new Map<string, EnvironmentPromotionState>();
	const markUnknown = () => {
		for (const slug of input.slugs) states.set(slug, 'unknown');
	};
	const { dbUrl } = resolveDbUrlForEnv(input.env);
	if (!dbUrl || !(await input.session.probeConnectivity(dbUrl))) {
		markUnknown();
		return { states, evidence: 'UNVERIFIED', rows: [] };
	}
	const evidence = await readGroupedPromotionalEvidence(input.session, dbUrl, input.slugs, {
		diagnostics: input.diagnostics,
	});
	if (!evidence.ok) {
		markUnknown();
		return { states, evidence: 'UNVERIFIED', rows: [] };
	}
	for (const definition of input.definitions) {
		const canonical = input.canonicalBySlug.get(definition.slug);
		if (!canonical) {
			states.set(definition.slug, 'unknown');
			continue;
		}
		states.set(
			definition.slug,
			classifyLiveInvitation({
				canonicalFingerprint: canonical.fingerprint,
				canonicalAssetKeys: canonical.assetKeys,
				expectedSlug: definition.slug,
				expectedManagedIdentityId: definition.managedIdentityId,
				rows: evidence.rows.filter((row) => row.slug === definition.slug),
			}),
		);
	}
	return { states, evidence: 'LIVE', rows: evidence.rows };
}

export function formatSlugPromotionLine(row: CanonicalPromotionRow | undefined): string {
	if (!row) return 'Publication: (none)';
	if (row.action === 'BLOCKED' || row.action === 'UNKNOWN') {
		return `Publication: ${row.action} (${row.reasonCode})`;
	}
	return `Publication: ${row.action}`;
}

function resolveManagedStatusInput(options: ManagedPromotionStatusOptions): {
	session: StatusProbeSession;
	definitions: InvitationDefinition[];
	probeEnvs: TargetEnv[];
	diagnostics: boolean;
} {
	const definitions = (options.definitions ?? listInvitationDefinitions()).filter((definition) =>
		options.slugs ? options.slugs.includes(definition.slug) : true,
	);
	return {
		session: options.session ?? getOrCreateStatusProbeSession(),
		definitions,
		probeEnvs: options.environments ? [...options.environments] : [...ENVS],
		diagnostics: Boolean(options.diagnostics),
	};
}

export async function evaluateManagedPromotionStatus(
	options: ManagedPromotionStatusOptions = {},
): Promise<ManagedPromotionStatus> {
	const { session, definitions, probeEnvs, diagnostics } = resolveManagedStatusInput(options);
	const slugs = definitions.map((definition) => definition.slug);

	const canonicalBySlug = await buildCanonicalFingerprints(definitions);

	const envStates = new Map<TargetEnv, Map<string, EnvironmentPromotionState>>();
	const envEvidence: Record<TargetEnv, EvidenceState> = {
		local: 'UNVERIFIED',
		preview: 'UNVERIFIED',
		production: 'UNVERIFIED',
	};
	const rowsByEnv: Record<TargetEnv, LiveInvitationEvidenceRow[]> = {
		local: [],
		preview: [],
		production: [],
	};

	await mapPool(probeEnvs, 3, async (env) => {
		const probe = await probeManagedPromotionEnvironment({
			env,
			session,
			definitions,
			slugs,
			canonicalBySlug,
			diagnostics,
		});
		envStates.set(env, probe.states);
		envEvidence[env] = probe.evidence;
		rowsByEnv[env] = probe.rows;
	});

	for (const env of ENVS) {
		if (envStates.has(env)) continue;
		const perSlug = new Map<string, EnvironmentPromotionState>();
		envStates.set(env, perSlug);
		for (const slug of slugs) perSlug.set(slug, 'unknown');
	}

	const environmentsBySlug: Record<string, Record<TargetEnv, EnvironmentPromotionState>> = {};
	const canonicalAvailableBySlug = new Map<string, boolean>();
	for (const definition of definitions) {
		canonicalAvailableBySlug.set(definition.slug, canonicalBySlug.has(definition.slug));
		environmentsBySlug[definition.slug] = {
			local: envStates.get('local')?.get(definition.slug) ?? 'unknown',
			preview: envStates.get('preview')?.get(definition.slug) ?? 'unknown',
			production: envStates.get('production')?.get(definition.slug) ?? 'unknown',
		};
	}
	const initiallyPresented = presentManagedPromotions({
		definitions,
		environmentsBySlug,
		envEvidence,
		canonicalAvailableBySlug,
	});
	const definitionBySlug = new Map(
		definitions.map((definition) => [definition.slug, definition]),
	);
	const presented = await refineManagedPromotionsWithProductionPreflight({
		...initiallyPresented,
		definitions,
		environmentsBySlug,
		envEvidence,
		resolvePackage:
			options.resolvePackage ??
			(async (slug) => (await resolveInvitationPackageInput({ slug })).packageData),
		runProductionPreflight:
			options.runProductionPreflight ??
			(async (packageData) =>
				await runPromotionPreflight({
					packageData,
					requireBackup: false,
					updateScope: resolvePromotionUpdateScope({
						deliveryScope: definitionBySlug.get(packageData.invitation.slug)
							?.deliveryScope,
					}),
					getProductionDbUrl: getProdDbUrl,
				})),
		timeoutMs: options.productionPreflightTimeoutMs ?? PRODUCTION_PREFLIGHT_TIMEOUT_MS,
	});
	return {
		promotions: presented.promotions,
		inSyncSlugs: presented.inSyncSlugs,
		environmentsBySlug,
		envEvidence,
		canonicalAvailableBySlug: Object.fromEntries(canonicalAvailableBySlug),
		rowsByEnv,
	};
}

async function withTimeout<T>(run: () => Promise<T>, timeoutMs: number): Promise<T> {
	let timer: NodeJS.Timeout | undefined;
	try {
		return await Promise.race([
			run(),
			new Promise<T>((_resolve, reject) => {
				timer = setTimeout(
					() => reject(new Error('PRODUCTION_PREFLIGHT_TIMEOUT')),
					timeoutMs,
				);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export async function refineManagedPromotionsWithProductionPreflight(input: {
	promotions: CanonicalPromotionRow[];
	inSyncSlugs: string[];
	definitions: readonly InvitationDefinition[];
	environmentsBySlug: Record<string, Record<TargetEnv, EnvironmentPromotionState>>;
	envEvidence: Record<TargetEnv, EvidenceState>;
	resolvePackage: (slug: string) => Promise<InvitationPackageData>;
	runProductionPreflight: (
		packageData: InvitationPackageData,
	) => Promise<PromotionPreflightReport>;
	timeoutMs: number;
}): Promise<Pick<ManagedPromotionStatus, 'promotions' | 'inSyncSlugs'>> {
	if (input.envEvidence.production !== 'LIVE') {
		return { promotions: input.promotions, inSyncSlugs: input.inSyncSlugs };
	}
	const candidates = input.promotions.filter(
		(row) =>
			row.environments.local === 'match' &&
			row.environments.preview === 'match' &&
			(row.environments.production === 'behind' || row.environments.production === 'unknown'),
	);
	if (candidates.length === 0) {
		return { promotions: input.promotions, inSyncSlugs: input.inSyncSlugs };
	}

	const reports = new Map<string, PromotionPreflightReport | Error>();
	await mapPool(candidates, PRODUCTION_PREFLIGHT_CONCURRENCY, async (row) => {
		try {
			const report = await withTimeout(async () => {
				const packageData = await input.resolvePackage(row.slug);
				return await input.runProductionPreflight(packageData);
			}, input.timeoutMs);
			reports.set(row.slug, report);
		} catch (error) {
			reports.set(row.slug, error instanceof Error ? error : new Error(String(error)));
		}
	});

	const definitions = new Map(
		input.definitions.map((definition) => [definition.slug, definition]),
	);
	const promotions: CanonicalPromotionRow[] = [];
	const inSync = new Set(input.inSyncSlugs);
	for (const row of input.promotions) {
		const report = reports.get(row.slug);
		if (!report) {
			promotions.push(row);
			continue;
		}
		if (!definitions.has(row.slug)) {
			promotions.push(row);
			continue;
		}
		const environments = input.environmentsBySlug[row.slug] ?? row.environments;
		if (report instanceof Error) {
			promotions.push(
				presentPromotionRow({
					slug: row.slug,
					title: row.title,
					eventType: row.eventType,
					action: 'UNKNOWN',
					reasonCode: 'PRODUCTION_PREFLIGHT_UNVERIFIED',
					environments,
					envEvidence: input.envEvidence,
				}),
			);
			continue;
		}
		if (report.status === 'IN_SYNC') {
			environments.production = 'match';
			inSync.add(row.slug);
			continue;
		}
		if (report.status === 'PROMOTABLE') {
			environments.production = 'behind';
			promotions.push(
				presentPromotionRow({
					slug: row.slug,
					title: row.title,
					eventType: row.eventType,
					action: 'PROMOTE_PRODUCTION',
					reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
					environments,
					envEvidence: input.envEvidence,
				}),
			);
			continue;
		}
		if (report.blockCode === 'MANAGED_DIVERGENCE') {
			environments.production = 'diverged';
			promotions.push(
				presentPromotionRow({
					slug: row.slug,
					title: row.title,
					eventType: row.eventType,
					action: 'BLOCKED',
					reasonCode: 'MANAGED_DIVERGENCE',
					environments,
					envEvidence: input.envEvidence,
				}),
			);
			continue;
		}
		if (report.blockCode === 'MISSING_PREVIEW_APPROVAL') {
			environments.production =
				environments.production === 'unknown' ? 'behind' : environments.production;
			promotions.push(
				presentPromotionRow({
					slug: row.slug,
					title: row.title,
					eventType: row.eventType,
					action: 'BLOCKED',
					reasonCode: 'PREVIEW_APPROVAL_REQUIRED',
					environments,
					envEvidence: input.envEvidence,
				}),
			);
			continue;
		}
		promotions.push(
			presentPromotionRow({
				slug: row.slug,
				title: row.title,
				eventType: row.eventType,
				action: 'BLOCKED',
				reasonCode: 'PRODUCTION_PREFLIGHT_BLOCKED',
				environments,
				envEvidence: input.envEvidence,
			}),
		);
	}
	return {
		promotions: promotions.sort((left, right) => left.slug.localeCompare(right.slug)),
		inSyncSlugs: [...inSync].sort((left, right) => left.localeCompare(right)),
	};
}

function presentManagedPromotions(input: {
	definitions: readonly InvitationDefinition[];
	environmentsBySlug: Record<string, Record<TargetEnv, EnvironmentPromotionState>>;
	envEvidence: Record<TargetEnv, EvidenceState>;
	canonicalAvailableBySlug: ReadonlyMap<string, boolean>;
}): Pick<ManagedPromotionStatus, 'promotions' | 'inSyncSlugs'> {
	const promotions: CanonicalPromotionRow[] = [];
	const inSyncSlugs: string[] = [];
	for (const definition of input.definitions) {
		const environments = input.environmentsBySlug[definition.slug] ?? {
			local: 'unknown',
			preview: 'unknown',
			production: 'unknown',
		};
		const decision = decidePromotionAction({
			canonicalAvailable: Boolean(input.canonicalAvailableBySlug.get(definition.slug)),
			local: environments.local,
			preview: environments.preview,
			production: environments.production,
		});
		if (decision.action === 'NONE') {
			inSyncSlugs.push(definition.slug);
			continue;
		}
		promotions.push(
			presentPromotionRow({
				slug: definition.slug,
				title: definition.title,
				eventType: definition.eventType,
				action: decision.action,
				reasonCode: decision.reasonCode,
				environments,
				envEvidence: input.envEvidence,
			}),
		);
	}
	promotions.sort((left, right) => left.slug.localeCompare(right.slug));
	inSyncSlugs.sort((left, right) => left.localeCompare(right));
	return { promotions, inSyncSlugs };
}
