import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	getSecretFromEnvOrFiles: jest.fn(() => ''),
	PREVIEW_SECRET_FILES: ['.env.preview.local'],
	PROJECT_ROOT: process.cwd(),
	runPsql: jest.fn(),
	sqlLiteral: (value: string) => `'${value.replaceAll("'", "''")}'`,
	redactDbUrl: (url: string) => url.replace(/\/\/.*@/, '//***@'),
	classifyDbTarget: jest.fn(),
}));

jest.mock('../../scripts/provision/preview-write-auth.ts', () => ({
	verifyPreviewWriteAuthorization: jest.fn(() => ({
		authorized: true,
		actor: 'automated_scoped_token',
	})),
}));

import { classifyDbTarget, runPsql } from '../../scripts/db/db-workflow-lib.ts';
import { verifyPreviewWriteAuthorization } from '../../scripts/provision/preview-write-auth.ts';
import {
	resolvePreviewPurgeDbUrl,
	runInvitationIdPurge,
} from '../../scripts/provision/invitation-id-purge.ts';

const mockedClassify = classifyDbTarget as jest.MockedFunction<typeof classifyDbTarget>;
const mockedPsql = runPsql as jest.MockedFunction<typeof runPsql>;
const mockedAuth = verifyPreviewWriteAuthorization as jest.MockedFunction<
	typeof verifyPreviewWriteAuthorization
>;

const PREVIEW_URL = 'postgresql://user:pass@db.example.supabase.co:5432/postgres';
const INCORRECT_ID = '07327188-51d8-4b6e-8739-f2b835272386';
const CANONICAL_ID = '03c6a1fc-f663-4551-8fd9-8495eda9cdb2';

function deps(overrides: Record<string, number> = {}) {
	return {
		events: 1,
		drafts: 1,
		published: 1,
		assets: 8,
		assetsActive: 8,
		provenance: 1,
		publicationIdempotency: 4,
		mutationReceipts: 3,
		legacyAdoption: 0,
		intakeRequests: 0,
		sourcedInvitations: 0,
		guests: 1,
		claimCodes: 0,
		memberships: 1,
		guestAudit: 13,
		...overrides,
	};
}

function auditPayload(overrides: Record<string, unknown> = {}) {
	return {
		incorrect: {
			id: INCORRECT_ID,
			slug: 'alba-rosa-quinones',
			title: '70 años de Alba Rosa Quiñones López',
			status: 'published',
			kind: 'client',
			eventType: 'cumple',
			archivedAt: null,
			createdAt: '2026-07-28T16:25:25.065Z',
			updatedAt: '2026-07-30T16:39:09.587Z',
			clientName: 'Lucero Ramírez',
			environment: 'preview',
		},
		canonical: {
			id: CANONICAL_ID,
			slug: 'alba-rosa-quinonez',
			title: '70 años de Alba Rosa Quiñónez López',
			status: 'published',
			kind: 'client',
			eventType: 'cumple',
			archivedAt: null,
			createdAt: '2026-07-31T00:50:04.728Z',
			updatedAt: '2026-08-01T22:57:43.984Z',
			clientName: 'Lucero Ramírez',
			environment: 'preview',
		},
		incorrectDependencies: deps(),
		canonicalDependencies: deps({ guests: 3, guestAudit: 21, publicationIdempotency: 2 }),
		guests: [
			{
				id: '9200c653-2c1b-4924-b645-7931f7e1685e',
				fullName: 'test22',
				hasEmail: false,
				hasPhone: false,
				attendanceStatus: 'declined',
			},
		],
		storageAssetPaths: ['managed/alba-rosa-quinones/family.webp'],
		...overrides,
	};
}

describe('invitation-id-purge', () => {
	beforeEach(() => {
		mockedClassify.mockReset();
		mockedPsql.mockReset();
		mockedAuth.mockClear();
		mockedClassify.mockReturnValue({ target: 'preview', reason: 'preview host' } as never);
	});

	it('rejects production targets', () => {
		mockedClassify.mockReturnValue({ target: 'production', reason: 'prod' } as never);
		expect(() => resolvePreviewPurgeDbUrl({ PREVIEW_DB_URL: 'postgresql://x' })).toThrow(
			/PRODUCTION_REJECTED/,
		);
	});

	it('blocks when IDs collide', () => {
		expect(() =>
			runInvitationIdPurge({
				incorrectInvitationId: INCORRECT_ID,
				canonicalInvitationId: INCORRECT_ID,
				env: { PREVIEW_DB_URL: PREVIEW_URL },
			}),
		).toThrow(/IDS_COLLIDE/);
	});

	it('dry-run audits synthetic guests as non-migrating and writes artifact metadata', () => {
		mockedPsql.mockReturnValueOnce({
			status: 0,
			stdout: JSON.stringify(auditPayload()),
			stderr: '',
		} as never);

		const audit = runInvitationIdPurge({
			incorrectInvitationId: INCORRECT_ID,
			canonicalInvitationId: CANONICAL_ID,
			expectIncorrectSlug: 'alba-rosa-quinones',
			expectCanonicalSlug: 'alba-rosa-quinonez',
			env: { PREVIEW_DB_URL: PREVIEW_URL },
			auditDir: `${process.cwd()}/.tmp/invitation-purge-audits-test`,
		});

		expect(audit.mode).toBe('dry_run');
		expect(audit.blocked).toBe(false);
		expect(audit.migration.required).toBe(false);
		expect(audit.incorrectDependencies.guests).toBe(1);
		expect(audit.deletePlan.tables.some((row) => row.table === 'invitation_publication_idempotency')).toBe(
			true,
		);
		expect(audit.auditArtifactPath).toContain('invitation-id-purge-');
		expect(mockedAuth).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: 'alba-rosa-quinones',
				operation: 'id-purge',
				apply: false,
			}),
		);
	});

	it('blocks dry-run when exclusive non-synthetic guests require migration', () => {
		mockedPsql.mockReturnValueOnce({
			status: 0,
			stdout: JSON.stringify(
				auditPayload({
					guests: [
						{
							id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
							fullName: 'María Pérez',
							hasEmail: true,
							hasPhone: false,
							attendanceStatus: 'confirmed',
						},
					],
				}),
			),
			stderr: '',
		} as never);

		const audit = runInvitationIdPurge({
			incorrectInvitationId: INCORRECT_ID,
			canonicalInvitationId: CANONICAL_ID,
			env: { PREVIEW_DB_URL: PREVIEW_URL },
			auditDir: `${process.cwd()}/.tmp/invitation-purge-audits-test`,
		});

		expect(audit.blocked).toBe(true);
		expect(audit.migration.required).toBe(true);
		expect(audit.deletionResult).toBe('not_executed');
	});
});
