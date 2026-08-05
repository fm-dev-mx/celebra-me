/**
 * Proves db:preview:sync-invitations --dry-run performs zero write side effects
 * for role, profile, table upsert/truncate, Storage upload, and report files.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockResolvePreviewAdminUser = jest.fn(() => 'admin-user-id');
const mockUpdatePreviewAdminRole = jest.fn(() => undefined);
const mockEnsureHostProfile = jest.fn(() => undefined);
const mockWriteReportFile = jest.fn(() => undefined);
const mockUpsertFromJson = jest.fn(() => ({ created: 0 }));
const mockTruncateTable = jest.fn(() => undefined);
const mockSyncAsset = jest.fn(async () => true);
const mockRunPsql = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));
const mockAuthorizePreviewWriteApply = jest.fn(async () => ({
	authorized: true as const,
	actor: 'automated_scoped_token' as const,
}));

jest.mock('../../scripts/db/preview-sync-guards', () => ({
	assertProductionIsProd: jest.fn(),
	assertPreviewIsPreview: jest.fn(),
	assertNotSameProject: jest.fn(),
	assertNotLocalTarget: jest.fn(),
	assertNotDisposableTarget: jest.fn(),
	resolvePreviewAdminUser: mockResolvePreviewAdminUser,
	updatePreviewAdminRole: mockUpdatePreviewAdminRole,
	ensureHostProfile: mockEnsureHostProfile,
	getPreviewSupabaseUrl: () => 'https://iwipdvisoyerfdytuhwi.supabase.co',
	getPreviewServiceRoleKey: () => 'preview-service-role',
	deriveSupabaseUrlFromDbUrl: (url: string) => {
		if (url.includes('ineitkdkyrxqyressllp')) {
			return 'https://ineitkdkyrxqyressllp.supabase.co';
		}
		return 'https://iwipdvisoyerfdytuhwi.supabase.co';
	},
	getProjectRefFromSupabaseUrl: (url: string) =>
		url.includes('ineitkdkyrxqyressllp') ? 'ineitkdkyrxqyressllp' : 'iwipdvisoyerfdytuhwi',
	buildStorageUrl: (supabaseUrl: string) =>
		`${supabaseUrl}/storage/v1/object/public/invitation-assets`,
	rewriteStorageUrl: (content: string) => content,
}));

jest.mock('../../scripts/db/preview-sync-db', () => ({
	queryTableJson: jest.fn(() => []),
	resolveColumns: jest.fn(() => ['id', 'content']),
	countRows: jest.fn(() => 0),
	upsertFromJson: mockUpsertFromJson,
	truncateTable: mockTruncateTable,
}));

jest.mock('../../scripts/db/preview-sync-storage', () => ({
	syncAsset: mockSyncAsset,
}));

jest.mock('../../scripts/db/preview-sync-report', () => ({
	createReport: (dryRun: boolean) => ({
		dryRun,
		startedAt: '2026-08-04T00:00:00.000Z',
		source: '',
		target: '',
		created: {},
		copiedAssets: 0,
		missingAssets: [],
		detectedDrift: [],
		excludedTableCounts: {},
		failures: [],
		status: 'dry-run-pending',
	}),
	printReport: jest.fn(),
	writeReportFile: mockWriteReportFile,
}));

jest.mock('../../scripts/db/db-workflow-lib', () => ({
	fail: (message: string) => {
		throw new Error(message);
	},
	redactDbUrl: (url: string) => url,
	getProdDbUrl: () => ({
		url: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
		source: 'test',
	}),
	runPsql: mockRunPsql,
}));

jest.mock('../../scripts/db/db-guard', () => ({
	PREVIEW_SECRET_FILES: ['.env.preview.local'],
	getSecretFromEnvOrFiles: () =>
		'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres',
}));

jest.mock('../../scripts/provision/preview-write-auth', () => ({
	authorizePreviewWriteApply: mockAuthorizePreviewWriteApply,
	verifyPreviewWriteAuthorization: jest.fn(),
}));

describe('preview-sync dry-run zero writes', () => {
	const originalArgv = process.argv;
	const originalExit = process.exit;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		process.exit = ((code?: number) => {
			throw Object.assign(new Error(`process.exit:${code ?? 0}`), { __exitMock: true });
		}) as typeof process.exit;
	});

	afterEach(() => {
		process.argv = originalArgv;
		process.exit = originalExit;
	});

	it('skips role, profile, upsert, truncate, storage, report, and Preview auth in dry-run', async () => {
		const mod = await import('../../scripts/db/preview-sync-invitations.ts');
		process.argv = ['node', 'jest-preview-sync-dry-run', '--dry-run'];
		try {
			await mod.main();
		} catch (error: unknown) {
			const err = error as Error & { __exitMock?: boolean };
			if (!err.__exitMock) throw error;
		}

		expect(mockResolvePreviewAdminUser).toHaveBeenCalled();
		expect(mockUpdatePreviewAdminRole).not.toHaveBeenCalled();
		expect(mockEnsureHostProfile).not.toHaveBeenCalled();
		expect(mockUpsertFromJson).not.toHaveBeenCalled();
		expect(mockTruncateTable).not.toHaveBeenCalled();
		expect(mockSyncAsset).not.toHaveBeenCalled();
		expect(mockWriteReportFile).not.toHaveBeenCalled();
		expect(mockAuthorizePreviewWriteApply).not.toHaveBeenCalled();
	});

	it('applies role/profile writes only when not dry-run', async () => {
		const mod = await import('../../scripts/db/preview-sync-invitations.ts');
		mod.runPreviewAdminPhase('postgresql://preview', { dryRun: false });
		expect(mockUpdatePreviewAdminRole).toHaveBeenCalledTimes(1);
		expect(mockEnsureHostProfile).toHaveBeenCalledTimes(1);
	});
});
