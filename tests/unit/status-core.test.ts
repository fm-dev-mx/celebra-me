/**
 * status-core unit tests — pure classifiers, memoization, migration lifecycle mapping.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockRunPsql = jest.fn();
const mockRunCommand = jest.fn();

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	PROJECT_ROOT: process.cwd(),
	runPsql: (...args: unknown[]) => mockRunPsql(...args),
	runCommand: (...args: unknown[]) => mockRunCommand(...args),
	sqlLiteral: (value: string) => `'${value.replaceAll("'", "''")}'`,
}));

jest.mock('../../scripts/db/audit-db.ts', () => ({
	evaluateMigrationHistoryParity: (
		expected: string[],
		remote: string[],
	) => {
		const pendingLocal = expected.filter((v) => !remote.includes(v));
		const extraRemote = remote.filter((v) => !expected.includes(v));
		return {
			isAligned: pendingLocal.length === 0 && extraRemote.length === 0,
			pendingLocal,
			extraRemote,
			isReordered: false,
			hasDivergentHistory: false,
			errors:
				pendingLocal.length > 0
					? [`Pending local migrations not applied to remote (${pendingLocal.length}): ${pendingLocal.join(', ')}`]
					: [],
		};
	},
}));

import {
	StatusProbeSession,
	classifyPackageHashContent,
	createLiveFreshness,
	redactProbeError,
	readMigrationLifecycleForUrlSync,
	mapPool,
} from '../../scripts/status-core/index.ts';

describe('status-core evidence', () => {
	it('marks live freshness and redacts sensitive fragments', () => {
		const fresh = createLiveFreshness(true);
		expect(fresh.source).toBe('live');
		expect(fresh.timeoutDegraded).toBe(true);
		expect(redactProbeError('failed postgres://user:secret@host/db path C:\\Users\\x')).toMatch(
			/\[redacted-db-url\]/,
		);
		expect(redactProbeError('failed postgres://user:secret@host/db path C:\\Users\\x')).toMatch(
			/\[redacted-path\]/,
		);
	});
});

describe('status-core classifyPackageHashContent', () => {
	it('classifies match, behind, diverged, and conflicts deterministically', () => {
		expect(
			classifyPackageHashContent({
				activeMatchCount: 1,
				resolvedId: 'id-1',
				provenancePackageHash: 'abc',
				canonicalHash: 'abc',
				draftStatus: 'approved',
				draftUpdatedAt: '2026-01-01T00:00:00Z',
				publishedAt: '2026-01-02T00:00:00Z',
			}).status,
		).toBe('MATCH_CANONICAL');

		expect(
			classifyPackageHashContent({
				activeMatchCount: 1,
				resolvedId: 'id-1',
				provenancePackageHash: 'old',
				canonicalHash: 'new',
				draftStatus: null,
				draftUpdatedAt: null,
				publishedAt: null,
			}).status,
		).toBe('BEHIND_CANONICAL');

		expect(
			classifyPackageHashContent({
				activeMatchCount: 1,
				resolvedId: 'id-1',
				provenancePackageHash: 'abc',
				canonicalHash: 'abc',
				draftStatus: 'draft',
				draftUpdatedAt: '2026-02-01T00:00:00Z',
				publishedAt: '2026-01-01T00:00:00Z',
			}).status,
		).toBe('DIVERGED');

		expect(
			classifyPackageHashContent({
				activeMatchCount: 2,
				resolvedId: null,
				provenancePackageHash: null,
				canonicalHash: 'abc',
				draftStatus: null,
				draftUpdatedAt: null,
				publishedAt: null,
			}).status,
		).toBe('IDENTITY_CONFLICT');
	});
});

describe('status-core probe session memoization', () => {
	beforeEach(() => {
		mockRunPsql.mockReset();
		mockRunPsql.mockReturnValue({ status: 0, stdout: '1', stderr: '' });
	});

	it('memoizes identical psql reads within one execution', () => {
		const session = new StatusProbeSession({ timeoutMs: 1000 });
		expect(session.probeConnectivitySync('postgres://local')).toBe(true);
		expect(session.probeConnectivitySync('postgres://local')).toBe(true);
		expect(session.invocations).toBe(1);
		expect(session.memoHits).toBe(1);
	});

	it('propagates timeoutMs into runPsql options', () => {
		const session = new StatusProbeSession({ timeoutMs: 1234 });
		session.psqlSync('select 1;', 'postgres://local');
		expect(session.readOnly).toBe(true);
		expect(mockRunPsql.mock.calls[0]?.[2]).toMatchObject({
			timeoutMs: 1234,
			env: expect.objectContaining({ PGOPTIONS: expect.stringContaining('default_transaction_read_only=on') }),
		});
	});
});

describe('status-core migration lifecycle', () => {
	beforeEach(() => {
		mockRunPsql.mockReset();
		mockRunCommand.mockReset();
	});

	it('returns BEHIND with exact pending IDs when remote lacks later versions', () => {
		mockRunPsql.mockReturnValue({
			status: 0,
			stdout: '20260730220544\n',
			stderr: '',
		});
		const session = new StatusProbeSession({ timeoutMs: 2500 });
		const lifecycle = readMigrationLifecycleForUrlSync('postgres://prod', session);
		expect(lifecycle.schemaLifecycle).toBe('BEHIND');
		expect(lifecycle.pendingMigrations.length).toBeGreaterThan(0);
		expect(lifecycle.pendingMigrations).toContain('20260802090000');
		expect(lifecycle.extraMigrations).toEqual([]);
		expect(mockRunPsql.mock.calls[0]?.[2]).toMatchObject({ timeoutMs: 2500 });
	});

	it('memoized sync migration read reuses the session query', () => {
		mockRunPsql.mockReturnValue({
			status: 0,
			stdout: '20260802090000\n',
			stderr: '',
		});
		const session = new StatusProbeSession({ timeoutMs: 500 });
		const first = readMigrationLifecycleForUrlSync('postgres://local', session);
		const second = readMigrationLifecycleForUrlSync('postgres://local', session);
		expect(first.schemaLifecycle).toBe(second.schemaLifecycle);
		expect(session.invocations).toBe(1);
		expect(session.memoHits).toBeGreaterThanOrEqual(1);
	});
});

describe('status-core mapPool concurrency', () => {
	it('limits in-flight work to the requested concurrency', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		const items = [1, 2, 3, 4, 5];
		await mapPool(items, 2, async (item) => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 20));
			inFlight -= 1;
			return item * 2;
		});
		expect(maxInFlight).toBeLessThanOrEqual(2);
	});
});
