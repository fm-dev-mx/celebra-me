/**
 * Disposable migration proof v3: shared receipt bound to the migration set, the live container
 * instance, and its live history. Everything unverifiable fails closed.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

let fileDigests: Record<string, string> = {};

jest.mock('../../scripts/db/apply-migrations.ts', () => ({
	getValidatedMigrationFiles: () =>
		Object.keys(fileDigests).map((version) => ({
			version,
			filename: `${version}_m.sql`,
			name: 'm',
		})),
}));

jest.mock('../../scripts/db/migration-sql-risk.ts', () => ({
	computeMigrationSetDigest: (files: { version: string }[]) =>
		files.map((file) => `${file.version}:${fileDigests[file.version]}`).join('|'),
	computeMigrationFileDigests: () => ({ ...fileDigests }),
}));

jest.mock('../../scripts/db/release-check.ts', () => ({
	readGitWorktreeState: () => ({ sha: 'a'.repeat(40), clean: true }),
}));

jest.mock('../../scripts/shared/git-paths.ts', () => ({
	gitCommonPath: () => {
		throw new Error('tests must pass an explicit proof path');
	},
}));

type Live = {
	container: { name: string; id: string; createdAt: string } | null;
	appliedVersions: string[] | null;
	error?: string;
};

const container = (id: string) => ({ name: 'celebra-me-test-db', id, createdAt: '2026-10-01' });

describe('disposable migration proof v3', () => {
	let dir: string;
	let path: string;

	beforeEach(() => {
		jest.resetModules();
		fileDigests = { '20260101000000': 'd1', '20260102000000': 'd2' };
		dir = mkdtempSync(join(tmpdir(), 'proof-'));
		path = join(dir, 'db-evidence', 'disposable-migration-proof.json');
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	async function load() {
		return import('../../scripts/db/disposable-migration-proof.ts');
	}

	function liveReader(live: Live) {
		return () => live;
	}

	it('is shared across worktrees: one receipt validates from any checkout using the same path', async () => {
		const proofModule = await load();
		const live: Live = {
			container: container('c1'),
			appliedVersions: ['20260101000000', '20260102000000'],
		};
		proofModule.writeDisposableMigrationProof({
			appliedVersions: live.appliedVersions!,
			path,
			readLive: liveReader(live),
		});
		const result = proofModule.assertCurrentDisposableMigrationProof({
			path,
			readLive: liveReader(live),
		});
		expect(result.ok).toBe(true);
		expect(result.proof?.appliedVersions).toEqual(live.appliedVersions);
		expect(result.proof?.container.id).toBe('c1');
	});

	it('rejects a receipt recorded for a different container instance', async () => {
		const proofModule = await load();
		const versions = ['20260101000000', '20260102000000'];
		proofModule.writeDisposableMigrationProof({
			appliedVersions: versions,
			path,
			readLive: liveReader({ container: container('c1'), appliedVersions: versions }),
		});
		const result = proofModule.assertCurrentDisposableMigrationProof({
			path,
			readLive: liveReader({ container: container('c2'), appliedVersions: versions }),
		});
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/different disposable container/);
	});

	it('rejects when the live history diverges from the receipt', async () => {
		const proofModule = await load();
		const versions = ['20260101000000', '20260102000000'];
		proofModule.writeDisposableMigrationProof({
			appliedVersions: versions,
			path,
			readLive: liveReader({ container: container('c1'), appliedVersions: versions }),
		});
		const result = proofModule.assertCurrentDisposableMigrationProof({
			path,
			readLive: liveReader({
				container: container('c1'),
				appliedVersions: ['20260101000000'],
			}),
		});
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/no longer matches/);
	});

	it('requires a disposable reset when an applied migration was edited in place', async () => {
		const proofModule = await load();
		const versions = ['20260101000000', '20260102000000'];
		const live = liveReader({ container: container('c1'), appliedVersions: versions });
		proofModule.writeDisposableMigrationProof({
			appliedVersions: versions,
			path,
			readLive: live,
		});

		jest.resetModules();
		fileDigests = { ...fileDigests, '20260101000000': 'd1-edited' };
		const reloaded = await load();
		const result = reloaded.assertCurrentDisposableMigrationProof({ path, readLive: live });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/edited in place.*db:disposable:reset/);
		expect(() =>
			reloaded.writeDisposableMigrationProof({
				appliedVersions: versions,
				path,
				readLive: live,
			}),
		).toThrow(/edited in place/);
	});

	it('fails closed when the shared container holds migrations from another branch', async () => {
		const proofModule = await load();
		const foreign = ['20260101000000', '20260102000000', '20260103000000'];
		expect(() =>
			proofModule.writeDisposableMigrationProof({
				appliedVersions: foreign,
				path,
				readLive: liveReader({ container: container('c1'), appliedVersions: foreign }),
			}),
		).toThrow(/absent from this checkout/);
	});

	it('lets a disposable reset recover from an in-place edit by retiring the receipt', async () => {
		const proofModule = await load();
		const versions = ['20260101000000', '20260102000000'];
		const live = liveReader({ container: container('c1'), appliedVersions: versions });
		proofModule.writeDisposableMigrationProof({
			appliedVersions: versions,
			path,
			readLive: live,
		});

		jest.resetModules();
		fileDigests = { ...fileDigests, '20260101000000': 'd1-edited' };
		const reloaded = await load();
		expect(reloaded.invalidateDisposableMigrationProof({ path })).toBe(true);
		expect(existsSync(`${path}.superseded`)).toBe(true);
		expect(reloaded.invalidateDisposableMigrationProof({ path })).toBe(false);

		reloaded.writeDisposableMigrationProof({ appliedVersions: versions, path, readLive: live });
		expect(reloaded.assertCurrentDisposableMigrationProof({ path, readLive: live }).ok).toBe(
			true,
		);
	});

	it.each([1, 2])('treats a v%s receipt as missing', async (version) => {
		const proofModule = await load();
		const versions = ['20260101000000', '20260102000000'];
		mkdirSync(join(dir, 'db-evidence'), { recursive: true });
		writeFileSync(
			path,
			JSON.stringify({
				version,
				migrationSetDigest: 'x',
				migrationDigests: { '20260101000000': 'raw-crlf-bytes' },
				appliedVersions: versions,
				maxVersion: null,
				container: container('c1'),
			}),
		);
		const live = liveReader({ container: container('c1'), appliedVersions: versions });
		const result = proofModule.assertCurrentDisposableMigrationProof({ path, readLive: live });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/Missing disposable migration proof/);
		expect(() =>
			proofModule.writeDisposableMigrationProof({
				appliedVersions: versions,
				path,
				readLive: live,
			}),
		).not.toThrow();
	});

	it('fails closed when the container is down', async () => {
		const proofModule = await load();
		const versions = ['20260101000000', '20260102000000'];
		proofModule.writeDisposableMigrationProof({
			appliedVersions: versions,
			path,
			readLive: liveReader({ container: container('c1'), appliedVersions: versions }),
		});
		const result = proofModule.assertCurrentDisposableMigrationProof({
			path,
			readLive: liveReader({
				container: null,
				appliedVersions: null,
				error: 'container down',
			}),
		});
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/cannot be verified.*container down/);
	});
});
