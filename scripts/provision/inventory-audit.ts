/**
 * inventory-audit.ts — Versioned Read-Only Environment Inventory Parity & Classification Engine.
 *
 * Compares repository registries (managed canonical + local render corpus) against
 * Local, Preview, and Production databases by stable invitation slug.
 */
import { listInvitationDefinitions } from './invitations/registry.ts';
import type { InvitationDefinition } from './invitations/invitation-definition.ts';
import { listLocalRenderCorpus } from './local-render-corpus/registry.ts';
import type { LocalRenderCorpusEntry } from './local-render-corpus/registry.ts';
import { resolveDbUrlForEnv, type TargetEnv } from './dbs-status.ts';
import {
	readGroupedPromotionalEvidence,
	StatusProbeSession,
	type LiveInvitationEvidenceRow,
} from '../status-core/index.ts';
import { isVerifiedManagedReleaseProvenance } from './managed-merge-baseline.ts';
import { discoverStaticDemos } from '../screenshot/discovery.ts';

export type InventoryCategory =
	'canonical_published' | 'canonical_in_progress' | 'demo' | 'preview_e2e_fixture' | 'unmanaged';

export interface DatabaseRowState {
	present: boolean;
	kind: string | null;
	eventType: string | null;
	themeId: string | null;
	clientName: string | null;
	hasProvenance: boolean;
	provenanceSlug: string | null;
	packageHash: string | null;
}

export interface InventoryAuditRow {
	slug: string;
	category: InventoryCategory;
	repoLifecycle: 'published' | 'in_progress' | 'unmanaged';
	inRepoRegistry: boolean;
	inLocalCorpus: boolean;
	deliveryState: 'ALIGNED' | 'IN_PROGRESS' | 'UNVERIFIED' | 'NOT_APPLICABLE';
	environments: Record<TargetEnv, DatabaseRowState>;
	notes: string;
}

export interface EnvironmentInventorySummary {
	environment: TargetEnv;
	configured: boolean;
	reachable: boolean;
	totalActiveRows: number;
	categoryCounts: Record<InventoryCategory, number>;
}

export interface InventoryAuditResult {
	generatedAt: string;
	summary: {
		repoCanonicalCount: number;
		repoCanonicalPublishedCount: number;
		repoCanonicalInProgressCount: number;
		localRenderCorpusCount: number;
		observedScopeCount: number;
		environments: Record<TargetEnv, EnvironmentInventorySummary>;
	};
	rows: InventoryAuditRow[];
}

const ENVIRONMENTS: readonly TargetEnv[] = ['local', 'preview', 'production'];

const PREVIEW_E2E_FIXTURE_SLUG = 'e2e-preview-publication';

function emptyDbRowState(): DatabaseRowState {
	return {
		present: false,
		kind: null,
		eventType: null,
		themeId: null,
		clientName: null,
		hasProvenance: false,
		provenanceSlug: null,
		packageHash: null,
	};
}

export function classifySlugCategory(
	slug: string,
	inRegistry: boolean,
	repoLifecycle?: 'published' | 'in_progress',
	inCorpus?: boolean,
	dbKind?: string | null,
): InventoryCategory {
	// Precedence: registry lifecycle > well-known fixture slugs > demo prefix > unmanaged.
	// The render corpus is derived from the registry and never creates a separate category.
	if (inRegistry) {
		return repoLifecycle === 'in_progress' ? 'canonical_in_progress' : 'canonical_published';
	}
	if (inCorpus) {
		return 'unmanaged';
	}
	if (slug === PREVIEW_E2E_FIXTURE_SLUG) {
		return 'preview_e2e_fixture';
	}
	if (dbKind === 'demo' || slug.startsWith('demo-')) {
		return 'demo';
	}
	return 'unmanaged';
}

