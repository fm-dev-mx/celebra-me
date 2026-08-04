import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
	assertValidReleaseCheckEvidence,
	clearReleaseCheckEvidence,
	readReleaseCheckEvidence,
	writeReleaseCheckEvidence,
	type ReleaseCheckEvidence,
} from '../../scripts/db/release-check.ts';

const tempDirs: string[] = [];

afterEach(() => {
	jest.restoreAllMocks();
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function evidence(sha: string): ReleaseCheckEvidence {
	return {
		version: 1,
		status: 'pass',
		sha,
		clean: true,
		typeCheck: 'pass',
		test: 'pass',
		build: 'pass',
		createdAt: new Date().toISOString(),
	};
}

describe('release-check evidence', () => {
	it('accepts evidence that matches the current clean HEAD', () => {
		const dir = mkdtempSync(join(tmpdir(), 'release-check-'));
		tempDirs.push(dir);
		const path = join(dir, 'evidence.json');
		writeReleaseCheckEvidence(evidence('abc1234deadbeef'), path);
		const result = assertValidReleaseCheckEvidence({
			evidencePath: path,
			worktree: { sha: 'abc1234deadbeef', clean: true, dirtySummary: '' },
		});
		expect(result.sha).toBe('abc1234deadbeef');
		expect(readReleaseCheckEvidence(path)?.status).toBe('pass');
	});

	it('rejects dirty worktrees', () => {
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
			throw new Error(`process.exit:${code ?? ''}`);
		}) as never);
		expect(() =>
			assertValidReleaseCheckEvidence({
				worktree: {
					sha: 'abc1234',
					clean: false,
					dirtySummary: ' M scripts/db/push-prod-migrations.ts',
				},
			}),
		).toThrow('process.exit:1');
	});

	it('rejects and clears stale evidence when HEAD changes', () => {
		const dir = mkdtempSync(join(tmpdir(), 'release-check-'));
		tempDirs.push(dir);
		const path = join(dir, 'evidence.json');
		writeReleaseCheckEvidence(evidence('oldsha0000001'), path);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
			throw new Error(`process.exit:${code ?? ''}`);
		}) as never);
		expect(() =>
			assertValidReleaseCheckEvidence({
				evidencePath: path,
				worktree: { sha: 'newsha0000002', clean: true, dirtySummary: '' },
			}),
		).toThrow('process.exit:1');
		expect(readReleaseCheckEvidence(path)).toBeNull();
	});

	it('rejects malformed evidence', () => {
		const dir = mkdtempSync(join(tmpdir(), 'release-check-'));
		tempDirs.push(dir);
		const path = join(dir, 'evidence.json');
		writeFileSync(path, JSON.stringify({ version: 1, status: 'fail' }), 'utf8');
		expect(readReleaseCheckEvidence(path)).toBeNull();
		clearReleaseCheckEvidence(path);
		expect(() => readFileSync(path, 'utf8')).toThrow();
	});
});
