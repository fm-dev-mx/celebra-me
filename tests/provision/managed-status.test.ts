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
	evaluateInvitationStatus: jest.fn(),
	getOrCreateStatusProbeSession: jest.fn(() => mockSession),
	resetStatusProbeSession: jest.fn(),
}));

jest.mock('../../scripts/provision/invitations/registry.ts', () => ({
	listInvitationDefinitions: jest.fn(),
}));

import {
	evaluateCompactManagedStatus,
	formatCompactManagedStatus,
	runCompactManagedStatusSafe,
} from '../../scripts/provision/managed-status.ts';
import {
	evaluateGeneralStatus,
	evaluateInvitationStatus,
} from '../../scripts/provision/dbs-status.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';

const mockedGeneral = evaluateGeneralStatus as jest.MockedFunction<typeof evaluateGeneralStatus>;
const mockedInvitation = evaluateInvitationStatus as jest.MockedFunction<
	typeof evaluateInvitationStatus
>;
const mockedList = listInvitationDefinitions as jest.MockedFunction<
	typeof listInvitationDefinitions
>;

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

function invitationTarget(
	environment: 'local' | 'preview' | 'production',
	status:
		| 'MATCH_CANONICAL'
		| 'BEHIND_CANONICAL'
		| 'DIVERGED'
		| 'IDENTITY_CONFLICT'
		| 'NOT_PRESENT'
		| 'UNREACHABLE'
		| 'CREDENTIALS_REQUIRED'
		| 'UNVERIFIED',
) {
	return {
		environment,
		status,
		activeMatchCount: status === 'NOT_PRESENT' ? 0 : 1,
		resolvedId: status === 'NOT_PRESENT' ? null : '00000000-0000-4000-8000-000000000001',
		resolvedSlug: 'demo-slug',
		provenanceDefinitionSlug: 'demo-slug',
		provenancePackageHash: 'abc',
		provenanceAppliedAt: null,
		publishedVersion: 1,
		publishedAt: null,
		assetCount: 0,
		detail: status,
	};
}

describe('managed-status compact composition', () => {
	beforeEach(() => {
		mockedGeneral.mockReset();
		mockedInvitation.mockReset();
		mockedList.mockReset();
		mockSession.timeoutDegraded = false;
	});

	it('composes existing schema + per-slug content classifiers without inventing CLEAN', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'CURRENT'),
				preview: envStatus('preview', 'CURRENT'),
				production: envStatus('production', 'CURRENT'),
			},
			totalDefinitionsCount: 1,
		});
		mockedInvitation.mockResolvedValue({
			slug: 'romina-rios-chaparro',
			title: 'Romina',
			eventType: 'xv',
			environments: {
				local: invitationTarget('local', 'MATCH_CANONICAL'),
				preview: invitationTarget('preview', 'BEHIND_CANONICAL'),
				production: invitationTarget('production', 'MATCH_CANONICAL'),
			},
		});

		const status = await evaluateCompactManagedStatus({ slug: 'romina-rios-chaparro' });
		expect(status.readOnly).toBe(true);
		expect(status.contentSlug).toBe('romina-rios-chaparro');
		expect(status.content.local.status).toBe('MATCH_CANONICAL');
		expect(status.content.preview.status).toBe('BEHIND_CANONICAL');
		expect(status.schema.local.status).toBe('CURRENT');
		expect(formatCompactManagedStatus(status)).toContain('CONTENT');
		expect(formatCompactManagedStatus(status)).toContain('BEHIND_CANONICAL');
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
		expect(mockedInvitation).not.toHaveBeenCalled();
		expect(mockedGeneral.mock.calls[0]?.[0]).toMatchObject({ includeManagedCounts: false });
	});

	it('aggregates worst CONTENT across definitions when requested', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'CURRENT'),
				preview: envStatus('preview', 'CURRENT'),
				production: envStatus('production', 'CURRENT'),
			},
			totalDefinitionsCount: 2,
		});
		mockedList.mockReturnValue([{ slug: 'a' } as never, { slug: 'b' } as never]);
		mockedInvitation
			.mockResolvedValueOnce({
				slug: 'a',
				title: 'A',
				eventType: 'xv',
				environments: {
					local: invitationTarget('local', 'MATCH_CANONICAL'),
					preview: invitationTarget('preview', 'MATCH_CANONICAL'),
					production: invitationTarget('production', 'MATCH_CANONICAL'),
				},
			})
			.mockResolvedValueOnce({
				slug: 'b',
				title: 'B',
				eventType: 'xv',
				environments: {
					local: invitationTarget('local', 'DIVERGED'),
					preview: invitationTarget('preview', 'BEHIND_CANONICAL'),
					production: invitationTarget('production', 'MATCH_CANONICAL'),
				},
			});

		const status = await evaluateCompactManagedStatus({ aggregateContent: true });
		expect(status.contentMode).toBe('aggregate');
		expect(status.content.local.status).toBe('DIVERGED');
		expect(status.content.preview.status).toBe('BEHIND_CANONICAL');
		expect(status.content.production.status).toBe('MATCH_CANONICAL');
		expect(status.aggregateSummary).toMatchObject({
			local: {
				classification: 'DRAFT_DIVERGENCE_ONLY',
				total: 2,
				aligned: 1,
				draftDiverged: 1,
			},
			preview: { classification: 'BEHIND_OR_CONFLICTED', total: 2, aligned: 1 },
			production: { classification: 'ALL_ALIGNED', total: 2, aligned: 2 },
		});
		expect(formatCompactManagedStatus(status)).toContain('DRAFT_DIVERGENCE_ONLY');
	});

	it('does not report aggregate alignment when any environment is unverifiable', async () => {
		mockedGeneral.mockResolvedValue({
			environments: {
				local: envStatus('local', 'CURRENT'),
				preview: envStatus('preview', 'UNVERIFIED'),
				production: envStatus('production', 'CURRENT'),
			},
			totalDefinitionsCount: 1,
		});
		mockedList.mockReturnValue([{ slug: 'a' } as never]);
		mockedInvitation.mockResolvedValue({
			slug: 'a',
			title: 'A',
			eventType: 'xv',
			environments: {
				local: invitationTarget('local', 'MATCH_CANONICAL'),
				preview: invitationTarget('preview', 'UNVERIFIED'),
				production: invitationTarget('production', 'MATCH_CANONICAL'),
			},
		});

		const status = await evaluateCompactManagedStatus({ aggregateContent: true });
		expect(status.aggregateSummary?.preview.classification).toBe('UNVERIFIABLE');
		expect(formatCompactManagedStatus(status)).toContain('UNVERIFIABLE');
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
		mockedInvitation.mockImplementation(() => new Promise(() => undefined));

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
