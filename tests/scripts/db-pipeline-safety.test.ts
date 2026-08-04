import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { classifyDbTarget, guardProduction } from '../../scripts/db/db-guard';
import { enforceDisposableTargetOnly } from '../../scripts/db/apply-migrations';
import { evaluateMigrationHistoryParity } from '../../scripts/db/audit-db';
import { fetchRemoteMigrationVersions } from '../../scripts/status-core/migration-history-reader';
import {
	DISPOSABLE_DB_URL,
	LOCAL_DB_URL,
	parseDbUrl,
	PERSISTENT_LOCAL,
	DISPOSABLE_TEST,
	PREVIEW_SECRET_FILES,
	PROD_SECRET_FILES,
	redactCredentials,
	redactDbUrl,
	resolveDbUrl,
} from '../../scripts/db/db-target-config';

describe('Database Pipeline Safety & Hardening Regression Tests', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
		jest.restoreAllMocks();
	});

	describe('Canonical Database Reference Isolation & Target Classification', () => {
		it('ensures DISPOSABLE_DB_URL is a valid postgresql URL pointing to port 54332', () => {
			const url = new URL(DISPOSABLE_DB_URL);
			expect(url.protocol).toBe('postgresql:');
			expect(url.port).toBe('54332');
			expect(url.pathname).toBe('/postgres');
		});

		it('ensures LOCAL_DB_URL is a valid postgresql URL pointing to port 54322', () => {
			const url = new URL(LOCAL_DB_URL);
			expect(url.protocol).toBe('postgresql:');
			expect(url.port).toBe('54322');
			expect(url.pathname).toBe('/postgres');
		});

		it('classifies PREVIEW_DB_URL host matching preview secret as preview target', () => {
			const previewUrl =
				'postgresql://postgres.iwipdvisoyerfdytuhwi:secret@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
			process.env.PREVIEW_DB_URL = previewUrl;

			const result = classifyDbTarget(previewUrl);
			expect(result.target).toBe('preview');
			expect(result.reason).toContain('Matches PREVIEW_DB_URL');
		});

		it('classifies only the explicit Production project as production', () => {
			delete process.env.PREVIEW_DB_URL;
			const prodUrl =
				'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres';

			const result = classifyDbTarget(prodUrl);
			expect(result.target).toBe('production');
		});

		it('resolves canonical URLs via resolveDbUrl', () => {
			expect(resolveDbUrl('persistent-local')).toBe(LOCAL_DB_URL);
			expect(resolveDbUrl('disposable-test')).toBe(DISPOSABLE_DB_URL);

			process.env.PREVIEW_DB_URL =
				'postgresql://user:pass@preview-host.supabase.com:5432/postgres';
			expect(resolveDbUrl('preview')).toBe(
				'postgresql://user:pass@preview-host.supabase.com:5432/postgres',
			);

			process.env.PROD_DB_URL = 'postgresql://user:pass@prod-host.supabase.com:5432/postgres';
			expect(resolveDbUrl('production')).toBe(
				'postgresql://user:pass@prod-host.supabase.com:5432/postgres',
			);
		});

		it('uses the single canonical secret file per hosted target', () => {
			expect(PREVIEW_SECRET_FILES).toEqual(['.env.preview.local']);
			expect(PROD_SECRET_FILES).toEqual(['.env.production.local']);
		});
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

			const prodUrl =
				'postgresql://postgres:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
			expect(() => enforceDisposableTargetOnly(prodUrl)).toThrow('process.exit(1) called');
			expect(mockExit).toHaveBeenCalledWith(1);
		});

		it('blocks persistent-local target and exits with code 1', () => {
			const mockExit = mockProcessExit();

			const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
			expect(() => enforceDisposableTargetOnly(localUrl)).toThrow('process.exit(1) called');
			expect(mockExit).toHaveBeenCalledWith(1);
		});

		it('blocks unknown DB URL and exits with code 1', () => {
			const mockExit = mockProcessExit();

			const unknownUrl = 'postgresql://user:secret@some-random-host.com:5432/postgres';
			expect(() => enforceDisposableTargetOnly(unknownUrl)).toThrow('process.exit(1) called');
			expect(mockExit).toHaveBeenCalledWith(1);
		});

		it('allows disposable-test environment', () => {
			const mockExit = mockProcessExit();
			const disposableUrl = 'postgresql://postgres:postgres@127.0.0.1:54332/postgres';
			expect(() => enforceDisposableTargetOnly(disposableUrl)).not.toThrow();
			expect(mockExit).not.toHaveBeenCalled();
		});
	});

	describe('db-guard.ts production migration rules', () => {
		const prodUrl =
			'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres';
		const prodClassification = classifyDbTarget(prodUrl);

		it('allows controlled migrate entrypoint (CLI enforces --apply and TTY confirmation)', () => {
			const result = guardProduction(prodClassification, 'migrate');
			expect(result.ok).toBe(true);
			expect(result.errors.length).toBe(0);
		});

		it('allows controlled patch entrypoint', () => {
			const result = guardProduction(prodClassification, 'patch');
			expect(result.ok).toBe(true);
		});

		it('still blocks unstructured production write operations', () => {
			const result = guardProduction(prodClassification, 'reset');
			expect(result.ok).toBe(false);
			expect(result.errors[0]).toContain('PRODUCTION WRITE BLOCKED');
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

	describe('Canonical URL credential integrity', () => {
		it('LOCAL_DB_URL credentials match PERSISTENT_LOCAL config', () => {
			const parsed = parseDbUrl(LOCAL_DB_URL);
			expect(parsed).not.toBeNull();
			expect(parsed!.user).toBe(PERSISTENT_LOCAL.dbUser);
			expect(parsed!.password).toBe(PERSISTENT_LOCAL.dbPassword);
			expect(parsed!.hostname).toBe('127.0.0.1');
			expect(parsed!.port).toBe(PERSISTENT_LOCAL.dbPort);
			expect(parsed!.pathname).toBe(PERSISTENT_LOCAL.dbName);
		});

		it('DISPOSABLE_DB_URL credentials match DISPOSABLE_TEST config', () => {
			const parsed = parseDbUrl(DISPOSABLE_DB_URL);
			expect(parsed).not.toBeNull();
			expect(parsed!.user).toBe(DISPOSABLE_TEST.dbUser);
			expect(parsed!.password).toBe(DISPOSABLE_TEST.dbPassword);
			expect(parsed!.hostname).toBe('127.0.0.1');
			expect(parsed!.port).toBe(DISPOSABLE_TEST.dbPort);
			expect(parsed!.pathname).toBe(DISPOSABLE_TEST.dbName);
		});

		it('neither LOCAL_DB_URL nor DISPOSABLE_DB_URL contains literal ***', () => {
			expect(LOCAL_DB_URL).not.toContain('***');
			expect(DISPOSABLE_DB_URL).not.toContain('***');
		});

		it('redactDbUrl removes the real password from LOCAL_DB_URL', () => {
			const redacted = redactDbUrl(LOCAL_DB_URL);
			// Check password position is redacted — the password "postgres" also
			// legitimately appears in the username and database pathname, so check
			// the credential section specifically
			expect(redacted).toMatch(/\/\/[^:]+:<redacted>@/);
			expect(redacted).toContain(PERSISTENT_LOCAL.dbUser);
		});

		it('redactCredentials removes the real password from DISPOSABLE_DB_URL', () => {
			const redacted = redactCredentials(DISPOSABLE_DB_URL);
			// Verify redacted form shows the credential section is masked
			expect(redacted).toMatch(/\/\/<redacted>@<host>/);
		});

		it('resolveDbUrl returns DISPOSABLE_DB_URL for disposable-test target', () => {
			const resolved = resolveDbUrl('disposable-test');
			expect(resolved).toBe(DISPOSABLE_DB_URL);
		});
	});
});
