/**
 * db-sync CLI subprocess/contract tests — non-TTY, JSON routing, exit codes, redaction.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockOrchestrate = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@inquirer/prompts', () => ({
	confirm: jest.fn(),
	select: jest.fn(),
}));

jest.mock('../../scripts/db/db-sync-orchestrator.ts', () => ({
	orchestrateDbSync: (...args: unknown[]) => mockOrchestrate(...args),
}));

describe('db-sync CLI', () => {
	const originalEnv = { ...process.env };
	let stdout = '';
	let stderr = '';
	let writeOut: (chunk: string | Uint8Array) => boolean;
	let writeErr: (chunk: string | Uint8Array) => boolean;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		process.env = { ...originalEnv };
		stdout = '';
		stderr = '';
		writeOut = process.stdout.write.bind(process.stdout);
		writeErr = process.stderr.write.bind(process.stderr);
		process.stdout.write = ((chunk: string | Uint8Array) => {
			stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
			return true;
		}) as typeof process.stdout.write;
		process.stderr.write = ((chunk: string | Uint8Array) => {
			stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
			return true;
		}) as typeof process.stderr.write;
		Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
		Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.stdout.write = writeOut;
		process.stderr.write = writeErr;
		process.exitCode = undefined;
	});

	it('rejects non-TTY interactive default without explicit mode', async () => {
		const { runDbSyncCli } = await import('../../scripts/db/db-sync-cli.ts');
		await runDbSyncCli([]);
		expect(stderr).toMatch(/NON_INTERACTIVE_REQUIRED/);
		expect(process.exitCode).toBe(1);
		expect(mockOrchestrate).not.toHaveBeenCalled();
	});

	it('requires --apply for apply mode', async () => {
		const { runDbSyncCli } = await import('../../scripts/db/db-sync-cli.ts');
		await runDbSyncCli([
			'apply',
			'--direction',
			'production-to-preview-mirror',
			'--expected-plan',
			'abc',
			'--no-interactive',
		]);
		expect(stderr).toMatch(/APPLY_FLAG_REQUIRED/);
		expect(process.exitCode).toBe(1);
		expect(mockOrchestrate).not.toHaveBeenCalled();
	});

	it('writes JSON-only stdout and keeps human diagnostics on stderr', async () => {
		const secret =
			'postgresql://postgres:super-secret-password@db.example.supabase.co:5432/postgres';
		mockOrchestrate.mockResolvedValue({
			schemaVersion: '1.0.0',
			command: 'db:sync',
			mode: 'diagnose',
			direction: null,
			planId: null,
			ok: false,
			status: 'BLOCKED',
			targets: [
				{
					environment: 'preview',
					available: false,
					reason: 'CREDENTIALS_REQUIRED',
					redactedIdentity: 'preview:postgresql://user:<redacted>@host:5432/postgres',
				},
			],
			evidenceClass: 'mixed',
			drifts: [],
			failures: [`preview unavailable near ${secret}`],
			artifacts: [],
			blockers: ['preview: CREDENTIALS_REQUIRED'],
		});

		const { runDbSyncCli } = await import('../../scripts/db/db-sync-cli.ts');
		await runDbSyncCli(['diagnose', '--json', '--no-interactive', '--strict']);

		expect(stdout.trim().startsWith('{')).toBe(true);
		const parsed = JSON.parse(stdout) as { command: string; mode: string; ok: boolean };
		expect(parsed.command).toBe('db:sync');
		expect(parsed.mode).toBe('diagnose');
		expect(parsed.ok).toBe(false);
		expect(stdout).not.toContain('super-secret-password');
		expect(stderr).toBe('');
		expect(process.exitCode).toBe(1);
	});

	it('maps unknown arguments to exit 1 on stderr', async () => {
		const { runDbSyncCli } = await import('../../scripts/db/db-sync-cli.ts');
		await runDbSyncCli(['diagnose', '--bogus', '--no-interactive']);
		expect(stderr).toMatch(/Unknown argument/);
		expect(process.exitCode).toBe(1);
	});

	it('rejects forbidden direction before orchestration', async () => {
		const { runDbSyncCli } = await import('../../scripts/db/db-sync-cli.ts');
		await runDbSyncCli(['plan', '--direction', 'preview-to-production', '--no-interactive']);
		expect(stderr).toMatch(/FORBIDDEN_DIRECTION/);
		expect(mockOrchestrate).not.toHaveBeenCalled();
		expect(process.exitCode).toBe(1);
	});
});