function determineRowDeliveryAndNotes(
	category: InventoryCategory,
	prodState: DatabaseRowState,
): { deliveryState: InventoryAuditRow['deliveryState']; notes: string } {
	if (category === 'canonical_in_progress') {
		return {
			deliveryState: 'IN_PROGRESS',
			notes: 'Active delivery in progress. Present in code/local; pending promotion to preview & production.',
		};
	}
	if (category === 'canonical_published') {
		if (!prodState.present) {
			return {
				deliveryState: 'UNVERIFIED',
				notes: 'Published canonical invitation missing from production DB.',
			};
		}
		if (!prodState.hasProvenance) {
			return {
				deliveryState: 'UNVERIFIED',
				notes: 'Governance/provenance pending: published in production DB without verified Phase 2 release provenance record.',
			};
		}
		return {
			deliveryState: 'ALIGNED',
			notes: 'Published canonical invitation fully aligned.',
		};
	}
	if (category === 'demo') {
		return { deliveryState: 'NOT_APPLICABLE', notes: 'Unmanaged demo invitation fixture.' };
	}
	if (category === 'preview_e2e_fixture') {
		return {
			deliveryState: 'NOT_APPLICABLE',
			notes: 'Intentional Preview E2E publication test fixture (owned by preview@preview.com).',
		};
	}
	return { deliveryState: 'NOT_APPLICABLE', notes: 'Unmanaged database row.' };
}

function buildParityRow(
	slug: string,
	canonicalMap: Map<string, InvitationDefinition>,
	corpusMap: Map<string, LocalRenderCorpusEntry>,
	dbRowsByEnv: Map<TargetEnv, Map<string, DatabaseRowState>>,
	envSummaries: Record<TargetEnv, EnvironmentInventorySummary>,
): InventoryAuditRow {
	const canonicalDef = canonicalMap.get(slug);
	const corpusEntry = corpusMap.get(slug);
	const localState = dbRowsByEnv.get('local')?.get(slug) ?? emptyDbRowState();
	const previewState = dbRowsByEnv.get('preview')?.get(slug) ?? emptyDbRowState();
	const prodState = dbRowsByEnv.get('production')?.get(slug) ?? emptyDbRowState();

	const dbKind = localState.kind || previewState.kind || prodState.kind;

	const category = classifySlugCategory(
		slug,
		Boolean(canonicalDef),
		canonicalDef?.lifecycle,
		Boolean(corpusEntry),
		dbKind,
	);

	for (const env of ENVIRONMENTS) {
		const state = env === 'local' ? localState : env === 'preview' ? previewState : prodState;
		if (state.present) {
			envSummaries[env].categoryCounts[category] += 1;
		}
	}

	const { deliveryState, notes } = determineRowDeliveryAndNotes(category, prodState);

	return {
		slug,
		category,
		repoLifecycle: canonicalDef?.lifecycle ?? 'unmanaged',
		inRepoRegistry: Boolean(canonicalDef),
		inLocalCorpus: Boolean(corpusEntry),
		deliveryState,
		environments: {
			local: localState,
			preview: previewState,
			production: prodState,
		},
		notes,
	};
}

function rowHasVerifiedProvenance(row: LiveInvitationEvidenceRow): boolean {
	return isVerifiedManagedReleaseProvenance({
		managedProjection: row.managedProjection,
		hasManagedProjection: row.hasManagedProjection,
		releaseSchemaVersion: row.releaseSchemaVersion,
		appliedDraftUpdatedAt: row.appliedDraftUpdatedAt,
		appliedOperationId: row.appliedOperationId,
		appliedPublishedVersion: row.appliedPublishedVersion,
		appliedPublishedProjectionHash: row.appliedPublishedProjectionHash,
		appliedReceipt: row.appliedReceipt,
		latestMutationReceipt: row.latestReceipt,
	});
}

