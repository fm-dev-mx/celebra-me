import { describe, expect, it } from '@jest/globals';
import {
	combineEvidence,
	freshnessFromCachedTimestamp,
	invitationAttentionCount,
	migrationPresenceForEnv,
} from '@/lib/status/evidence';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

describe('canonical evidence aggregation', () => {
	it('does not promote LIVE + UNVERIFIED to globally LIVE', () => {
		expect(combineEvidence(['LIVE', 'UNVERIFIED'])).toBe('CACHED');
		expect(combineEvidence(['LIVE', 'LIVE', 'UNVERIFIED'])).toBe('CACHED');
		expect(combineEvidence(['UNVERIFIED', 'LIVE'])).toBe('CACHED');
	});

	it('keeps uniform LIVE, CACHED, and UNVERIFIED', () => {
		expect(combineEvidence(['LIVE', 'LIVE', 'LIVE'])).toBe('LIVE');
		expect(combineEvidence(['CACHED', 'CACHED'])).toBe('CACHED');
		expect(combineEvidence(['UNVERIFIED', 'UNVERIFIED'])).toBe('UNVERIFIED');
	});

	it('never classifies a disk/memory payload as LIVE from age alone', () => {
		const recent = new Date().toISOString();
		expect(freshnessFromCachedTimestamp(recent).status).toBe('CACHED');
		expect(freshnessFromCachedTimestamp('2020-01-01T00:00:00.000Z').status).toBe('STALE');
	});

	it('marks recent migrations UNVERIFIED when the env probe is missing, not NOT_APPLIED', () => {
		const unverified = {
			...buildCanonicalStatusViewFixture().environments.preview,
			evidence: 'UNVERIFIED' as const,
			appliedCount: null,
			pendingMigrations: [],
		};
		expect(migrationPresenceForEnv(unverified, '20260806120000')).toBe('UNVERIFIED');

		const current = buildCanonicalStatusViewFixture().environments.local;
		expect(migrationPresenceForEnv(current, '20260806120000')).toBe('APPLIED');
		expect(
			migrationPresenceForEnv(
				{ ...current, pendingMigrations: ['20260806120000'] },
				'20260806120000',
			),
		).toBe('NOT_APPLIED');
	});

	it('excludes in_progress slugs from invitation attention counts', () => {
		const environmentsBySlug = new Map([
			[
				'abril-michelle-becerra-rea',
				{ local: 'match', preview: 'match', production: 'match' } as const,
			],
			['renata', { local: 'behind', preview: 'behind', production: 'behind' } as const],
			['leslie-perez', { local: 'behind', preview: 'match', production: 'behind' } as const],
		]);
		const excludeSlugs = new Set(['renata', 'leslie-perez']);
		expect(invitationAttentionCount(environmentsBySlug, 'local', { excludeSlugs })).toBe(0);
		expect(invitationAttentionCount(environmentsBySlug, 'production', { excludeSlugs })).toBe(
			0,
		);
		expect(invitationAttentionCount(environmentsBySlug, 'local')).toBe(2);
	});
});
