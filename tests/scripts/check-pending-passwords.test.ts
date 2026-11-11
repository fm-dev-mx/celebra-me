/** @jest-environment node */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const NOW = Date.parse('2026-11-10T12:00:00.000Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function evaluateUser(user: unknown, now: number) {
	const script = pathToFileURL(resolve('scripts/auth/check-pending-passwords.mjs')).href;
	const code = `
import { evaluateAccountPasswordStatus } from ${JSON.stringify(script)};
const res = evaluateAccountPasswordStatus(${JSON.stringify(user)}, ${now});
console.log(JSON.stringify(res));
`;
	const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
		encoding: 'utf8',
	});
	if (child.status !== 0) throw new Error(child.stderr);
	return JSON.parse(child.stdout);
}

function summarizeUsers(users: unknown[], now: number) {
	const script = pathToFileURL(resolve('scripts/auth/check-pending-passwords.mjs')).href;
	const code = `
import { summarizePendingPasswords } from ${JSON.stringify(script)};
const res = summarizePendingPasswords(${JSON.stringify(users)}, ${now});
console.log(JSON.stringify(res));
`;
	const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
		encoding: 'utf8',
	});
	if (child.status !== 0) throw new Error(child.stderr);
	return JSON.parse(child.stdout);
}

describe('evaluateAccountPasswordStatus', () => {
	it('ignores accounts without must_change_password or with false', () => {
		expect(evaluateUser({ id: 'u1' }, NOW)).toBeNull();
		expect(
			evaluateUser({ id: 'u2', app_metadata: { must_change_password: false } }, NOW),
		).toBeNull();
	});

	it('computes active status and age from temp_password_expires_at', () => {
		// Expires 12h in the future -> issued 12h ago (age 0 days)
		const user = {
			id: 'u3',
			app_metadata: {
				must_change_password: true,
				temp_password_expires_at: new Date(NOW + 12 * 60 * 60 * 1000).toISOString(),
			},
		};
		const status = evaluateUser(user, NOW);
		expect(status).toEqual({
			isPending: true,
			expired: false,
			ageDays: 0,
			ageConfidence: 'exact',
			estimated: false,
			unknown: false,
		});
	});

	it('computes expired status and age from temp_password_expires_at', () => {
		// Expired 5 days ago -> issued 6 days ago
		const user = {
			id: 'u4',
			app_metadata: {
				must_change_password: true,
				temp_password_expires_at: new Date(NOW - 5 * ONE_DAY_MS).toISOString(),
			},
		};
		const status = evaluateUser(user, NOW);
		expect(status).toEqual({
			isPending: true,
			expired: true,
			ageDays: 6,
			ageConfidence: 'exact',
			estimated: false,
			unknown: false,
		});
	});

	it('estimates age from created_at and ignores updated_at to prevent rejuvenating reports', () => {
		// Legacy account created 45 days ago, but updated 2 hours ago by an unrelated action
		const userEstimated = {
			id: 'u5',
			created_at: new Date(NOW - 45 * ONE_DAY_MS).toISOString(),
			updated_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
			app_metadata: { must_change_password: true },
		};
		expect(evaluateUser(userEstimated, NOW)).toEqual({
			isPending: true,
			expired: false,
			ageDays: 45,
			ageConfidence: 'estimated',
			estimated: true,
			unknown: false,
		});
	});

	it('distinguishes unknown age when expiry and created_at are absent, even if updated_at is present', () => {
		const userUpdatedOnly = {
			id: 'u6',
			updated_at: new Date(NOW - 15 * ONE_DAY_MS).toISOString(),
			app_metadata: { must_change_password: true },
		};
		expect(evaluateUser(userUpdatedOnly, NOW)).toEqual({
			isPending: true,
			expired: false,
			ageDays: null,
			ageConfidence: 'unknown',
			estimated: false,
			unknown: true,
		});
	});
});

describe('summarizePendingPasswords', () => {
	it('aggregates totals, buckets and bounds correctly', () => {
		const users = [
			// Normal active user
			{ id: 'u1', app_metadata: { role: 'host_client' } },
			// Active pending change issued 6h ago (< 1d)
			{
				id: 'u2',
				app_metadata: {
					must_change_password: true,
					temp_password_expires_at: new Date(NOW + 18 * 60 * 60 * 1000).toISOString(),
				},
			},
			// Expired pending change, issued 4 days ago (2-7d)
			{
				id: 'u3',
				app_metadata: {
					must_change_password: true,
					temp_password_expires_at: new Date(NOW - 3 * ONE_DAY_MS).toISOString(),
				},
			},
			// Expired pending change, issued 20 days ago (8-30d)
			{
				id: 'u4',
				app_metadata: {
					must_change_password: true,
					temp_password_expires_at: new Date(NOW - 19 * ONE_DAY_MS).toISOString(),
				},
			},
			// Legacy pending change without expiry, created 40 days ago (>30d, estimated)
			{
				id: 'u5',
				created_at: new Date(NOW - 40 * ONE_DAY_MS).toISOString(),
				updated_at: new Date(NOW - 1 * ONE_DAY_MS).toISOString(), // Unrelated change does not rejuvenate
				app_metadata: { must_change_password: true },
			},
			// Legacy pending change with unknown age (no created_at, no expiry)
			{
				id: 'u6',
				updated_at: new Date(NOW - 5 * ONE_DAY_MS).toISOString(), // updated_at ignored
				app_metadata: { must_change_password: true },
			},
		];

		const summary = summarizeUsers(users, NOW);
		expect(summary).toEqual({
			pendingPasswords: 5,
			active: 3, // u2, u5, and u6 (unexpired)
			expired: 2, // u3 and u4
			estimated: 1, // u5
			unknown: 1, // u6
			ageDays: {
				'0-1': 1,
				'2-7': 1,
				'8-30': 1,
				'>30': 1,
				unknown: 1,
			},
			oldestDays: 40,
			newestDays: 0,
		});
	});
});

