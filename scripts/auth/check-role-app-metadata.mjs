import { pathToFileURL } from 'node:url';
import {
	extractApiProjectRef,
	SUPABASE_PROJECT_REFS,
} from '../../src/lib/intake/mutations/environment-identity.ts';

const validRole = (role) => role === 'super_admin' || role === 'host_client';

/** app_user_roles is authoritative; two absent or invalid roles never prove access is ready. */
export function compareRoles(users, rows) {
	const roles = new Map(rows.map((row) => [row.user_id, row.role]));
	const accounts = new Set(users.map((user) => user.id));
	const matching = users.filter((user) => {
		const role = roles.get(user.id);
		return validRole(role) && user.app_metadata?.role === role;
	}).length;
	const differing = users.length - matching;
	const orphanRoles = rows.filter((row) => !accounts.has(row.user_id)).length;
	return {
		accounts: users.length,
		matching,
		differing,
		orphanRoles,
		ok: users.length > 0 && differing === 0 && orphanRoles === 0,
	};
}

function resolveEndpoint(url) {
	const endpoint = new URL(url);
	if (
		endpoint.protocol !== 'https:' &&
		!(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))
	)
		throw new Error('Use HTTPS or a loopback HTTP endpoint.');
	let target = 'unknown';
	try {
		const ref = extractApiProjectRef(endpoint.origin);
		target =
			Object.entries(SUPABASE_PROJECT_REFS).find(([, value]) => value === ref)?.[0] ?? target;
	} catch {
		// A custom endpoint cannot certify one of the canonical environments.
	}
	return { endpoint, target };
}

function requireUniqueIds(records, key, seen) {
	for (const record of records) {
		const id = record?.[key];
		if (typeof id !== 'string' || !id || seen.has(id))
			throw new Error('Invalid or repeated directory record.');
		seen.add(id);
	}
}

/** Reads both complete directories, even when the server caps pages below the requested size. */
export async function auditRoles({ url, serviceKey, fetchImpl = fetch }) {
	if (!url || !serviceKey)
		throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
	const { endpoint, target } = resolveEndpoint(url);
	async function read(path) {
		const response = await fetchImpl(`${endpoint.origin}/${path}`, {
			method: 'GET',
			headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
			signal: AbortSignal.timeout(5000),
			redirect: 'error',
		});
		if (!response.ok) throw new Error('Role prerequisite request failed.');
		return response.json();
	}
	const users = [];
	const userIds = new Set();
	for (let page = 1; ; page++) {
		const result = await read(`auth/v1/admin/users?page=${page}&per_page=100`);
		if (!Array.isArray(result?.users)) throw new Error('Invalid Auth users response.');
		if (result.users.length === 0) break;
		requireUniqueIds(result.users, 'id', userIds);
		users.push(...result.users);
	}
	const rows = [];
	const roleIds = new Set();
	for (;;) {
		const result = await read(
			`rest/v1/app_user_roles?select=user_id,role&order=user_id.asc&limit=100&offset=${rows.length}`,
		);
		if (!Array.isArray(result)) throw new Error('Invalid application roles response.');
		if (result.length === 0) break;
		requireUniqueIds(result, 'user_id', roleIds);
		rows.push(...result);
	}
	return { target, ...compareRoles(users, rows) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		if (process.argv.length !== 2) throw new Error('This read-only command takes no options.');
		const result = await auditRoles({
			url: process.env.SUPABASE_URL,
			serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
		});
		console.log(JSON.stringify(result, null, 2));
		if (!result.ok) {
			console.error(
				'Role prerequisite is NOT met. See "Data prerequisites" in docs/core/release-process.md.',
			);
			process.exitCode = 1;
		}
	} catch {
		console.error(
			'Role check failed. Verify configuration and API availability; no credentials are logged.',
		);
		process.exitCode = 1;
	}
}
