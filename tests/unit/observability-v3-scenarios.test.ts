import { describe, expect, it } from '@jest/globals';
import type {
	EnvironmentDatabaseProjection,
	InvitationDatabaseProjection,
	MigrationProjection,
} from '../../scripts/observability/database-projection.ts';
import {
	OBSERVABILITY_MAX_SEMANTIC_PATHS,
	reconcileInvitationDelivery,
	summarizeManagedDeltas,
} from '../../scripts/observability/delivery-reconciliation.ts';
import {
	assembleSnapshotFromEvidence,
	type CanonicalObservation,
	type SnapshotEvidence,
} from '../../scripts/observability/snapshot.ts';
import { RELEASE_SCHEMA_VERSION } from '../../scripts/provision/normalized-invitation-release.ts';
import type { SemanticDelta } from '../../scripts/provision/semantic-delta.ts';
import { buildEventContentData } from '../helpers/event-content-fixture.ts';

const ENVIRONMENTS = ['local', 'preview', 'production'] as const;
const CURRENT_HASH = 'current-package';
const PRIOR_HASH = 'prior-package';

function canonical(
	lifecycle: CanonicalObservation['lifecycle'] = 'published',
	requiredAssetKeys: string[] = [],
): CanonicalObservation {
	return {
		slug: 'managed-invitation',
		lifecycle,
		deliveryScope: 'content-and-assets',
		packageHash: CURRENT_HASH,
		managedContent: { hero: { name: 'Managed' } },
		metadata: {
			eventType: 'boda',
			kind: 'client',
			baseDemoId: 'luxury-hacienda',
			themeId: 'luxury-hacienda',
			snapshot: {},
			clientName: 'Cliente',
		},
		assets: requiredAssetKeys.map((key) => ({
			key,
			displayName: key,
			mimeType: 'image/webp',
			width: null,
			height: null,
			fileSize: null,
		})),
	};
}

function receipt(operationId = 'managed-operation') {
	return {
		operationId,
		status: 'applied' as const,
		commandKind: 'managed_invitation_apply',
		origin: 'managed_cli_local',
		completedSteps: ['provenance_recorded'],
	};
}

function row(
	state: 'aligned' | 'apply' = 'aligned',
	overrides: Partial<InvitationDatabaseProjection> = {},
): InvitationDatabaseProjection {
	return {
		slug: 'managed-invitation',
		invitationId: 'internal-id',
		draftStatus: 'valid',
		draftUpdatedAt: '2026-08-01T00:00:00.000Z',
		draftContent: null,
		detailRequired: false,
		detailBudgetExceeded: false,
		publishedVersion: 1,
		publishedAt: '2026-08-01T00:00:00.000Z',
		assetCount: 0,
		managedAssetKeys: [],
		managedAssets: [],
		metadata: {
			eventType: 'boda',
			kind: 'client',
			baseDemoId: 'luxury-hacienda',
			themeId: 'luxury-hacienda',
			snapshot: {},
			clientName: 'Cliente',
			createdBy: 'owner-id',
		},
		event: { slug: 'managed-invitation', eventType: 'boda', ownerUserId: 'owner-id' },
		provenance: {
			definitionSlug: 'managed-invitation',
			releaseSchemaVersion: RELEASE_SCHEMA_VERSION,
			packageHash: state === 'aligned' ? CURRENT_HASH : PRIOR_HASH,
			managedProjection: null,
			hasManagedProjection: true,
			appliedDraftUpdatedAt: '2026-08-01T00:00:00.000Z',
			appliedOperationId: 'managed-operation',
			appliedPublishedVersion: 1,
			appliedPublishedProjectionHash: 'published-projection',
			appliedReceipt: receipt(),
			latestReceipt: receipt(),
		},
		...overrides,
	};
}

function projection(
	environment: (typeof ENVIRONMENTS)[number],
	rows: InvitationDatabaseProjection[],
	overrides: Partial<EnvironmentDatabaseProjection> = {},
): EnvironmentDatabaseProjection {
	return {
		environment,
		configured: true,
		reachable: true,
		targetClassification: environment === 'local' ? 'persistent-local' : environment,
		activeInvitationRows: rows.length,
		identityConflictsCount: 0,
		rows,
		failure: null,
		...overrides,
	};
}

