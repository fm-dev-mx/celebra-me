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
	ObservabilityInvocationBudget,
	readEnvironmentDatabaseProjection,
} from '../observability/database-projection.ts';
import { isVerifiedManagedReleaseProvenance } from './managed-merge-baseline.ts';

export type InventoryCategory =
	| 'canonical_published'
	| 'canonical_in_progress'
	| 'legacy_corpus'
	| 'demo'
	| 'preview_e2e_fixture'
	| 'legacy_typo_alias'
	| 'unmanaged';

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
const LEGACY_TYPO_ALIAS_SLUG = 'alba-rosa-quinones';
const DEMO_SLUGS: readonly string[] = [
	'demo-baby-shower-celestial',
	'demo-bautismo-angelic-presence',
	'demo-boda-jewelry-box-wedding',
	'demo-cumple-luxury-hacienda',
	'demo-primera-comunion-illustrated',
	'demo-xv-celestial-blue',
	'demo-xv-editorial',
	'demo-xv-editorial-magazine',
	'demo-xv-editorial-rose',
	'demo-xv-enchanted-rose',
	'demo-xv-jewelry-box',
];

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
	// Precedence: registry lifecycle > corpus membership > well-known fixture/alias
	// slugs > demo prefix > unmanaged. Corpus membership wins over demo/fixture
	// classification because the corpus is the SSOT for renderable legacy clients.
	if (inRegistry) {
		return repoLifecycle === 'in_progress' ? 'canonical_in_progress' : 'canonical_published';
	}
	if (inCorpus) {
		return 'legacy_corpus';
	}
	if (slug === PREVIEW_E2E_FIXTURE_SLUG) {
		return 'preview_e2e_fixture';
	}
	if (slug === LEGACY_TYPO_ALIAS_SLUG) {
		return 'legacy_typo_alias';
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
	if (category === 'legacy_corpus') {
		return {
			deliveryState: 'ALIGNED',
			notes: 'Legacy client fixture in Local Render Corpus (excluded from remote managed parity).',
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
	if (category === 'legacy_typo_alias') {
		return {
			deliveryState: 'NOT_APPLICABLE',
			notes: 'Disposable stale rekey twin in Preview DB (renamed to alba-rosa-quinonez in canonical code).',
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

function collectDatabaseRowStates(
	querySlugs: string[],
	timeoutMs: number,
): {
	dbRowsByEnv: Map<TargetEnv, Map<string, DatabaseRowState>>;
	envSummaries: Record<TargetEnv, EnvironmentInventorySummary>;
} {
	const budget = new ObservabilityInvocationBudget();
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

		const proj = readEnvironmentDatabaseProjection({
			environment: env,
			slugs: querySlugs,
			timeoutMs,
			budget,
		});

		if (!proj.reachable) continue;
		envSummaries[env].reachable = true;
		envSummaries[env].totalActiveRows = proj.activeInvitationRows;

		for (const row of proj.rows) {
			const hasVerifiedProvenance = isVerifiedManagedReleaseProvenance(row.provenance);
			envMap.set(row.slug, {
				present: true,
				kind: row.metadata.kind ?? null,
				eventType: row.metadata.eventType ?? null,
				themeId: row.metadata.themeId ?? null,
				clientName: row.metadata.clientName ?? null,
				hasProvenance: hasVerifiedProvenance,
				provenanceSlug: row.provenance.definitionSlug,
				packageHash: row.provenance.packageHash,
			});
		}
	}

	return { dbRowsByEnv, envSummaries };
}

export function runInventoryAudit(options?: { timeoutMs?: number }): InventoryAuditResult {
	const timeoutMs = options?.timeoutMs ?? 15_000;
	const generatedAt = new Date().toISOString();

	// 1. Gather Repository Registries
	const canonicalDefs = listInvitationDefinitions();
	const canonicalMap = new Map(canonicalDefs.map((def) => [def.slug, def]));
	const corpusEntries = listLocalRenderCorpus();
	const corpusMap = new Map(corpusEntries.map((entry) => [entry.slug, entry]));

	// Gather union of all observed and expected slugs
	const registeredSlugs = new Set([
		...canonicalMap.keys(),
		...corpusMap.keys(),
		PREVIEW_E2E_FIXTURE_SLUG,
		LEGACY_TYPO_ALIAS_SLUG,
		...DEMO_SLUGS,
	]);

	const querySlugs = Array.from(registeredSlugs);

	// 2. Query Databases via Database Projection Service
	const { dbRowsByEnv, envSummaries } = collectDatabaseRowStates(querySlugs, timeoutMs);

	// 3. Consolidate All Unique Slugs Across Registries and DBs
	const allSlugsSet = new Set<string>([
		...canonicalMap.keys(),
		...corpusMap.keys(),
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
		legacy_corpus: 0,
		demo: 0,
		preview_e2e_fixture: 0,
		legacy_typo_alias: 0,
		unmanaged: 0,
	};
}
