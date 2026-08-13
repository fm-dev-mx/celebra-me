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
});
