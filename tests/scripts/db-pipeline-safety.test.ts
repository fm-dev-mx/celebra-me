import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { classifyDbTarget, guardProduction } from '../../scripts/db/db-guard';
import { enforceDisposableTargetOnly } from '../../scripts/db/apply-migrations';
import { evaluateMigrationHistoryParity, fetchRemoteMigrationVersions } from '../../scripts/db/audit-db';

describe('Database Pipeline Safety & Hardening Regression Tests', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
		jest.restoreAllMocks();
	});

	describe('apply-migrations.ts target restrictions', () => {
			function mockProcessExit() {
				jest.spyOn(console, 'error').mockImplementation(() => {});
				return jest.spyOn(process, 'exit').mockImplementation((() => {
					throw new Error('process.exit(1) called');
				}) as unknown as (code?: string | number | null) => never);
			}

			it('blocks production target and exits with code 1', () => {
				const mockExit = mockProcessExit();

				const prodUrl = 'postgresql://postgres:***@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
				expect(() => enforceDisposableTargetOnly(prodUrl)).toThrow('process.exit(1) called');
				expect(mockExit).toHaveBeenCalledWith(1);
			});

			it('blocks persistent-local target and exits with code 1', () => {
				const mockExit = mockProcessExit();

				const localUrl = 'postgresql://postgres:***@127.0.0.1:54322/postgres';
				expect(() => enforceDisposableTargetOnly(localUrl)).toThrow('process.exit(1) called');
				expect(mockExit).toHaveBeenCalledWith(1);
			});

			it('blocks unknown DB URL and exits with code 1', () => {
				const mockExit = mockProcessExit();

				const unknownUrl = 'postgresql://user:***@some-random-host.com:5432/postgres';
				expect(() => enforceDisposableTargetOnly(unknownUrl)).toThrow('process.exit(1) called');
				expect(mockExit).toHaveBeenCalledWith(1);
			});

			it('allows disposable-test environment', () => {
				const mockExit = mockProcessExit();
				const disposableUrl = 'postgresql://postgres:***@127.0.0.1:54332/postgres';
				expect(() => enforceDisposableTargetOnly(disposableUrl)).not.toThrow();
				expect(mockExit).not.toHaveBeenCalled();
			});
	});

	describe('db-guard.ts production migration rules', () => {
		const prodUrl = 'postgresql://postgres:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
		const prodClassification = classifyDbTarget(prodUrl);

		it('blocks migrate operation when no CONFIRM_PROD_MIGRATION env is set', () => {
			delete process.env.CONFIRM_PROD_MIGRATION;
			delete process.env.ALLOW_PROD_MIGRATE;

			const result = guardProduction(prodClassification, 'migrate');
			expect(result.ok).toBe(false);
			expect(result.errors[0]).toContain('PRODUCTION WRITE BLOCKED');
		});

		it('rejects broad ALLOW_PROD_MIGRATE=true bypass without host confirmation', () => {
			process.env.ALLOW_PROD_MIGRATE = 'true';
			delete process.env.CONFIRM_PROD_MIGRATION;

			const result = guardProduction(prodClassification, 'migrate');
			expect(result.ok).toBe(false);
			expect(result.errors[0]).toContain('PRODUCTION WRITE BLOCKED');
		});

		it('rejects CONFIRM_PROD_MIGRATION when target host does not match', () => {
			process.env.CONFIRM_PROD_MIGRATION = 'MIGRATE wrong-host.supabase.com';

			const result = guardProduction(prodClassification, 'migrate');
			expect(result.ok).toBe(false);
			expect(result.errors[0]).toContain('PRODUCTION WRITE BLOCKED');
		});

		it('permits migrate operation ONLY when CONFIRM_PROD_MIGRATION matches exact host', () => {
			process.env.CONFIRM_PROD_MIGRATION = 'MIGRATE aws-0-us-west-2.pooler.supabase.com';

			const result = guardProduction(prodClassification, 'migrate');
			expect(result.ok).toBe(true);
			expect(result.errors.length).toBe(0);
		});
	});

	describe('Strict migration filename pattern validation', () => {
		const pattern = /^(\d{14})_([a-zA-Z0-9_-]+)\.sql$/;

		it('validates correct migration filenames', () => {
			expect(pattern.test('20260718145003_configurable_rsvp_attendee_limits.sql')).toBe(true);
			expect(pattern.test('20260608000001_correct_icon_migration_preflight.sql')).toBe(true);
		});

		it('rejects invalid migration filenames', () => {
			expect(pattern.test('bad_filename.sql')).toBe(false);
			expect(pattern.test('20260718_short_timestamp.sql')).toBe(false);
			expect(pattern.test('20260718145003_name_with_space .sql')).toBe(false);
			expect(pattern.test('20260718145003_injection;drop table.sql')).toBe(false);
		});
	});

	describe('evaluateMigrationHistoryParity target-aware migration audit rules', () => {
		const expected = ['20260601000000', '20260602000000', '20260603000000'];

		it('detects 100% exact alignment', () => {
			const remote = ['20260601000000', '20260602000000', '20260603000000'];
			const result = evaluateMigrationHistoryParity(expected, remote);
			expect(result.isAligned).toBe(true);
			expect(result.pendingLocal.length).toBe(0);
			expect(result.extraRemote.length).toBe(0);
			expect(result.isReordered).toBe(false);
			expect(result.hasDivergentHistory).toBe(false);
		});

		it('detects missing local migrations on target', () => {
			const remote = ['20260601000000'];
			const result = evaluateMigrationHistoryParity(expected, remote);
			expect(result.isAligned).toBe(false);
			expect(result.pendingLocal).toEqual(['20260602000000', '20260603000000']);
		});

		it('detects additional remote migrations not in local workspace', () => {
			const remote = ['20260601000000', '20260602000000', '20260603000000', '20260699000000'];
			const result = evaluateMigrationHistoryParity(expected, remote);
			expect(result.isAligned).toBe(false);
			expect(result.extraRemote).toEqual(['20260699000000']);
		});

		it('detects reordered migration execution order', () => {
			const remote = ['20260602000000', '20260601000000', '20260603000000'];
			const result = evaluateMigrationHistoryParity(expected, remote);
			expect(result.isAligned).toBe(false);
			expect(result.isReordered).toBe(true);
		});

		it('detects same latest version but divergent historical sequence', () => {
			const remote = ['20260601000000', '20260603000000']; // missing 20260602000000
			const result = evaluateMigrationHistoryParity(expected, remote);
			expect(result.isAligned).toBe(false);
			expect(result.hasDivergentHistory).toBe(true);
			expect(result.pendingLocal).toEqual(['20260602000000']);
		});
	});

	describe('fetchRemoteMigrationVersions fresh preview and error handling', () => {
		const testUrl = 'postgresql://user:pass@127.0.0.1:54322/postgres';

		it('handles exact missing migration-history relation as empty history for uninitialized preview', () => {
			const mockRunner = jest.fn(() => ({
				status: 1,
				stdout: '',
				stderr: 'ERROR:  42P01: relation "supabase_migrations.schema_migrations" does not exist\nLOCATION:  parserOpenTable, parse_relation.c:1396',
			}));
			const result = fetchRemoteMigrationVersions(testUrl, mockRunner as any);
			expect(result.isUninitialized).toBe(true);
			expect(result.remoteVersions).toEqual([]);
		});

		it('fails closed on unrelated 42P01 relation missing error', () => {
			const mockRunner = jest.fn(() => ({
				status: 1,
				stdout: '',
				stderr: 'ERROR:  42P01: relation "public.other_table" does not exist',
			}));
			expect(() => fetchRemoteMigrationVersions(testUrl, mockRunner as any)).toThrow(
				'Failed to query schema_migrations table',
			);
		});

		it('fails closed on connection or permission failure', () => {
			const mockRunnerConn = jest.fn(() => ({
				status: 1,
				stdout: '',
				stderr: 'psql: error: connection to server at "127.0.0.1" failed: Connection refused',
			}));
			expect(() => fetchRemoteMigrationVersions(testUrl, mockRunnerConn as any)).toThrow(
				'Failed to query schema_migrations table',
			);

			const mockRunnerPerm = jest.fn(() => ({
				status: 1,
				stdout: '',
				stderr: 'ERROR: permission denied for schema supabase_migrations',
			}));
			expect(() => fetchRemoteMigrationVersions(testUrl, mockRunnerPerm as any)).toThrow(
				'Failed to query schema_migrations table',
			);
		});

		it('parses existing empty migration-history table as normal empty history', () => {
			const mockRunner = jest.fn(() => ({
				status: 0,
				stdout: '',
				stderr: '',
			}));
			const result = fetchRemoteMigrationVersions(testUrl, mockRunner as any);
			expect(result.isUninitialized).toBe(false);
			expect(result.remoteVersions).toEqual([]);
		});
	});
});
