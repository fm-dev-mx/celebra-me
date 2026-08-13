/**
 * Preview migrate: default read-only preflight; --apply requires Preview auth
 * before the first schema write. Goes through the shared orchestrator.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type CommandResult = { status: number; stdout: string; stderr: string };

const mockRunCommand = jest.fn<(...args: unknown[]) => CommandResult>(() => ({
	status: 0,
	stdout: '',
	stderr: '',
}));
const mockRunPsql = jest.fn<(...args: unknown[]) => CommandResult>(() => ({
	status: 0,
	stdout: '20260101000000\n',
	stderr: '',
}));
const mockGetSecret = jest.fn<(...args: unknown[]) => string>(
	() => 'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres',
);
const mockAuthorizePreviewWriteApply = jest.fn<
	(...args: unknown[]) => Promise<{
		authorized: true;
		actor: 'automated_scoped_token';
	}>
>(async () => ({
	authorized: true as const,
	actor: 'automated_scoped_token' as const,
}));
const mockEvaluateCompat = jest.fn<(...args: unknown[]) => unknown>(() => ({
	compatibility: {
		status: 'allow' as const,
		reasons: ['ok'],
		phaseByVersion: { '20260804000000': 'expand' as const },
	},
	readiness: { status: 'allow' as const, reasons: ['ok'], phaseByVersion: {} },
	targetReleaseSha: 'abc1234',
	deployedAppSha: null,
	deployedAppCapabilities: [] as string[],
	phaseByVersion: { '20260804000000': 'expand' as const },
}));

const PREVIEW_DB_URL =
	'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres';

jest.mock('../../scripts/db/db-workflow-lib', () => ({
	fail: (message: string) => {
		throw new Error(message);
	},
	runCommand: (...args: unknown[]) => mockRunCommand(...args),
	runPsql: (...args: unknown[]) => mockRunPsql(...args),
	redactDbUrl: (url: string) => url.replace(/:[^:@/]+@/, ':***@'),
	getPreviewDbUrl: () => ({
		url: PREVIEW_DB_URL,
		source: 'environment variable PREVIEW_DB_URL',
	}),
	assertPreviewDbUrl: (url: string) => new URL(url),
}));

jest.mock('../../scripts/db/db-guard', () => ({
	PREVIEW_SECRET_FILES: ['.env.preview.local'],
	getSecretFromEnvOrFiles: (...args: unknown[]) => mockGetSecret(...args),
}));

jest.mock('../../scripts/db/migrate-compatibility', () => ({
	evaluateHostedCompatibilityForPlan: (input: unknown) => mockEvaluateCompat(input),
	assertHostedCompatibilityOrFail: () => undefined,
	logHostedCompatibility: () => undefined,
	toPlanCompatibility: (result: {
		compatibility: { status: string; reasons: string[] };
		readiness: { status: string; reasons: string[] };
	}) => ({
		compatibilityStatus:
			result.compatibility.status === 'allow' && result.readiness.status === 'allow'
				? 'allow'
				: result.readiness.status === 'environment_not_ready'
					? 'environment_not_ready'
					: 'block',
		compatibilityReasons: [...result.compatibility.reasons, ...result.readiness.reasons],
	}),
}));

jest.mock('../../scripts/db/migration-pending-set', () => ({
	extractPendingMigrationVersions: () => ['20260804000000'],
	comparePendingSetToExpected: () => ({ ok: true }),
}));

jest.mock('../../scripts/provision/preview-write-auth', () => ({
	authorizePreviewWriteApply: (...args: unknown[]) => mockAuthorizePreviewWriteApply(...args),
}));

jest.mock('../../scripts/db/release-check', () => ({
	readGitWorktreeState: () => ({ sha: 'abc1234', clean: true, dirtySummary: '' }),
	assertCleanGitWorktree: () => 'abc1234',
}));

jest.mock('../../scripts/db/disposable-migration-proof', () => ({
	requireCurrentDisposableMigrationProof: () => ({
		version: 1,
		createdAt: '2026-08-06T00:00:00.000Z',
		sourceHead: 'abc1234',
		migrationSetDigest: 'mockdigest',
		appliedVersions: ['20260804000000'],
		target: 'disposable-test',
		maxVersion: null,
	}),
}));

// Keep Preview tests off the Production policy → audit-db → disposable import chain.
jest.mock('../../scripts/db/migrate-policy-production.ts', () => ({
	productionMigratePolicy: {
		target: 'production',
		resolveContext: () => {
			throw new Error('production policy unused in preview migrate tests');
		},
		buildPlan: () => {
			throw new Error('production policy unused in preview migrate tests');
		},
		authorize: async () => undefined,
		beforeWrite: () => undefined,
		execute: () => undefined,
		afterWrite: () => undefined,
	},
}));

describe('preview migrate via shared orchestrator', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		process.env = { ...originalEnv };
		delete process.env.CELEBRA_TASK_SCOPE;
		Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
		Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
		Object.defineProperty(process.stderr, 'isTTY', { value: false, configurable: true });

		mockRunCommand.mockImplementation((...args: unknown[]) => {
			const cmdArgs = (args[1] as string[] | undefined) ?? [];
			if (cmdArgs.includes('--dry-run')) {
				return { status: 0, stdout: 'Would apply 20260804000000_x.sql', stderr: '' };
			}
			if (cmdArgs.includes('--yes')) {
				return { status: 0, stdout: 'Applied', stderr: '' };
			}
			if (cmdArgs.some((arg) => arg.endsWith('verify-mutation-schema-contract.ts'))) {
				return {
					status: 0,
					stdout: 'Mutation schema contract verified for preview.\n',
					stderr: '',
				};
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
		const { preflightMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		preflightMigrate({
			target: 'preview',
			mode: 'preflight',
			expectedPin: null,
		});

		expect(mockEvaluateCompat).toHaveBeenCalled();
		expect(mockAuthorizePreviewWriteApply).not.toHaveBeenCalled();
		const pushCalls = mockRunCommand.mock.calls.filter((call) => {
			const cmdArgs = (call[1] as string[] | undefined) ?? [];
			return call[0] === 'supabase' && cmdArgs.includes('--yes');
		});
		expect(pushCalls).toHaveLength(0);
	});

	it('requires Preview authorization before --apply push', async () => {
		const callOrder: string[] = [];
		mockAuthorizePreviewWriteApply.mockImplementation(async () => {
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
			if (cmdArgs.some((arg) => arg.endsWith('verify-mutation-schema-contract.ts'))) {
				callOrder.push('verify');
				return {
					status: 0,
					stdout: 'Mutation schema contract verified for preview.\n',
					stderr: '',
				};
			}
			return { status: 0, stdout: '', stderr: '' };
		});

		process.env.CELEBRA_TASK_SCOPE = 'preview:schema:migrate';
		const { orchestrateMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		await orchestrateMigrate({
			target: 'preview',
			mode: 'apply',
			expectedPin: null,
			remindConcurrencyRisk: false,
			isInteractive: false,
		});

		expect(mockAuthorizePreviewWriteApply).toHaveBeenCalled();
		const authArg = mockAuthorizePreviewWriteApply.mock.calls[0]?.[0] as
			{ slug: string; operation: string } | undefined;
		expect(authArg).toMatchObject({
			slug: 'schema',
			operation: 'migrate',
		});
		expect(callOrder.indexOf('auth')).toBeLessThan(callOrder.indexOf('write'));
		expect(callOrder).toContain('write');
	});
});