describe('read-only check-pending-passwords CLI against loopback Auth API', () => {
	async function runCli(users: unknown[], extraArgs: string[] = [], pageSize = 100) {
		const methods: string[] = [];
		const server = createServer((request, response) => {
			methods.push(request.method ?? '');
			const page = Number(
				new URL(request.url ?? '', 'http://localhost').searchParams.get('page'),
			);
			response.setHeader('Content-Type', 'application/json');
			response.end(
				JSON.stringify({ users: users.slice((page - 1) * pageSize, page * pageSize) }),
			);
		});
		await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
		try {
			const child = spawn(
				process.execPath,
				[resolve('scripts/auth/check-pending-passwords.mjs'), ...extraArgs],
				{
					env: {
						...process.env,
						SUPABASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
						SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
					},
				},
			);
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', (chunk) => (stdout += chunk));
			child.stderr.on('data', (chunk) => (stderr += chunk));
			const status = await new Promise<number | null>((done) => child.on('close', done));
			return { status, stdout, stderr, methods };
		} finally {
			await new Promise((done) => server.close(done));
		}
	}

	it('exits 0 and reports clean when no accounts have must_change_password', async () => {
		const users = [
			{ id: 'u1', email: 'a@example.test', app_metadata: { role: 'host_client' } },
			{ id: 'u2', email: 'b@example.test', app_metadata: { role: 'host_client' } },
		];
		const { status, stdout, stderr, methods } = await runCli(users);
		expect(status).toBe(0);
		expect(methods.every((m) => m === 'GET')).toBe(true);
		expect(stderr).toBe('');

		const data = JSON.parse(stdout);
		expect(data).toMatchObject({
			accounts: 2,
			pendingPasswords: 0,
			active: 0,
			expired: 0,
			ok: true,
			clean: true,
		});
		// No emails or IDs in output
		expect(stdout).not.toContain('u1');
		expect(stdout).not.toContain('a@example.test');
	});

	it('exits 0 with advisory warning when pending accounts exist in advisory mode', async () => {
		const users = [
			{ id: 'u1', email: 'a@example.test', app_metadata: { role: 'host_client' } },
			{
				id: 'u2',
				email: 'b@example.test',
				app_metadata: {
					must_change_password: true,
					temp_password_expires_at: new Date(Date.now() + 100000).toISOString(),
				},
			},
		];
		const { status, stdout, stderr } = await runCli(users);
		expect(status).toBe(0);
		expect(stderr).toContain('Advisory: 1 account(s) have must_change_password open');

		const data = JSON.parse(stdout);
		expect(data).toMatchObject({
			accounts: 2,
			pendingPasswords: 1,
			active: 1,
			expired: 0,
			ok: true,
			clean: false,
		});
	});

	it('exits 1 when pending accounts exist and --strict is passed', async () => {
		const users = [
			{ id: 'u1', email: 'a@example.test', app_metadata: { role: 'host_client' } },
			{
				id: 'u2',
				email: 'b@example.test',
				app_metadata: {
					must_change_password: true,
					temp_password_expires_at: new Date(Date.now() + 100000).toISOString(),
				},
			},
		];
		const { status, stdout, stderr } = await runCli(users, ['--strict']);
		expect(status).toBe(1);
		expect(stderr).toContain(
			'Pending password check failed: 1 account(s) have must_change_password open (--strict)',
		);

		const data = JSON.parse(stdout);
		expect(data.ok).toBe(false);
		expect(data.clean).toBe(false);
	});

	it('exits 1 and fails closed on an empty directory', async () => {
		const { status, stdout, stderr } = await runCli([]);
		expect(status).toBe(1);
		expect(stderr).toContain('target returned no accounts');
		const data = JSON.parse(stdout);
		expect(data.ok).toBe(false);
	});

	it('rejects unknown CLI options', async () => {
		const users = [{ id: 'u1', app_metadata: {} }];
		const { status, stderr } = await runCli(users, ['--unknown-option']);
		expect(status).toBe(1);
		expect(stderr).toContain('Pending password check failed');
	});

	it('paginates beyond a single page of users', async () => {
		const users = Array.from({ length: 150 }, (_, i) => ({
			id: `user-${i}`,
			app_metadata: i === 0 ? { must_change_password: true } : {},
		}));
		const { status, stdout, methods } = await runCli(users, [], 100);
		expect(status).toBe(0);
		// 150 users with page size 100 takes 2 pages + 1 empty page = 3 requests
		expect(methods).toHaveLength(3);
		const data = JSON.parse(stdout);
		expect(data.accounts).toBe(150);
		expect(data.pendingPasswords).toBe(1);
	});
});