function migration(
	environment: (typeof ENVIRONMENTS)[number],
	overrides: Partial<MigrationProjection> = {},
): MigrationProjection {
	return {
		environment,
		available: true,
		schemaLifecycle: 'CURRENT',
		appliedCount: 20,
		pendingCount: 0,
		...overrides,
	};
}

function evidence(
	input: {
		definition?: CanonicalObservation;
		states?: Partial<Record<(typeof ENVIRONMENTS)[number], 'aligned' | 'apply' | 'absent'>>;
		rows?: Partial<Record<(typeof ENVIRONMENTS)[number], InvitationDatabaseProjection[]>>;
		legacy?: SnapshotEvidence['legacy'];
		projectionOverrides?: Partial<
			Record<(typeof ENVIRONMENTS)[number], Partial<EnvironmentDatabaseProjection>>
		>;
		migrationOverrides?: Partial<
			Record<(typeof ENVIRONMENTS)[number], Partial<MigrationProjection>>
		>;
	} = {},
): SnapshotEvidence {
	const definition = input.definition ?? canonical();
	const projections = Object.fromEntries(
		ENVIRONMENTS.map((environment) => {
			const state = input.states?.[environment] ?? 'aligned';
			const rows = input.rows?.[environment] ?? (state === 'absent' ? [] : [row(state)]);
			return [
				environment,
				projection(environment, rows, input.projectionOverrides?.[environment]),
			];
		}),
	) as SnapshotEvidence['projections'];
	const migrations = Object.fromEntries(
		ENVIRONMENTS.map((environment) => [
			environment,
			migration(environment, input.migrationOverrides?.[environment]),
		]),
	) as SnapshotEvidence['migrations'];
	return {
		generatedAt: '2026-08-01T12:00:00.000Z',
		probeScope: 'all',
		canonical: input.legacy ? [] : [definition],
		canonicalFailures: [],
		legacy: input.legacy ?? [],
		projections,
		migrations,
	};
}

function summary(snapshot: ReturnType<typeof assembleSnapshotFromEvidence>) {
	return snapshot.invitationSummaries.find((item) => item.slug === 'managed-invitation')!;
}

function directCanonical(requiredAssetKeys: string[] = []): CanonicalObservation {
	const managedContent = buildEventContentData({
		title: 'Boda Demo',
		eventType: 'boda',
		theme: { preset: 'luxury-hacienda' },
		hero: {
			name: 'Managed',
			date: '2026-08-01T00:00:00.000Z',
			backgroundImage: '/assets/hero.jpg',
		},
	});
	return { ...canonical('published', requiredAssetKeys), managedContent };
}

function directRow(
	content: Record<string, unknown>,
	overrides: Partial<InvitationDatabaseProjection> = {},
): InvitationDatabaseProjection {
	return row('aligned', {
		detailRequired: true,
		draftContent: content,
		provenance: {
			...row().provenance,
			hasManagedProjection: false,
			managedProjection: null,
			releaseSchemaVersion: null,
		},
		...overrides,
	});
}

