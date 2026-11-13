import { readFileSync } from 'node:fs';
import { describe, expect, it, jest } from '@jest/globals';
import {
	assertProductionWorkerServesRelease,
	patchIsReviewedWorkerCompatibleContent,
	patchIsReviewedWorkerIndependent,
} from '../../scripts/db/production-worker-content-guard.ts';
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

describe('reviewed Worker-independent patches', () => {
	const reviewed = [
		'20261109_auth_login_alias_app_metadata_backfill',
		'20261112_tracking_events_blank_lead_code',
		'20261112_auth_users_without_app_role',
	];
	const read = (id: string) =>
		readFileSync(`scripts/manual/production-patches/${id}.sql`, 'utf8').replace(/\r\n/g, '\n');

	it.each(reviewed)('accepts %s with LF or CRLF line endings', (id) => {
		const sql = read(id);
		expect(patchIsReviewedWorkerIndependent(id, sql)).toBe(true);
		expect(patchIsReviewedWorkerIndependent(id, sql.replace(/\n/g, '\r\n'))).toBe(true);
	});

	it.each(reviewed)('rejects %s once its text changes', (id) => {
		const sql = read(id);
		expect(
			patchIsReviewedWorkerIndependent(
				id,
				`${sql}select public.archive_invitation(null::uuid);\n`,
			),
		).toBe(false);
		expect(patchIsReviewedWorkerIndependent(id, sql.replace(/\n/g, '\r'))).toBe(false);
	});

	it('rejects an unknown id, a missing id and a reviewed text under another id', () => {
		const sql = read(reviewed[0]!);
		expect(patchIsReviewedWorkerIndependent('test-patch', sql)).toBe(false);
		expect(patchIsReviewedWorkerIndependent(undefined, sql)).toBe(false);
		expect(patchIsReviewedWorkerIndependent(reviewed[1], sql)).toBe(false);
		expect(patchIsReviewedWorkerIndependent('constructor', sql)).toBe(false);
	});
});

describe('reviewed Worker-compatible content patches', () => {
	const id = '20261112_itinerary_presentation_removal';
	const read = (scriptId: string) =>
		readFileSync(`scripts/manual/production-patches/${scriptId}.sql`, 'utf8').replace(
			/\r\n/g,
			'\n',
		);

	it('accepts the reviewed repair with LF or CRLF line endings', () => {
		const sql = read(id);
		expect(patchIsReviewedWorkerCompatibleContent(id, sql)).toBe(true);
		expect(patchIsReviewedWorkerCompatibleContent(id, sql.replace(/\n/g, '\r\n'))).toBe(true);
	});

	it('rejects the repair once its text changes or under another id', () => {
		const sql = read(id);
		expect(patchIsReviewedWorkerCompatibleContent(id, `${sql}-- edit\n`)).toBe(false);
		expect(patchIsReviewedWorkerCompatibleContent('test-patch', sql)).toBe(false);
		expect(patchIsReviewedWorkerCompatibleContent(undefined, sql)).toBe(false);
	});

	it('keeps the two reviewed lists apart', () => {
		expect(patchIsReviewedWorkerIndependent(id, read(id))).toBe(false);
		const independent = '20261112_auth_users_without_app_role';
		expect(patchIsReviewedWorkerCompatibleContent(independent, read(independent))).toBe(false);
	});
});