async function collectDatabaseRowStates(
	querySlugs: string[],
	timeoutMs: number,
): Promise<{
	dbRowsByEnv: Map<TargetEnv, Map<string, DatabaseRowState>>;
	envSummaries: Record<TargetEnv, EnvironmentInventorySummary>;
}> {
	const session = new StatusProbeSession({ timeoutMs, readOnly: true });
	const dbRowsByEnv = new Map<TargetEnv, Map<string, DatabaseRowState>>();

	const envSummaries: Record<TargetEnv, EnvironmentInventorySummary> = {
		local: {
			environment: 'local',
			configured: false,
			reachable: false,
			totalActiveRows: 0,
			categoryCounts: emptyCategoryCounts(),
		},
		preview: {
			environment: 'preview',
			configured: false,
			reachable: false,
			totalActiveRows: 0,
			categoryCounts: emptyCategoryCounts(),
		},
		production: {
			environment: 'production',
			configured: false,
			reachable: false,
			totalActiveRows: 0,
			categoryCounts: emptyCategoryCounts(),
		},
	};

	for (const env of ENVIRONMENTS) {
		const envMap = new Map<string, DatabaseRowState>();
		dbRowsByEnv.set(env, envMap);

		const { dbUrl } = resolveDbUrlForEnv(env);
		if (!dbUrl) continue;
		envSummaries[env].configured = true;

		const evidence = await readGroupedPromotionalEvidence(session, dbUrl, querySlugs);
		if (!evidence.ok) continue;
		envSummaries[env].reachable = true;
		envSummaries[env].totalActiveRows = evidence.activeInvitationRows;

		for (const row of evidence.rows) {
			envMap.set(row.slug, {
				present: true,
				kind: row.kind,
				eventType: row.eventType,
				themeId: row.themeId,
				clientName: row.clientName,
				hasProvenance: rowHasVerifiedProvenance(row),
				provenanceSlug: row.definitionSlug,
				packageHash: row.packageHash,
			});
		}
	}

	return { dbRowsByEnv, envSummaries };
}

export async function runInventoryAudit(options?: {
	timeoutMs?: number;
}): Promise<InventoryAuditResult> {
	const timeoutMs = options?.timeoutMs ?? 15_000;
	const generatedAt = new Date().toISOString();

	// 1. Gather Repository Registries
	const canonicalDefs = listInvitationDefinitions();
	const canonicalMap = new Map(canonicalDefs.map((def) => [def.slug, def]));
	const corpusEntries = listLocalRenderCorpus();
	const corpusMap = new Map(corpusEntries.map((entry) => [entry.slug, entry]));
	const demoSlugs = discoverStaticDemos().map((demo) => demo.slug);

	// Gather union of all observed and expected slugs
	const registeredSlugs = new Set([
		...canonicalMap.keys(),
		...corpusMap.keys(),
		PREVIEW_E2E_FIXTURE_SLUG,
		...demoSlugs,
	]);

	const querySlugs = Array.from(registeredSlugs);

	// 2. Query Databases via the shared promotional-evidence collector
	const { dbRowsByEnv, envSummaries } = await collectDatabaseRowStates(querySlugs, timeoutMs);

	// 3. Consolidate All Unique Slugs Across Registries and DBs
	const allSlugsSet = new Set<string>([
		...canonicalMap.keys(),
		...corpusMap.keys(),
		...demoSlugs,
		...Array.from(dbRowsByEnv.get('local')?.keys() ?? []),
		...Array.from(dbRowsByEnv.get('preview')?.keys() ?? []),
		...Array.from(dbRowsByEnv.get('production')?.keys() ?? []),
	]);

	const sortedSlugs = Array.from(allSlugsSet).sort();

	// 4. Build Detailed Per-Slug Parity Rows
	const rows: InventoryAuditRow[] = [];

	for (const slug of sortedSlugs) {
		rows.push(buildParityRow(slug, canonicalMap, corpusMap, dbRowsByEnv, envSummaries));
	}

	const observedSlugs = new Set([...canonicalMap.keys(), ...corpusMap.keys()]);

	return {
		generatedAt,
		summary: {
			repoCanonicalCount: canonicalDefs.length,
			repoCanonicalPublishedCount: canonicalDefs.filter((d) => d.lifecycle === 'published')
				.length,
			repoCanonicalInProgressCount: canonicalDefs.filter((d) => d.lifecycle === 'in_progress')
				.length,
			localRenderCorpusCount: corpusEntries.length,
			observedScopeCount: observedSlugs.size,
			environments: envSummaries,
		},
		rows,
	};
}

function emptyCategoryCounts(): Record<InventoryCategory, number> {
	return {
		canonical_published: 0,
		canonical_in_progress: 0,
		demo: 0,
		preview_e2e_fixture: 0,
		unmanaged: 0,
	};
}