describe('observability v3 operational and delivery separation', () => {
	it('reports healthy operations while a canonical change is pending everywhere', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				states: { local: 'apply', preview: 'apply', production: 'apply' },
			}),
		);
		expect(snapshot).toMatchObject({
			operationalStatus: 'HEALTHY',
			deliveryStatus: 'IN_PROGRESS',
			freshness: 'FRESH',
		});
		expect(summary(snapshot).comparisons.map((item) => item.outcome)).toEqual([
			'APPLY',
			'APPLY',
			'APPLY',
		]);
	});

	it.each([
		[
			'local only',
			{ local: 'aligned', preview: 'apply', production: 'apply' } as const,
			['ALREADY_APPLIED', 'APPLY', 'APPLY'],
		],
		[
			'local and preview',
			{ local: 'aligned', preview: 'aligned', production: 'apply' } as const,
			['ALREADY_APPLIED', 'ALREADY_APPLIED', 'APPLY'],
		],
	])(
		'classifies a valid %s promotion as healthy work in progress',
		(_label, states, outcomes) => {
			const snapshot = assembleSnapshotFromEvidence(evidence({ states }));
			expect(snapshot.operationalStatus).toBe('HEALTHY');
			expect(snapshot.deliveryStatus).toBe('IN_PROGRESS');
			expect(summary(snapshot).comparisons.map((item) => item.outcome)).toEqual(outcomes);
			expect(snapshot.workItems.some((item) => item.reasonCode === 'PARTIAL_PROMOTION')).toBe(
				true,
			);
		},
	);

	it('reports full three-environment alignment independently from operational health', () => {
		const snapshot = assembleSnapshotFromEvidence(evidence());
		expect(snapshot).toMatchObject({
			operationalStatus: 'HEALTHY',
			deliveryStatus: 'ALIGNED',
		});
	});

	it.each([
		['preview ahead of local', { local: 'apply', preview: 'aligned', production: 'apply' }],
		[
			'production ahead of preview',
			{ local: 'aligned', preview: 'apply', production: 'aligned' },
		],
	] as const)(
		'reports healthy operations plus action-required delivery for %s',
		(_label, states) => {
			const snapshot = assembleSnapshotFromEvidence(evidence({ states }));
			expect(snapshot.operationalStatus).toBe('HEALTHY');
			expect(snapshot.deliveryStatus).toBe('ACTION_REQUIRED');
			expect(
				snapshot.issues.some((item) => item.reasonCode === 'LIFECYCLE_SEQUENCE_INVALID'),
			).toBe(true);
		},
	);
});

