/**
 * managed-status.test.ts — Compact managed status composition & safety
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockSession = {
	timeoutMs: 2000,
	timeoutDegraded: false,
	debugCounters: { invocations: 0, memoHits: 0, timeoutDegraded: false },
	markTimeoutDegraded: jest.fn(),
};

jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	evaluateGeneralStatus: jest.fn(),
	getOrCreateStatusProbeSession: jest.fn(() => mockSession),
	resetStatusProbeSession: jest.fn(),
}));

import {
	evaluateCompactManagedStatus,
	formatCompactManagedStatus,
	runCompactManagedStatusSafe,
} from '../../scripts/provision/managed-status.ts';
import { evaluateGeneralStatus } from '../../scripts/provision/dbs-status.ts';

const mockedGeneral = evaluateGeneralStatus as jest.MockedFunction<typeof evaluateGeneralStatus>;

function envStatus(
	environment: 'local' | 'preview' | 'production',
	schemaLifecycle: 'CURRENT' | 'BEHIND' | 'SCHEMA_DRIFT' | 'UNVERIFIED',
	opts?: { configured?: boolean; reachable?: boolean; errorDetail?: string },
) {
	return {
		environment,
		configured: opts?.configured ?? true,
		reachable: opts?.reachable ?? true,
		dbUrlRedacted: 'postgres://…',
		targetClassification: environment,
		activeManagedCount: 1,
		identityConflictsCount: 0,
		schemaLifecycle,
		errorDetail: opts?.errorDetail,
	};
}

describe('managed-status compact composition', () => {
	beforeEach(() => {
		mockedGeneral.mockReset();
		mockSession.timeoutDegraded = false;
	});

	it('keeps compact slug on connectivity CONTENT and does not classify publication', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'CURRENT'),
				preview: envStatus('preview', 'CURRENT'),
				production: envStatus('production', 'CURRENT'),
			},
			totalDefinitionsCount: 1,
		});

		const status = await evaluateCompactManagedStatus({ slug: 'romina-rios-chaparro' });
		expect(status.readOnly).toBe(true);
		expect(status.contentMode).toBe('connectivity');
		expect(status.contentSlug).toBe('romina-rios-chaparro');
		expect(status.content.local.status).toBe('UNVERIFIED');
		expect(status.schema.local.status).toBe('CURRENT');
		expect(formatCompactManagedStatus(status)).toContain('CONTENT');
		expect(formatCompactManagedStatus(status)).toContain(
			'use pnpm dbs romina-rios-chaparro',
		);
		expect(formatCompactManagedStatus(status)).not.toContain('MATCH_CANONICAL');
		expect(formatCompactManagedStatus(status)).not.toContain('BEHIND_CANONICAL');
		expect(formatCompactManagedStatus(status)).not.toContain('CLEAN');
	});

	it('uses connectivity CONTENT by default without slug (Git-hook safe)', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'CURRENT'),
				preview: envStatus('preview', 'UNVERIFIED', {
					configured: false,
					reachable: false,
					errorDetail: 'PREVIEW_DB_URL not configured',
				}),
				production: envStatus('production', 'UNVERIFIED', {
					configured: true,
					reachable: false,
					errorDetail: 'Database connection check failed or timed out',
				}),
			},
			totalDefinitionsCount: 0,
		});

		const status = await evaluateCompactManagedStatus();
		expect(status.contentMode).toBe('connectivity');
		expect(status.content.local.status).toBe('UNVERIFIED');
		expect(status.content.preview.status).toBe('CREDENTIALS_REQUIRED');
		expect(status.content.production.status).toBe('UNREACHABLE');
		expect(status.schema.preview.status).toBe('UNVERIFIED');
		expect(mockedGeneral.mock.calls[0]?.[0]).toMatchObject({ includeManagedCounts: false });
		expect(formatCompactManagedStatus(status)).toContain(
			'connectivity only; not publication state',
		);
	});

	it('ignores aggregateContent and does not classify publication from package hash', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'CURRENT'),
				preview: envStatus('preview', 'CURRENT'),
				production: envStatus('production', 'CURRENT'),
			},
			totalDefinitionsCount: 2,
		});

		const status = await evaluateCompactManagedStatus({ aggregateContent: true });
		expect(status.contentMode).toBe('connectivity');
		expect(status.content.local.status).toBe('UNVERIFIED');
		expect(formatCompactManagedStatus(status)).toContain(
			'connectivity only; not publication state',
		);
		expect(formatCompactManagedStatus(status)).not.toContain('MATCH_CANONICAL');
		expect(formatCompactManagedStatus(status)).not.toContain('DRAFT_DIVERGENCE_ONLY');
	});

	it('keeps safe runner non-throwing when probes fail', async () => {
		mockedGeneral.mockRejectedValue(new Error('boom'));
		const result = await runCompactManagedStatusSafe();
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.text).toMatch(/unavailable/i);
	});

	it('reuses schema BEHIND and SCHEMA_DRIFT from the general classifier', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'BEHIND'),
				preview: envStatus('preview', 'SCHEMA_DRIFT'),
				production: envStatus('production', 'CURRENT'),
			},
			totalDefinitionsCount: 0,
		});

		const status = await evaluateCompactManagedStatus();
		expect(status.schema.local.status).toBe('BEHIND');
		expect(status.schema.preview.status).toBe('SCHEMA_DRIFT');
		expect(status.schema.production.status).toBe('CURRENT');
		expect(formatCompactManagedStatus(status)).toContain('BEHIND');
		expect(formatCompactManagedStatus(status)).toContain('SCHEMA_DRIFT');
	});

	it('emits timeout-degraded UNREACHABLE/UNVERIFIED without inventing healthy statuses', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'CURRENT'),
				preview: envStatus('preview', 'CURRENT'),
				production: envStatus('production', 'CURRENT'),
			},
			totalDefinitionsCount: 1,
		});
		mockedGeneral.mockImplementation(() => new Promise(() => undefined));

		const result = await runCompactManagedStatusSafe({
			slug: 'romina-rios-chaparro',
			timeoutMs: 80,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.status.timeoutDegraded).toBe(true);
			expect(result.status.content.local.status).toBe('UNREACHABLE');
			expect(result.status.schema.local.status).toBe('UNVERIFIED');
			expect(result.status.content.local.status).not.toBe('MATCH_CANONICAL');
			expect(result.status.schema.local.status).not.toBe('CURRENT');
			expect(formatCompactManagedStatus(result.status)).toContain('UNREACHABLE');
			expect(formatCompactManagedStatus(result.status)).toContain('SCHEMA_UNVERIFIED');
		}
	});

	it('never uses historical healthy fallback for compact status', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'UNVERIFIED', {
					configured: true,
					reachable: false,
					errorDetail: 'timeout degraded',
				}),
				preview: envStatus('preview', 'UNVERIFIED', {
					configured: true,
					reachable: false,
				}),
				production: envStatus('production', 'UNVERIFIED', {
					configured: true,
					reachable: false,
				}),
			},
			totalDefinitionsCount: 0,
		});
		const status = await evaluateCompactManagedStatus();
		expect(status.schema.local.status).toBe('UNVERIFIED');
		expect(status.content.local.status).toBe('UNREACHABLE');
		expect(Object.values(status.schema).every((s) => s.status !== 'CURRENT')).toBe(true);
	});
});
