/**
 * Preview migrate: default read-only preflight; --apply requires Preview auth
 * before the first schema write.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRunCommand = jest.fn((..._args: unknown[]) => ({
	status: 0,
	stdout: '',
	stderr: '',
}));
const mockRunPsql = jest.fn((..._args: unknown[]) => ({
	status: 0,
	stdout: '20260101000000\n20260804000000\n',
	stderr: '',
}));
const mockGetSecret = jest.fn(
	(..._args: unknown[]) =>
		'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres',
);
const mockCompatGate = jest.fn((..._args: unknown[]) => undefined);
const mockAuthorizePreviewWriteApply = jest.fn(async (..._args: unknown[]) => ({
	authorized: true as const,
	actor: 'automated_scoped_token' as const,
}));

jest.mock('../../scripts/db/db-workflow-lib', () => ({
	fail: (message: string) => {
		throw new Error(message);
	},
	runCommand: (...args: unknown[]) => mockRunCommand(...args),
	runPsql: (...args: unknown[]) => mockRunPsql(...args),
}));

jest.mock('../../scripts/db/db-guard', () => ({
	PREVIEW_SECRET_FILES: ['.env.preview.local'],
	getSecretFromEnvOrFiles: (...args: unknown[]) => mockGetSecret(...args),
}));

jest.mock('../../scripts/db/hosted-migration-compatibility-gate', () => ({
	runHostedMigrationCompatibilityGate: (...args: unknown[]) => mockCompatGate(...args),
}));

jest.mock('../../scripts/db/migration-pending-set', () => ({
	extractPendingMigrationVersions: () => ['20260804000000'],
	comparePendingSetToExpected: () => ({ ok: true, errors: [] }),
	parseMigrationVersionList: (raw: string) =>
		raw
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean),
}));

jest.mock('../../scripts/provision/preview-write-auth', () => ({
	authorizePreviewWriteApply: (...args: unknown[]) => mockAuthorizePreviewWriteApply(...args),
	verifyPreviewWriteAuthorization: jest.fn(),
}));

describe('push-preview-migrations apply gate', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		process.env = { ...originalEnv };
		delete process.env.CELEBRA_TASK_SCOPE;
		Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
		Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

		mockRunCommand.mockImplementation((...args: unknown[]) => {
			const cmdArgs = (args[1] as string[] | undefined) ?? [];
			if (cmdArgs.includes('--dry-run')) {
				return { status: 0, stdout: 'pending', stderr: '' };
			}
			if (cmdArgs.includes('--yes')) {
				return { status: 0, stdout: 'Applied', stderr: '' };
			}
			if (cmdArgs.includes('verify-mutation-schema-contract.ts')) {
				return { status: 0, stdout: '', stderr: '' };
			}
			return { status: 0, stdout: '', stderr: '' };
		});
		mockRunPsql.mockReturnValue({
			status: 0,
			stdout: '20260101000000\n20260804000000\n',
			stderr: '',
		});
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it('exits read-only without --apply and never pushes or authorizes', async () => {
		const { main } = await import('../../scripts/db/push-preview-migrations.ts');
		await main(['node', 'push-preview-migrations.ts']);

		expect(mockCompatGate).toHaveBeenCalled();
		expect(mockAuthorizePreviewWriteApply).not.toHaveBeenCalled();
		const pushCalls = mockRunCommand.mock.calls.filter((call) => {
			const cmdArgs = (call[1] as string[] | undefined) ?? [];
			return call[0] === 'supabase' && cmdArgs.includes('--yes');
		});
		expect(pushCalls).toHaveLength(0);
	});

	it('requires Preview authorization before --apply push', async () => {
		const callOrder: string[] = [];
		mockAuthorizePreviewWriteApply.mockImplementation(async (..._args: unknown[]) => {
			callOrder.push('auth');
			return { authorized: true as const, actor: 'automated_scoped_token' as const };
		});
		mockRunCommand.mockImplementation((...args: unknown[]) => {
			const cmdArgs = (args[1] as string[] | undefined) ?? [];
			if (cmdArgs.includes('--dry-run')) {
				return { status: 0, stdout: 'pending', stderr: '' };
			}
			if (cmdArgs.includes('--yes')) {
				callOrder.push('write');
				return { status: 0, stdout: 'Applied', stderr: '' };
			}
			if (cmdArgs.includes('verify-mutation-schema-contract.ts')) {
				callOrder.push('verify');
				return { status: 0, stdout: '', stderr: '' };
			}
			return { status: 0, stdout: '', stderr: '' };
		});

		process.env.CELEBRA_TASK_SCOPE = 'preview:schema:migrate';
		const { main } = await import('../../scripts/db/push-preview-migrations.ts');
		await main(['node', 'push-preview-migrations.ts', '--apply']);

		expect(mockAuthorizePreviewWriteApply).toHaveBeenCalled();
		const authArg = mockAuthorizePreviewWriteApply.mock.calls[0]?.[0] as {
			slug: string;
			operation: string;
		};
		expect(authArg).toMatchObject({
			slug: 'schema',
			operation: 'migrate',
		});
		expect(callOrder[0]).toBe('auth');
		expect(callOrder).toContain('write');
		expect(callOrder.indexOf('auth')).toBeLessThan(callOrder.indexOf('write'));
	});
});