describe('observability v3 baseline and lifecycle authority', () => {
	it('proves direct alignment without legacy provenance when all current states are equal', () => {
		const definition = directCanonical();
		const current = directRow(definition.managedContent);
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				definition,
				rows: { local: [current], preview: [current], production: [current] },
			}),
		);
		expect(summary(snapshot)).toMatchObject({
			operationalStatus: 'HEALTHY',
			deliveryStatus: 'ALIGNED',
		});
		expect(snapshot.issues.some((item) => item.reasonCode === 'BASELINE_UNAVAILABLE')).toBe(
			false,
		);
	});

	it('requires a baseline only when a current environment differs', () => {
		const definition = directCanonical();
		const divergent = buildEventContentData({
			title: 'Boda Demo',
			eventType: 'boda',
			theme: { preset: 'luxury-hacienda' },
			hero: {
				name: 'Different',
				date: '2026-08-01T00:00:00.000Z',
				backgroundImage: '/assets/hero.jpg',
			},
		});
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				definition,
				rows: {
					local: [directRow(definition.managedContent)],
					preview: [directRow(divergent)],
					production: [directRow(definition.managedContent)],
				},
			}),
		);
		expect(snapshot.operationalStatus).toBe('HEALTHY');
		expect(snapshot.deliveryStatus).toBe('UNVERIFIED');
		expect(snapshot.issues.some((item) => item.reasonCode === 'BASELINE_UNAVAILABLE')).toBe(
			true,
		);
	});

	it('does not allow an incompatible normalization version to bypass baseline verification', () => {
		const definition = directCanonical();
		const incompatible = directRow(definition.managedContent, {
			provenance: {
				...row().provenance,
				releaseSchemaVersion: '1.0.0',
				managedProjection: definition.managedContent,
			},
		});
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				definition,
				rows: {
					local: [incompatible],
					preview: [incompatible],
					production: [incompatible],
				},
			}),
		);
		expect(snapshot.deliveryStatus).toBe('UNVERIFIED');
		expect(
			snapshot.issues.some((item) => item.reasonCode === 'BASELINE_VERSION_INCOMPATIBLE'),
		).toBe(true);
	});

	it('blocks an invitation identity conflict without leaking row identity', () => {
		const duplicate = row('aligned', { invitationId: 'second-internal-id' });
		const snapshot = assembleSnapshotFromEvidence(
			evidence({ rows: { local: [row(), duplicate] } }),
		);
		expect(snapshot.operationalStatus).toBe('BLOCKED');
		expect(
			snapshot.issues.some((item) => item.reasonCode === 'INVITATION_IDENTITY_CONFLICT'),
		).toBe(true);
		expect(JSON.stringify(snapshot)).not.toContain('second-internal-id');
	});

	it('classifies a missing baseline as unverified delivery evidence', () => {
		const local = row('aligned', {
			provenance: {
				...row().provenance,
				hasManagedProjection: false,
				managedProjection: null,
			},
		});
		const snapshot = assembleSnapshotFromEvidence(evidence({ rows: { local: [local] } }));
		expect(snapshot.operationalStatus).toBe('HEALTHY');
		expect(snapshot.deliveryStatus).toBe('UNVERIFIED');
		expect(snapshot.issues.some((item) => item.reasonCode === 'BASELINE_UNAVAILABLE')).toBe(
			true,
		);
	});

	it('treats a new in-progress invitation as valid pending work', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				definition: canonical('in_progress'),
				states: { local: 'absent', preview: 'absent', production: 'absent' },
			}),
		);
		expect(snapshot).toMatchObject({
			operationalStatus: 'HEALTHY',
			deliveryStatus: 'IN_PROGRESS',
		});
		expect(snapshot.workItems.some((item) => item.reasonCode === 'VALID_DRAFT_PENDING')).toBe(
			true,
		);
	});

	it('blocks a published invitation that is absent from every environment', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				states: { local: 'absent', preview: 'absent', production: 'absent' },
			}),
		);
		expect(snapshot.operationalStatus).toBe('BLOCKED');
		expect(snapshot.issues.some((item) => item.reasonCode === 'INVITATION_MISSING')).toBe(true);
	});

	it('requires lifecycle metadata to advance after production alignment', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({ definition: canonical('in_progress') }),
		);
		expect(snapshot.operationalStatus).toBe('HEALTHY');
		expect(snapshot.deliveryStatus).toBe('ACTION_REQUIRED');
		expect(snapshot.issues.some((item) => item.reasonCode === 'LIFECYCLE_METADATA_STALE')).toBe(
			true,
		);
	});

	it('treats a local-only in-progress invitation as valid staged delivery', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				definition: canonical('in_progress'),
				states: { local: 'aligned', preview: 'absent', production: 'absent' },
			}),
		);
		expect(snapshot.operationalStatus).toBe('HEALTHY');
		expect(snapshot.deliveryStatus).toBe('IN_PROGRESS');
		expect(summary(snapshot).comparisons.map((item) => item.outcome)).toEqual([
			'ALREADY_APPLIED',
			'APPLY',
			'APPLY',
		]);
		expect(snapshot.issues.some((item) => item.reasonCode === 'BASELINE_UNAVAILABLE')).toBe(
			false,
		);
	});

	it('blocks a local-only invitation whose lifecycle already promises publication', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				states: { local: 'aligned', preview: 'absent', production: 'absent' },
			}),
		);
		expect(snapshot.operationalStatus).toBe('BLOCKED');
		expect(
			snapshot.issues.filter((item) => item.reasonCode === 'INVITATION_MISSING'),
		).toHaveLength(2);
	});
});

