/**
 * Authorization + aggregation tests for observability (no live DB required for unit cases).
 */

import { describe, expect, it, jest } from '@jest/globals';
import { buildObservabilitySnapshotFixture } from '../helpers/observability-snapshot-fixture';

describe('observability browser payload contract', () => {
	it('sanitized snapshot shape omits credentials and absolute paths', () => {
		const sample = buildObservabilitySnapshotFixture({
			generatedAt: '2026-07-31T12:00:00.000Z',
			freshness: 'PARTIAL',
			operationalStatus: 'UNVERIFIED',
			deliveryStatus: 'UNVERIFIED',
			coverage: [
				{ environment: 'local', status: 'AVAILABLE' },
				{
					environment: 'preview',
					status: 'NOT_PROBED',
					reasonCode: 'ENVIRONMENT_UNAVAILABLE',
				},
				{
					environment: 'production',
					status: 'NOT_PROBED',
					reasonCode: 'ENVIRONMENT_UNAVAILABLE',
				},
			],
			cache: { refreshAfter: '2026-07-31T12:01:00.000Z' },
			environmentSummaries: ['local', 'preview', 'production'].map((environment) => ({
				environment: environment as 'local' | 'preview' | 'production',
				operationalStatus: 'UNVERIFIED' as const,
				deliveryStatus: 'UNVERIFIED' as const,
				coverage:
					environment === 'local' ? ('AVAILABLE' as const) : ('NOT_PROBED' as const),
				counts: { invitations: 0, issues: 0, workItems: 0 },
			})),
		});

		const serialized = JSON.stringify(sample);
		expect(serialized).not.toMatch(/postgres:\/\//i);
		expect(serialized).not.toMatch(/service_role/i);
		expect(serialized).not.toMatch(/[A-Za-z]:\\\\/);
		expect(serialized).not.toMatch(/password=/i);
	});
});

describe('observability refresh contract', () => {
	it('manual refresh path is a GET read of the snapshot builder only', () => {
		// Guardrail: API module must not import mutation CLIs.
		const apiSource = jest.requireActual('fs') as typeof import('node:fs');
		const text = apiSource.readFileSync(
			'src/pages/api/dashboard/observabilidad/index.ts',
			'utf8',
		);
		expect(text).toContain('buildObservabilitySnapshot');
		expect(text).not.toContain('invitation:update');
		expect(text).not.toContain('child_process');
		expect(text).not.toContain('invitation-promote');
		expect(text).not.toContain('apply-migrations');
	});
});
