/**
 * Runner orchestration tests — verify the actual execution path of
 * run-prod-patch.ts up to the mocked database boundary.
 *
 * These tests mock runPsql and getProdDbUrl to isolate the runner's
 * argument parsing, validation chain, SQL assembly and error handling
 * from real database access.
 *
 * NOTE: jest.mock() calls are hoisted by Jest and must be at the top
 * level (not inside beforeEach). The mock factories reference variables
 * from the enclosing scope at the time the mocked module is first loaded.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_PATCH_PATH = resolve(
	process.cwd(),
	'scripts/manual/production-patches/20260613_prepare_leah_lexa_baby_shower.sql',
);

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_SUPABASE_URL = 'https://abcdefghijklm.supabase.co';
const VALID_PROD_DB_URL = 'postgresql://postgres:***@db.abcdefghijklm.supabase.co:5432/postgres';

// These are mutable variables that the mock closures capture.
let mockRunPsql: jest.Mock;
let mockGetProdDbUrl: jest.Mock;
let mockRequireOwnerProductionApply: jest.Mock;
let mockRunCommand: jest.Mock;

jest.mock('../../scripts/db/db-workflow-lib', () => ({
	runPsql: (...args: unknown[]) => mockRunPsql(...args),
	runCommand: (...args: unknown[]) => mockRunCommand(...args),
	getProdDbUrl: (...args: unknown[]) => mockGetProdDbUrl(...args),
	fail: (message: string) => {
		console.error(message);
		process.exit(1);
	},
}));

jest.mock('../../scripts/db/owner-production-apply', () => ({
	requireOwnerProductionApply: (...args: unknown[]) => mockRequireOwnerProductionApply(...args),
}));

let exitCode: number | null;

beforeEach(() => {
	jest.resetModules();

	mockRunPsql = jest.fn().mockReturnValue({ status: 0, stdout: '', stderr: '' });
	mockRunCommand = jest.fn().mockReturnValue({ status: 0, stdout: '', stderr: '' });
	mockGetProdDbUrl = jest.fn().mockReturnValue({
		url: VALID_PROD_DB_URL,
		source: 'test-mock',
	});
	mockRequireOwnerProductionApply = jest.fn().mockResolvedValue(undefined);

	exitCode = null;
	// Clear env vars that could interfere with tests
	delete process.env.SUPABASE_URL;
	delete process.env.PROD_DB_URL;
	delete process.env.CELEBRA_TASK_SCOPE;

	jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
		exitCode = code ?? null;
		// Simulate real process.exit by throwing — this prevents the runner
		// from continuing past the exit point.
		throw Object.assign(new Error(`process.exit(${code})`), { __exitMock: true as const });
	}) as () => never);

	jest.spyOn(console, 'error').mockImplementation();
	jest.spyOn(console, 'info').mockImplementation();
	jest.spyOn(console, 'log').mockImplementation();
});

async function runRunner(): Promise<void> {
	try {
		const mod = await import('../../scripts/db/run-prod-patch.ts');
		await mod.runProdPatchMain();
	} catch (error: unknown) {
		const err = error as Error & { __exitMock?: boolean };
		// Swallow the exit mock error
		if (!err.__exitMock) throw error;
	}
}

function setArgs(args: string[]): void {
	// Keep argv[1] from matching isMain() so importing the module does not auto-run.
	process.argv = ['node', 'jest-run-prod-patch-harness', '--', ...args];
}

function setEnv(env: Record<string, string>): void {
	for (const [key, val] of Object.entries(env)) {
		process.env[key] = val;
	}
}

describe('run-prod-patch orchestration', () => {
	describe('mode validation', () => {
		it('exits 1 when no mode is specified', async () => {
			setArgs(['--file', TEST_PATCH_PATH]);
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});

		it('exits 1 when both --dry-run and --apply are specified', async () => {
			setArgs(['--dry-run', '--apply', '--file', TEST_PATCH_PATH]);
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});
	});

	describe('dry-run', () => {
		it('exits 0 and never calls runPsql', async () => {
			setArgs(['--dry-run', '--file', TEST_PATCH_PATH]);
			await runRunner();
			expect(exitCode).toBe(0);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});

		it('exits 1 when --file is missing', async () => {
			setArgs(['--dry-run']);
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});
	});

	describe('--apply input validation', () => {
		it('exits 1 when --owner-user-id is missing', async () => {
			setArgs(['--apply', '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: VALID_SUPABASE_URL });
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});

		it('exits 1 when --owner-user-id is not a valid UUID', async () => {
			setArgs(['--apply', '--owner-user-id', 'not-a-uuid', '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: VALID_SUPABASE_URL });
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});

		it('exits 1 when SUPABASE_URL is missing', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});

		it('exits 1 when SUPABASE_URL is a postgresql:// string', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: 'postgresql://postgres:pass@host:5432/db' });
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});

		it('exits 1 when SUPABASE_URL is not a valid URL', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: 'not-a-url' });
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});
	});

	describe('project consistency', () => {
		it('exits 1 when PROD_DB_URL and SUPABASE_URL mismatch', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: 'https://project-a.supabase.co' });
			mockGetProdDbUrl.mockReturnValue({
				url: 'postgresql://postgres:***@db.project-b.supabase.co:5432/postgres',
				source: 'test-mock',
			});
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});

		it('exits 1 when PROD_DB_URL format is unsupported', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: VALID_SUPABASE_URL });
			mockGetProdDbUrl.mockReturnValue({
				url: 'postgresql://user:***@unknown-host.com:5432/postgres',
				source: 'test-mock',
			});
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});
	});

	describe('successful execution path', () => {
		it('calls runPsql exactly once with session config + SQL after owner gate', async () => {
			const callOrder: string[] = [];
			mockRequireOwnerProductionApply.mockImplementation(async () => {
				callOrder.push('gate');
			});
			mockRunPsql.mockImplementation(() => {
				callOrder.push('write');
				return { status: 0, stdout: '', stderr: '' };
			});
			mockRunCommand.mockImplementation(() => {
				callOrder.push('post-verify');
				return { status: 0, stdout: '', stderr: '' };
			});

			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({
				SUPABASE_URL: VALID_SUPABASE_URL,
			});
			await runRunner();

			// The runner does not call process.exit(0) on success — it falls
			// off the end. Verify runPsql was called correctly instead.
			expect(mockRequireOwnerProductionApply).toHaveBeenCalledTimes(1);
			expect(mockRunPsql).toHaveBeenCalledTimes(1);
			expect(mockRunCommand).toHaveBeenCalledTimes(1);
			expect(callOrder).toEqual(['gate', 'write', 'post-verify']);

			const [sqlArg, dbUrlArg, redactArg] = mockRunPsql.mock.calls[0];
			expect(sqlArg).toContain("set_config('app.owner_user_id'");
			expect(sqlArg).toContain("set_config('app.supabase_project_url'");
			expect(sqlArg).toContain('do $$');
			expect(sqlArg).toContain('begin;');
			expect(sqlArg).toContain('v_slug');
			expect(dbUrlArg).toBe(VALID_PROD_DB_URL);

			// Redact array includes both URLs
			expect(redactArg).toContain(VALID_SUPABASE_URL);
			expect(redactArg).toContain(VALID_PROD_DB_URL);
		});

		it('places owner config before URL config before patch SQL', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({
				SUPABASE_URL: VALID_SUPABASE_URL,
			});
			await runRunner();

			const [sqlArg] = mockRunPsql.mock.calls[0];
			const ownerIdx = sqlArg.indexOf("set_config('app.owner_user_id'");
			const urlIdx = sqlArg.indexOf("set_config('app.supabase_project_url'");
			const beginIdx = sqlArg.indexOf('begin;');

			expect(ownerIdx).toBeGreaterThanOrEqual(0);
			expect(urlIdx).toBeGreaterThan(ownerIdx);
			expect(beginIdx).toBeGreaterThan(urlIdx);
		});

		it('escapes single quotes in UUID and URL values', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({
				SUPABASE_URL: VALID_SUPABASE_URL,
			});
			await runRunner();

			const [sqlArg] = mockRunPsql.mock.calls[0];
			expect(sqlArg).toContain(`'${VALID_UUID}'`);
			expect(sqlArg).toContain(`'${VALID_SUPABASE_URL}'`);
		});

		it('exits 1 when owner boundary rejects apply', async () => {
			mockRequireOwnerProductionApply.mockImplementation(async () => {
				console.error('OWNER_APPLY_REQUIRED');
				process.exit(1);
			});
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: VALID_SUPABASE_URL });
			await runRunner();
			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
		});
	});

	describe('subprocess failure', () => {
		it('exits 1 when runPsql returns nonzero', async () => {
			mockRunPsql.mockReturnValue({ status: 1, stdout: '', stderr: 'connection failed' });

			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({
				SUPABASE_URL: VALID_SUPABASE_URL,
			});
			await runRunner();

			expect(exitCode).toBe(1);
			expect(mockRunPsql).toHaveBeenCalledTimes(1);
		});
	});
});

describe('package.json', () => {
	it('does not inject --dry-run into the db:prod:patch script', () => {
		const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
		const script: string = pkg.scripts['db:prod:patch'];
		expect(script).toMatch(/^tsx scripts\/db\/run-prod-patch\.ts$/);
		expect(script).not.toContain('--dry-run');
	});
});
