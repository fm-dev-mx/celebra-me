import { describe, expect, it } from '@jest/globals';
import { mergeCanonicalStatusView } from '@/lib/status/merge';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

describe('canonical status merge', () => {
	it('replaces only diagnostics from the refreshed domain and environment', () => {
		const previous = buildCanonicalStatusViewFixture({
			diagnostics: [
				{
					code: 'ENVIRONMENT_IDENTITY_CONFLICT',
					domain: 'schema',
					evidence: 'LIVE',
					environment: 'preview',
					cause: 'Old schema conflict.',
					affectedFieldCount: 0,
					affectedSectionCount: 0,
					semanticPaths: [],
				},
				{
					code: 'MANAGED_DRIFT',
					domain: 'content',
					evidence: 'LIVE',
					environment: 'preview',
					cause: 'Content drift remains.',
					affectedFieldCount: 1,
					affectedSectionCount: 1,
					semanticPaths: ['hero.title'],
				},
			],
		});
		const incoming = buildCanonicalStatusViewFixture({
			diagnostics: [
				{
					code: 'PRODUCTION_AUTHORIZATION_MISSING',
					domain: 'schema',
					evidence: 'LIVE',
					environment: 'preview',
					cause: 'Current schema diagnostic.',
					affectedFieldCount: 0,
					affectedSectionCount: 0,
					semanticPaths: [],
				},
			],
		});

		const merged = mergeCanonicalStatusView({ previous, incoming, env: 'preview', domain: 'schema' });
		expect(merged.diagnostics.map((item) => item.code)).toEqual([
			'MANAGED_DRIFT',
			'PRODUCTION_AUTHORIZATION_MISSING',
		]);
		expect(merged.diagnostics.find((item) => item.code === 'MANAGED_DRIFT')?.evidence).toBe(
			'LIVE',
		);
	});

	it('preserves previous env evidence when a new probe is UNVERIFIED', () => {
		const previous = buildCanonicalStatusViewFixture({
			recentMigrations: [
				{
					version: '20260806120000',
					name: 'base.sql',
					presence: { local: 'APPLIED', preview: 'APPLIED', production: 'APPLIED' },
					verifiedAt: {
						local: '2026-08-12T20:00:00.000Z',
						preview: '2026-08-12T20:00:00.000Z',
						production: '2026-08-12T20:00:00.000Z',
					},
				},
			],
		});
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-12T23:00:00.000Z',
			environments: {
				...previous.environments,
				preview: {
					...previous.environments.preview,
					evidence: 'UNVERIFIED',
					appliedCount: null,
					schemaLifecycle: 'UNVERIFIED',
					probedAt: null,
				},
			},
			recentMigrations: [
				{
					version: '20260806120000',
					name: 'base.sql',
					presence: { local: 'UNVERIFIED', preview: 'UNVERIFIED', production: 'UNVERIFIED' },
					verifiedAt: { local: null, preview: null, production: null },
				},
			],
		});

		const merged = mergeCanonicalStatusView({
			previous,
			incoming,
			env: 'preview',
		});

		expect(merged.environments.preview.schemaLifecycle).toBe('CURRENT');
		expect(merged.environments.preview.evidence).toBe('CACHED');
		expect(merged.recentMigrations?.[0]?.presence.preview).toBe('APPLIED');
		expect(merged.recentMigrations?.[0]?.verifiedAt.preview).toBe('2026-08-12T20:00:00.000Z');
	});

	it('replaces only the probed environment migration presence on a successful probe', () => {
		const previous = buildCanonicalStatusViewFixture({
			recentMigrations: [
				{
					version: '20260806120000',
					name: 'base.sql',
					presence: { local: 'APPLIED', preview: 'UNVERIFIED', production: 'APPLIED' },
					verifiedAt: {
						local: '2026-08-12T20:00:00.000Z',
						preview: null,
						production: '2026-08-12T20:00:00.000Z',
					},
				},
			],
		});
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-12T23:00:00.000Z',
			recentMigrations: [
				{
					version: '20260806120000',
					name: 'base.sql',
					presence: { local: 'UNVERIFIED', preview: 'APPLIED', production: 'UNVERIFIED' },
					verifiedAt: {
						local: null,
						preview: '2026-08-12T23:00:00.000Z',
						production: null,
					},
				},
			],
		});

		const merged = mergeCanonicalStatusView({
			previous,
			incoming,
			env: 'preview',
			domain: 'schema',
		});

		expect(merged.recentMigrations?.[0]?.presence).toEqual({
			local: 'APPLIED',
			preview: 'APPLIED',
			production: 'APPLIED',
		});
		expect(merged.recentMigrations?.[0]?.verifiedAt.preview).toBe('2026-08-12T23:00:00.000Z');
		expect(merged.recentMigrations?.[0]?.verifiedAt.local).toBe('2026-08-12T20:00:00.000Z');
	});

	it('preserves previous Preview evidence during a full refresh that fails Preview', () => {
		const previous = buildCanonicalStatusViewFixture();
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-12T23:00:00.000Z',
			environments: {
				local: previous.environments.local,
				preview: {
					...previous.environments.preview,
					evidence: 'UNVERIFIED',
					schemaLifecycle: 'UNVERIFIED',
					appliedCount: null,
					probedAt: null,
				},
				production: previous.environments.production,
			},
		});

		const merged = mergeCanonicalStatusView({ previous, incoming });
		expect(merged.environments.preview.schemaLifecycle).toBe('CURRENT');
		expect(merged.environments.preview.evidence).toBe('CACHED');
		expect(merged.environments.local.evidence).toBe('LIVE');
		expect(merged.environments.production.evidence).toBe('LIVE');
	});

	it('merges patch evidence by environment without replacing other domains', () => {
		const previous = buildCanonicalStatusViewFixture();
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-13T00:00:00.000Z',
			manualPatches: withProductionPatch(previous.manualPatches, {
				status: 'NOT_NEEDED',
				matchingRowCount: 0,
				reason: 'LIVE_ZERO_ROWS',
			}),
			environments: {
				...previous.environments,
				production: { ...previous.environments.production, evidence: 'LIVE' },
			},
		});
		const merged = mergeCanonicalStatusView({ previous, incoming, domain: 'patch' });
		expect(merged.manualPatches[0]?.environments.production.status).toBe('NOT_NEEDED');
		expect(merged.manualPatches[0]?.environments.local.status).toBe('NOT_APPLICABLE');
		expect(merged.promotions).toEqual(previous.promotions);
		expect(merged.recentMigrations).toEqual(previous.recentMigrations);
	});

	it('updates patches on a full refresh without a domain filter', () => {
		const previous = buildCanonicalStatusViewFixture();
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-13T00:00:00.000Z',
			manualPatches: withProductionPatch(previous.manualPatches, {
				status: 'NOT_NEEDED',
				matchingRowCount: 0,
				reason: 'LIVE_ZERO_ROWS',
			}),
		});
		const merged = mergeCanonicalStatusView({ previous, incoming });
		expect(merged.manualPatches[0]?.environments.production.status).toBe('NOT_NEEDED');
		expect(merged.manualPatches[0]?.environments.production.matchingRowCount).toBe(0);
	});

	it('keeps live patch counts when a patch refresh has unverified schema evidence', () => {
		const previous = buildCanonicalStatusViewFixture();
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-13T00:00:00.000Z',
			environments: {
				...previous.environments,
				production: {
					...previous.environments.production,
					evidence: 'UNVERIFIED',
					schemaLifecycle: 'UNVERIFIED',
					appliedCount: null,
					probedAt: null,
				},
			},
			manualPatches: withProductionPatch(previous.manualPatches, {
				status: 'NOT_NEEDED',
				matchingRowCount: 0,
				reason: 'LIVE_ZERO_ROWS',
			}),
		});
		const merged = mergeCanonicalStatusView({ previous, incoming, domain: 'patch' });
		expect(merged.manualPatches[0]?.environments.production.status).toBe('NOT_NEEDED');
		expect(merged.environments.production.evidence).toBe('LIVE');
		expect(merged.environments.production.schemaLifecycle).toBe('CURRENT');
		expect(merged.generatedAt).toBe('2026-08-13T00:00:00.000Z');
	});

	it('preserves previous live patches when incoming patch evidence is unverified', () => {
		const previous = buildCanonicalStatusViewFixture();
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-13T00:00:00.000Z',
			manualPatches: previous.manualPatches.map((item) => ({
				...item,
				environments: {
					...item.environments,
					production: {
						...item.environments.production,
						status: 'UNVERIFIED',
						evidence: 'UNVERIFIED',
						matchingRowCount: null,
						reason: 'QUERY_FAILED',
						planCommand: null,
					},
				},
			})),
		});
		const merged = mergeCanonicalStatusView({ previous, incoming, domain: 'patch' });
		expect(merged.manualPatches[0]?.environments.production.status).toBe('PENDING');
		expect(merged.manualPatches[0]?.environments.production.matchingRowCount).toBe(4);
		expect(merged.generatedAt).toBe(previous.generatedAt);
	});

	it('does not replace patches during a schema-only refresh', () => {
		const previous = buildCanonicalStatusViewFixture();
		const incoming = buildCanonicalStatusViewFixture({
			generatedAt: '2026-08-13T00:00:00.000Z',
			manualPatches: withProductionPatch(previous.manualPatches, {
				status: 'NOT_NEEDED',
				matchingRowCount: 0,
				reason: 'LIVE_ZERO_ROWS',
			}),
		});
		const merged = mergeCanonicalStatusView({ previous, incoming, domain: 'schema' });
		expect(merged.manualPatches[0]?.environments.production.status).toBe('PENDING');
		expect(merged.manualPatches[0]?.environments.production.matchingRowCount).toBe(4);
	});
});

function withProductionPatch(
	patches: ReturnType<typeof buildCanonicalStatusViewFixture>['manualPatches'],
	production: Partial<(typeof patches)[number]['environments']['production']>,
) {
	return patches.map((item, index) =>
		index === 0
			? {
					...item,
					environments: {
						...item.environments,
						production: { ...item.environments.production, ...production },
					},
				}
			: item,
	);
}
