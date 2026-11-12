import { pathToFileURL } from 'node:url';
import {
	extractApiProjectRef,
	SUPABASE_PROJECT_REFS,
} from '../../src/lib/intake/mutations/environment-identity.ts';

const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export function planAliases(users) {
	const owners = new Map();
	const planned = [];
	for (const user of users) {
		const protectedAlias = normalize(user.app_metadata?.login_alias);
		const legacyAlias = normalize(user.user_metadata?.login_alias);
		const alias = protectedAlias || legacyAlias;
		if (!alias) continue;
		const ids = owners.get(alias) ?? new Set();
		ids.add(user.id);
		owners.set(alias, ids);
		if (!protectedAlias) planned.push({ user, alias });
	}
	const duplicates = [...owners]
		.filter(([, ids]) => ids.size > 1)
		.map(([alias, ids]) => ({ alias, userIds: [...ids] }));
	return { duplicates, planned };
}

function validateEndpoint(url, apply) {
	const endpoint = new URL(url);
	if (
		endpoint.protocol !== 'https:' &&
		!(['localhost', '127.0.0.1'].includes(endpoint.hostname) && endpoint.protocol === 'http:')
	) {
		throw new Error('Use HTTPS or a loopback HTTP endpoint.');
	}
	if (apply) {
		const projectRef = extractApiProjectRef(endpoint.origin);
		if (![SUPABASE_PROJECT_REFS.local, SUPABASE_PROJECT_REFS.preview].includes(projectRef)) {
			throw new Error(
				'Direct Production or unknown-target apply is prohibited; use the owner Production workflow.',
			);
		}
	}
	return endpoint;
}

function createAuthAdmin({ url, serviceKey, apply, fetchImpl }) {
	if (!url || !serviceKey)
		throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
	const endpoint = validateEndpoint(url, apply);
	async function request(path, body) {
		const response = await fetchImpl(`${endpoint.origin}/auth/v1/${path}`, {
			method: body ? 'PUT' : 'GET',
			headers: {
				apikey: serviceKey,
				Authorization: `Bearer ${serviceKey}`,
				'Content-Type': 'application/json',
			},
			...(body ? { body: JSON.stringify(body) } : {}),
			signal: AbortSignal.timeout(5000),
			redirect: 'error',
		});
		if (!response.ok) throw new Error(`Auth migration request failed (${response.status}).`);
		return response.json();
	}
	async function listUsers() {
		const users = [];
		const seen = new Set();
		// Read until an empty page: a server that caps the page size below 100 returns short
		// pages that are not the last one, and a skipped account would be a false "all clear".
		for (let page = 1; ; page++) {
			const result = await request(`admin/users?page=${page}&per_page=100`);
			if (
				!Array.isArray(result.users) ||
				result.users.some((user) => typeof user?.id !== 'string')
			)
				throw new Error('Invalid Auth users response.');
			if (result.users.length === 0) break;
			for (const user of result.users) {
				// A repeated account means the server ignored the page number.
				if (seen.has(user.id))
					throw new Error('Auth users pagination repeated an account.');
				seen.add(user.id);
			}
			users.push(...result.users);
		}
		return users;
	}
	return { request, listUsers, target: describeTarget(endpoint) };
}

function describeTarget(endpoint) {
	try {
		const projectRef = extractApiProjectRef(endpoint.origin);
		const match = Object.entries(SUPABASE_PROJECT_REFS).find(([, ref]) => ref === projectRef);
		return match ? match[0] : 'unknown';
	} catch {
		return 'unknown';
	}
}

/**
 * Read-only check of the data prerequisite "auth-login-alias-app-metadata": login reads the alias
 * only from `app_metadata`, so an account whose alias lives only in `user_metadata` cannot log in
 * by alias. Returns totals only, never an alias, an email or an account id, so the output can be
 * pasted as release evidence. `ok` is false while any such account or a duplicate alias exists,
 * and also when the directory is empty: an empty answer usually means the wrong target, and must
 * not read as proof. `target` names the environment the URL belongs to, so the evidence says
 * where it was taken.
 */
export async function auditLoginAliases({ url, serviceKey, fetchImpl = fetch }) {
	const { listUsers, target } = createAuthAdmin({ url, serviceKey, apply: false, fetchImpl });
	const users = await listUsers();
	const { duplicates, planned } = planAliases(users);
	const protectedAliases = users.filter((user) =>
		normalize(user.app_metadata?.login_alias),
	).length;
	return {
		target,
		accounts: users.length,
		protectedAliases,
		legacyOnly: planned.length,
		duplicates: duplicates.length,
		ok: users.length > 0 && planned.length === 0 && duplicates.length === 0,
	};
}

/** Audit the entire directory before writing: one collision blocks the whole run. */
export async function migrateLoginAliases({ url, serviceKey, apply = false, fetchImpl = fetch }) {
	const { request, listUsers } = createAuthAdmin({ url, serviceKey, apply, fetchImpl });
	const users = await listUsers();
	const { duplicates, planned } = planAliases(users);
	if (duplicates.length) return { apply, duplicates, planned: planned.length, written: 0 };
	let written = 0;
	if (apply) {
		for (const { user, alias } of planned) {
			// Re-read before writing to preserve metadata changed since the directory scan.
			const current = await request(`admin/users/${encodeURIComponent(user.id)}`);
			if (current.id !== user.id) throw new Error('Invalid Auth user response.');
			if (normalize(current.app_metadata?.login_alias)) continue;
			if (normalize(current.user_metadata?.login_alias) !== alias)
				throw new Error('Alias changed during migration; rerun the audit.');
			await request(`admin/users/${encodeURIComponent(user.id)}`, {
				app_metadata: { ...current.app_metadata, login_alias: alias },
			});
			written++;
		}
	}
	return { apply, duplicates, planned: planned.length, written };
}

/**
 * Names the failure without echoing the error message, which may carry the endpoint or a response
 * body: an HTTP status from the Auth API, a timeout, a network error, or a configuration error.
 * A 401 or 403 means the service key does not belong to the SUPABASE_URL project.
 */
export function describeFailure(error) {
	const status = /\((\d{3})\)\.$/.exec(error instanceof Error ? error.message : '')?.[1];
	if (status) return `HTTP ${status}`;
	if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
	if (error instanceof TypeError) return 'network or invalid URL';
	return 'configuration or response';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const args = process.argv.slice(2);
		const connection = {
			url: process.env.SUPABASE_URL,
			serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
		};
		if (args.includes('--check')) {
			if (args.length !== 1) throw new Error('--check takes no other option.');
			const result = await auditLoginAliases(connection);
			console.log(JSON.stringify(result, null, 2));
			if (!result.ok) {
				console.error(
					'Login alias prerequisite is NOT met: accounts with a legacy-only or duplicate alias cannot log in by alias, ' +
						'or the target returned no accounts. ' +
						'See "Data prerequisites" in docs/core/release-process.md.',
				);
				process.exitCode = 1;
			}
		} else {
			if (
				args.some((arg) => !['--dry-run', '--apply'].includes(arg)) ||
				(args.includes('--apply') && args.includes('--dry-run'))
			)
				throw new Error('Use --dry-run (default), --apply or --check.');
			const result = await migrateLoginAliases({
				...connection,
				apply: args.includes('--apply'),
			});
			console.log(JSON.stringify(result, null, 2));
			if (result.duplicates.length) process.exitCode = 1;
		}
	} catch (error) {
		console.error(
			`Alias migration failed (${describeFailure(error)}). Verify configuration and Auth API availability; no credentials are logged.`,
		);
		process.exitCode = 1;
	}
}