describe('observability v3 operational failure boundaries', () => {
	it('blocks an invalid draft as an operational defect', () => {
		const invalid = row('apply', {
			detailRequired: true,
			draftContent: { invalid: true },
			provenance: { ...row().provenance, managedProjection: { hero: { name: 'Base' } } },
		});
		const snapshot = assembleSnapshotFromEvidence(evidence({ rows: { local: [invalid] } }));
		expect(snapshot.operationalStatus).toBe('BLOCKED');
		expect(snapshot.issues.some((item) => item.reasonCode === 'DRAFT_INVALID')).toBe(true);
	});

	it.each([
		['published', 1, 'BLOCKED', 'REQUIRED_PUBLISHED_ASSET_MISSING', null],
		[
			'unpublished',
			null,
			'HEALTHY',
			'UNPUBLISHED_ASSET_PENDING',
			['IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS'] as const,
		],
	] as const)(
		'classifies a missing required asset for %s content without conflating impact',
		(_label, publishedVersion, operationalStatus, reasonCode, deliveryStatuses) => {
			const noAsset = row('aligned', { publishedVersion });
			const snapshot = assembleSnapshotFromEvidence(
				evidence({
					definition: canonical('published', ['hero']),
					rows: { local: [noAsset], preview: [noAsset], production: [noAsset] },
				}),
			);
			expect(snapshot.operationalStatus).toBe(operationalStatus);
			expect(
				[...snapshot.issues, ...snapshot.workItems].some(
					(item) => item.reasonCode === reasonCode,
				),
			).toBe(true);
			if (deliveryStatuses) {
				expect(snapshot.environmentSummaries.map((item) => item.deliveryStatus)).toEqual([
					...deliveryStatuses,
				]);
			}
		},
	);

	it('marks unavailable evidence as partial and unverified instead of healthy', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				projectionOverrides: {
					preview: { reachable: false, rows: [], failure: 'query_failed' },
				},
			}),
		);
		expect(snapshot.freshness).toBe('PARTIAL');
		expect(snapshot.operationalStatus).toBe('UNVERIFIED');
		expect(snapshot.deliveryStatus).toBe('UNVERIFIED');
	});

	it('surfaces schema incompatibility as a typed operational issue', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				migrationOverrides: { preview: { schemaLifecycle: 'SCHEMA_DRIFT' } },
			}),
		);
		expect(snapshot.operationalStatus).toBe('BLOCKED');
		expect(
			snapshot.issues.some(
				(item) => item.environment === 'preview' && item.reasonCode === 'SCHEMA_DRIFT',
			),
		).toBe(true);
	});

	it('blocks contradictory authoritative row counts', () => {
		const snapshot = assembleSnapshotFromEvidence(
			evidence({ projectionOverrides: { preview: { identityConflictsCount: 1 } } }),
		);
		expect(snapshot.operationalStatus).toBe('BLOCKED');
		expect(
			snapshot.issues.some(
				(item) =>
					item.environment === 'preview' &&
					item.reasonCode === 'AUTHORITATIVE_COUNT_MISMATCH',
			),
		).toBe(true);
	});

	it('accepts a legacy asset when its current semantic slot is unique', () => {
		const definition = directCanonical(['hero']);
		const withCurrentAsset = directRow(definition.managedContent, {
			assetCount: 1,
			managedAssetKeys: [],
			managedAssets: [
				{
					id: 'legacy-hero',
					key: null,
					displayName: 'hero',
					mimeType: 'image/webp',
					width: null,
					height: null,
					fileSize: null,
				},
			],
		});
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				definition,
				rows: {
					local: [withCurrentAsset],
					preview: [withCurrentAsset],
					production: [withCurrentAsset],
				},
			}),
		);
		expect(snapshot).toMatchObject({ operationalStatus: 'HEALTHY', deliveryStatus: 'ALIGNED' });
		expect(snapshot.issues).toEqual([]);
	});

	it('keeps ambiguous current asset mappings visible', () => {
		const ambiguous = row('aligned', {
			assetCount: 2,
			managedAssets: [
				{
					id: 'one',
					key: null,
					displayName: 'hero',
					mimeType: 'image/webp',
					width: null,
					height: null,
					fileSize: null,
				},
				{
					id: 'two',
					key: null,
					displayName: 'hero',
					mimeType: 'image/webp',
					width: null,
					height: null,
					fileSize: null,
				},
			],
		});
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				definition: canonical('published', ['hero']),
				rows: { local: [ambiguous], preview: [ambiguous], production: [ambiguous] },
			}),
		);
		expect(
			snapshot.issues.some((item) => item.reasonCode === 'ASSET_IDENTITY_UNVERIFIED'),
		).toBe(true);
	});

	it('honors explicit legacy remote-parity exclusion', () => {
		const legacyRow = row('aligned', { slug: 'legacy-invitation' });
		const snapshot = assembleSnapshotFromEvidence(
			evidence({
				legacy: [{ slug: 'legacy-invitation', remoteParity: 'excluded' }],
				rows: { local: [legacyRow], preview: [], production: [] },
			}),
		);
		expect(snapshot).toMatchObject({
			operationalStatus: 'HEALTHY',
			deliveryStatus: 'ALIGNED',
		});
		expect(snapshot.issues).toEqual([]);
	});
});

