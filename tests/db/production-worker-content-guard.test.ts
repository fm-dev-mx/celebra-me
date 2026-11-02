import { describe, expect, it, jest } from '@jest/globals';
import { assertProductionWorkerServesRelease } from '../../scripts/db/production-worker-content-guard.ts';
import type { GitRunner } from '../../scripts/ops/release-readiness.ts';

const releaseSha = 'a'.repeat(40);
const newerSha = 'b'.repeat(40);

function health(
	body: { status?: string; build?: Record<string, unknown> },
	status = 200,
): NonNullable<Parameters<typeof assertProductionWorkerServesRelease>[1]>['fetchImpl'] {
	return async () => ({ status, headers: { get: () => null }, json: async () => body });
}

const serving = (commitSha: string | null, environment: string | null = 'production') =>
	health({ status: 'healthy', build: { commitSha, environment } });

const gitStatus = (status: number) => jest.fn<GitRunner>(() => ({ status, stdout: '' }));

describe('Production Worker content guard', () => {
	it('allows content when Production serves the exact release commit', async () => {
		const git = gitStatus(1);
		await expect(
			assertProductionWorkerServesRelease(
				{ releaseSha },
				{ fetchImpl: serving(releaseSha), git },
			),
		).resolves.toEqual({ servingSha: releaseSha });
		expect(git).not.toHaveBeenCalled();
	});

	it('allows content when the serving Worker already contains the release commit', async () => {
		const git = gitStatus(0);
		await expect(
			assertProductionWorkerServesRelease(
				{ releaseSha },
				{ fetchImpl: serving(newerSha), git },
			),
		).resolves.toEqual({ servingSha: newerSha });
		expect(git).toHaveBeenCalledWith(['merge-base', '--is-ancestor', releaseSha, newerSha]);
	});

	it('refuses content the older serving Worker could not resolve', async () => {
		await expect(
			assertProductionWorkerServesRelease(
				{ releaseSha },
				{ fetchImpl: serving(newerSha), git: gitStatus(1) },
			),
		).rejects.toMatchObject({
			code: 'PRODUCTION_WORKER_BEHIND_CONTENT',
			noChangesMessage: 'No se realizaron escrituras en Production.',
			remediation: expect.arrayContaining([expect.stringMatching(/^Despliegue primero/)]),
		});
	});

	it.each([128, 2])('refuses when git cannot compare the commits (status %i)', async (status) => {
		await expect(
			assertProductionWorkerServesRelease(
				{ releaseSha },
				{ fetchImpl: serving(newerSha), git: gitStatus(status) },
			),
		).rejects.toMatchObject({
			code: 'PRODUCTION_WORKER_UNVERIFIED',
			causeText: expect.stringContaining(`(estado ${status})`),
			remediation: expect.arrayContaining([
				'Si ese commit no está en este checkout, ejecute git fetch origin.',
			]),
		});
	});

	it('aborts and refuses when /api/health does not answer before the deadline', async () => {
		let signal: AbortSignal | undefined;
		const hanging = ((_url: string, init?: { signal?: AbortSignal }) => {
			signal = init?.signal;
			return new Promise(() => undefined);
		}) as unknown as ReturnType<typeof health>;
		const git = gitStatus(0);
		await expect(
			assertProductionWorkerServesRelease(
				{ releaseSha },
				{ fetchImpl: hanging, git, deadlineMs: 5 },
			),
		).rejects.toMatchObject({
			code: 'PRODUCTION_WORKER_UNVERIFIED',
			causeText: expect.stringContaining('no respondió /api/health'),
			noChangesMessage: 'No se realizaron escrituras en Production.',
		});
		expect(signal?.aborted).toBe(true);
		expect(git).not.toHaveBeenCalled();
	});

	it.each([
		[
			'an unhealthy Worker',
			health({ status: 'unhealthy', build: { commitSha: releaseSha } }, 503),
		],
		['a Worker behind an authentication challenge', health({}, 401)],
		['a Worker without build identity', serving(null)],
		['a Worker reporting another environment', serving(releaseSha, 'preview')],
		[
			'an unreachable Worker',
			(async () => {
				throw new TypeError('fetch failed');
			}) as unknown as ReturnType<typeof health>,
		],
	])('refuses %s', async (_label, fetchImpl) => {
		await expect(
			assertProductionWorkerServesRelease({ releaseSha }, { fetchImpl, git: gitStatus(0) }),
		).rejects.toMatchObject({ code: 'PRODUCTION_WORKER_UNVERIFIED' });
	});
});
