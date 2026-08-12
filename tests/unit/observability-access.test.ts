/**
 * Authorization + aggregation tests for the Local status surface (no live DB required).
 */

import { describe, expect, it, jest } from '@jest/globals';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture';

describe('canonical status browser payload contract', () => {
	it('sanitized view omits credentials and absolute paths', () => {
		const sample = buildCanonicalStatusViewFixture();
		const serialized = JSON.stringify(sample);
		expect(serialized).not.toMatch(/postgres:\/\//i);
		expect(serialized).not.toMatch(/service_role/i);
		expect(serialized).not.toMatch(/[A-Za-z]:\\\\/);
		expect(serialized).not.toMatch(/password=/i);
	});
});

describe('canonical status refresh contract', () => {
	it('manual refresh path is a GET read of the canonical status builder only', () => {
		const apiSource = jest.requireActual('fs') as typeof import('node:fs');
		const text = apiSource.readFileSync('src/pages/api/dashboard/estado/index.ts', 'utf8');
		expect(text).toContain('refreshCanonicalStatusView');
		expect(text).not.toContain('invitation:update');
		expect(text).not.toContain('invitation:promote');
		expect(text).not.toContain('invitation:release');
		expect(text).not.toContain('child_process');
		expect(text).not.toContain('invitation-promote');
		expect(text).not.toContain('apply-migrations');
		expect(text).not.toContain('buildObservabilitySnapshot');
	});
});