describe('observability v3 three-way detail', () => {
	it('detects target-only managed drift from the authoritative baseline', () => {
		const baseline = buildEventContentData({
			title: 'Boda Demo',
			eventType: 'boda',
			theme: { preset: 'luxury-hacienda' },
			hero: {
				name: 'Baseline',
				date: '2026-08-01T00:00:00.000Z',
				backgroundImage: '/assets/hero.jpg',
			},
		});
		const target = { ...baseline, hero: { ...baseline.hero, name: 'Host edit' } };
		const driftRow = row('aligned', {
			detailRequired: true,
			draftContent: target,
			provenance: { ...row().provenance, managedProjection: baseline },
		});
		const result = reconcileInvitationDelivery({
			environment: 'local',
			canonical: {
				...canonical(),
				managedContent: baseline,
			},
			row: driftRow,
		});
		expect(result.comparison).toMatchObject({
			outcome: 'DRIFT',
			detailStatus: 'AVAILABLE',
		});
		expect(result.comparison.semanticPaths).toContain('hero.name');
		expect(result.issueReasonCode).toBe('MANAGED_DRIFT');
	});

	it('preserves a known outcome while suppressing over-budget semantic paths', () => {
		const deltas: SemanticDelta[] = Array.from(
			{ length: OBSERVABILITY_MAX_SEMANTIC_PATHS + 1 },
			(_, index) => ({
				path: `hero.items[${index}].label`,
				operation: 'replace',
				previousCanonicalPresent: true,
				currentCanonicalPresent: true,
				currentTargetPresent: true,
				previousCanonicalValue: 'base',
				currentCanonicalValue: 'managed',
				currentTargetValue: 'host',
				isAssetField: false,
				status: index === 0 ? 'DRIFT' : 'APPLY',
				appliedValue: 'host',
			}),
		);
		const comparison = summarizeManagedDeltas('local', deltas);
		expect(comparison).toMatchObject({
			outcome: 'DRIFT',
			detailStatus: 'DETAIL_UNAVAILABLE',
			affectedFieldCount: OBSERVABILITY_MAX_SEMANTIC_PATHS + 1,
			semanticPaths: [],
		});
	});

	it('preserves a pending apply classification when only detail is over budget', () => {
		const result = reconcileInvitationDelivery({
			environment: 'preview',
			canonical: canonical(),
			row: row('apply', { detailRequired: true, detailBudgetExceeded: true }),
		});
		expect(result).toMatchObject({
			comparison: {
				outcome: 'APPLY',
				detailStatus: 'DETAIL_UNAVAILABLE',
				semanticPaths: [],
			},
			workReasonCode: 'CANONICAL_CHANGE_PENDING',
		});
		expect(result).not.toHaveProperty('issueReasonCode');
	});

	it('excludes unmanaged paths before publishing semantic evidence', () => {
		const base = {
			operation: 'replace' as const,
			previousCanonicalPresent: true,
			currentCanonicalPresent: true,
			currentTargetPresent: true,
			previousCanonicalValue: 'base',
			currentCanonicalValue: 'managed',
			currentTargetValue: 'target',
			isAssetField: false,
			appliedValue: 'target',
		};
		const comparison = summarizeManagedDeltas('local', [
			{ ...base, path: 'guestConfirmations[0].phone', status: 'DRIFT' },
			{ ...base, path: 'hero.title', status: 'APPLY' },
		]);
		expect(comparison).toMatchObject({
			outcome: 'APPLY',
			affectedFieldCount: 1,
			semanticPaths: ['hero.title'],
		});
	});
});
