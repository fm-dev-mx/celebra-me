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
	'scripts/manual/production-patches/20260812_thankyou_editorial_back_cover_structural_contracts.sql',
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

	describe('direct apply rejection', () => {
		it('rejects --apply before opening a database connection or owner gate', async () => {
			setArgs(['--apply', '--owner-user-id', VALID_UUID, '--file', TEST_PATCH_PATH]);
			setEnv({ SUPABASE_URL: VALID_SUPABASE_URL });
			await runRunner();

			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
			expect(mockGetProdDbUrl).not.toHaveBeenCalled();
			expect(mockRequireOwnerProductionApply).not.toHaveBeenCalled();
			expect(mockRunCommand).not.toHaveBeenCalled();
		});

		it('rejects mixed --dry-run and --apply without falling back to lint-only success', async () => {
			setArgs(['--dry-run', '--apply', '--file', TEST_PATCH_PATH]);
			await runRunner();

			expect(exitCode).toBe(1);
			expect(mockRunPsql).not.toHaveBeenCalled();
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
