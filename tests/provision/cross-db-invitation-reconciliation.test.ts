import { describe, expect, it } from '@jest/globals';
import {
	buildCrossDbInvitationFindings,
	type EnvironmentSnapshot,
} from '../../scripts/provision/cross-db-invitation-reconciliation.ts';
import type { TargetEnv } from '../../scripts/provision/dbs-status.ts';

function snap(
	environment: TargetEnv,
	rows: Array<{ slug: string; title?: string; packageHash?: string | null }>,
): EnvironmentSnapshot {
	return {
		environment,
		configured: true,
		reachable: true,
		dbUrlRedacted: `postgres://${environment}`,
		classification: environment === 'local' ? 'persistent-local' : environment,
		excludedCount: 0,
		rows: rows.map((row) => ({
			canonicalKey: row.slug,
			slug: row.slug,
			title: row.title ?? row.slug,
			status: 'published',
			kind: 'client',
			eventType: 'cumple',
			invitationId: '00000000-0000-4000-8000-000000000001',
			packageHash: row.packageHash ?? null,
			definitionSlug: row.slug,
			createdAt: '2026-08-01T00:00:00.000Z',
		})),
	};
}

describe('cross-db-invitation-reconciliation findings', () => {
	it('marks unmanaged typo twin as extra and published incomplete as missing', () => {
		const snapshots = {
			local: snap('local', [{ slug: 'alba-rosa-quinonez' }]),
			preview: snap('preview', [
				{ slug: 'alba-rosa-quinonez' },
				{ slug: 'alba-rosa-quinones' },
			]),
			production: snap('production', [{ slug: 'alba-rosa-quinonez' }]),
		} as Record<TargetEnv, EnvironmentSnapshot>;

		const findings = buildCrossDbInvitationFindings(snapshots, ['daniela-y-martin']);
		const typo = findings.find((f) => f.canonicalKey === 'alba-rosa-quinones');
		const canonical = findings.find((f) => f.canonicalKey === 'alba-rosa-quinonez');

		expect(typo?.kind).toBe('extra');
		expect(canonical?.kind).toBe('aligned');
		expect(findings.find((f) => f.canonicalKey === 'daniela-y-martin')?.kind).toBe('missing');
	});

	it('marks title/packageHash drift as divergent', () => {
		const snapshots = {
			local: snap('local', [
				{ slug: 'alba-rosa-quinonez', title: 'A', packageHash: 'aaa' },
			]),
			preview: snap('preview', [
				{ slug: 'alba-rosa-quinonez', title: 'B', packageHash: 'bbb' },
			]),
			production: snap('production', [
				{ slug: 'alba-rosa-quinonez', title: 'A', packageHash: 'aaa' },
			]),
		} as Record<TargetEnv, EnvironmentSnapshot>;

		const findings = buildCrossDbInvitationFindings(snapshots, []);
		const canonical = findings.find((f) => f.canonicalKey === 'alba-rosa-quinonez');
		expect(canonical?.kind).toBe('divergent');
		expect(canonical?.details.some((line) => line.includes('title'))).toBe(true);
	});
});
