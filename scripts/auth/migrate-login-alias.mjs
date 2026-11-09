import { pathToFileURL } from 'node:url';
import {
	extractApiProjectRef,
	SUPABASE_PROJECT_REFS,
} from '../../src/lib/intake/mutations/environment-identity.ts';

const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

function planAliases(users) {
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

/** Audit the entire directory before writing: one collision blocks the whole run. */
export async function migrateLoginAliases({ url, serviceKey, apply = false, fetchImpl = fetch }) {
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
	const users = [];
	for (let page = 1; ; page++) {
		const result = await request(`admin/users?page=${page}&per_page=100`);
		if (
			!Array.isArray(result.users) ||
			result.users.some((user) => typeof user?.id !== 'string')
		)
			throw new Error('Invalid Auth users response.');
		users.push(...result.users);
		if (result.users.length < 100) break;
	}
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const args = process.argv.slice(2);
		if (
			args.some((arg) => !['--dry-run', '--apply'].includes(arg)) ||
			(args.includes('--apply') && args.includes('--dry-run'))
		)
			throw new Error('Use --dry-run (default) or --apply.');
		const result = await migrateLoginAliases({
			url: process.env.SUPABASE_URL,
			serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
			apply: args.includes('--apply'),
		});
		console.log(JSON.stringify(result, null, 2));
		if (result.duplicates.length) process.exitCode = 1;
	} catch {
		console.error(
			'Alias migration failed. Verify configuration and Auth API availability; no credentials are logged.',
		);
		process.exitCode = 1;
	}
}
