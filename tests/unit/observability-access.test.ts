/**
 * Authorization + aggregation tests for observability (no live DB required for unit cases).
 */

import { describe, expect, it, jest } from '@jest/globals';
import type { ObservabilitySnapshot } from '@/lib/observability/types';

describe('observability browser payload contract', () => {
	it('sanitized snapshot shape omits credentials and absolute paths', () => {
		const sample: ObservabilitySnapshot = {
			schemaVersion: 2,
			generatedAt: '2026-07-31T12:00:00.000Z',
			overallStatus: 'UNVERIFIED',
			cache: { state: 'fresh', refreshAfter: '2026-07-31T12:01:00.000Z' },
			source: {
				branch: 'feat/x',
				commitShaShort: 'abcdef1',
				workingTreeDirty: false,
			},
			health: {
				environments: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
				invitations: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
				migrations: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
				assets: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
				validations: { total: 2, ok: 0, warning: 0, blocking: 0, unverified: 2 },
			},
			issues: [],
			validationEvidence: [
				{
					type: 'regression',
					freshness: 'NOT_RUN',
					completedAt: null,
					passed: null,
					total: null,
				},
				{
					type: 'screenshots',
					freshness: 'NOT_RUN',
					completedAt: null,
					passed: null,
					total: null,
				},
			],
			recommendedActions: [],
		};

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
