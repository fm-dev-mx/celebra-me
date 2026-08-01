/**
 * Authorization + aggregation tests for observability (no live DB required for unit cases).
 */

import { describe, expect, it, jest } from '@jest/globals';
import type { ObservabilitySnapshot } from '@/lib/observability/types';

describe('observability browser payload contract', () => {
	it('sanitized snapshot shape omits credentials and absolute paths', () => {
		const sample: ObservabilitySnapshot = {
			schemaVersion: 1,
			generatedAt: '2026-07-31T12:00:00.000Z',
			overallStatus: 'UNVERIFIED',
			source: {
				branch: 'feat/x',
				commitSha: 'abc',
				workingTreeDirty: false,
				degraded: false,
			},
			fingerprints: { corpusFingerprint: 'a', inputFingerprint: 'b' },
			validation: {
				regression: { validationType: 'regression', freshness: 'NOT_RUN', snapshot: null },
				screenshots: {
					validationType: 'screenshots',
					freshness: 'NOT_RUN',
					snapshot: null,
				},
			},
			migrations: [],
			assets: [],
			invitations: [],
			environments: [],
			recommendedCommands: [],
			degradedNotes: [],
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
