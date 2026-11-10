import { pathToFileURL } from 'node:url';
import {
	extractApiProjectRef,
	SUPABASE_PROJECT_REFS,
} from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	isTemporaryPasswordExpired,
	TEMP_PASSWORD_EXPIRES_KEY,
	TEMP_PASSWORD_TTL_MS,
} from '../../src/lib/rsvp/auth/temporary-password.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function validateEndpoint(url) {
	const endpoint = new URL(url);
	if (
		endpoint.protocol !== 'https:' &&
		!(['localhost', '127.0.0.1'].includes(endpoint.hostname) && endpoint.protocol === 'http:')
	) {
		throw new Error('Use HTTPS or a loopback HTTP endpoint.');
	}
	return endpoint;
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

function createAuthAdmin({ url, serviceKey, fetchImpl }) {
	if (!url || !serviceKey)
		throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
	const endpoint = validateEndpoint(url);
	async function request(path) {
		const response = await fetchImpl(`${endpoint.origin}/auth/v1/${path}`, {
			method: 'GET',
			headers: {
				apikey: serviceKey,
				Authorization: `Bearer ${serviceKey}`,
				'Content-Type': 'application/json',
			},
			signal: AbortSignal.timeout(5000),
			redirect: 'error',
		});
		if (!response.ok) throw new Error(`Auth request failed (${response.status}).`);
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
	return { listUsers, target: describeTarget(endpoint) };
}

/**
 * Computes age in days and expiry status for an account with must_change_password open.
 */
export function evaluateAccountPasswordStatus(user, now = Date.now()) {
	const appMetadata = user.app_metadata;
	const isPending = appMetadata?.must_change_password === true;
	if (!isPending) return null;

	const expired = isTemporaryPasswordExpired(appMetadata, now);

	let issuedAt = NaN;
	const rawExpires = appMetadata?.[TEMP_PASSWORD_EXPIRES_KEY];
	if (typeof rawExpires === 'string') {
		const parsedExpires = Date.parse(rawExpires);
		if (Number.isFinite(parsedExpires)) {
			issuedAt = parsedExpires - TEMP_PASSWORD_TTL_MS;
		}
	}
	if (!Number.isFinite(issuedAt)) {
		const rawDate = user.updated_at || user.created_at;
		if (typeof rawDate === 'string') {
			const parsed = Date.parse(rawDate);
			if (Number.isFinite(parsed)) issuedAt = parsed;
		}
	}
	if (!Number.isFinite(issuedAt)) {
		issuedAt = now;
	}

	const ageMs = Math.max(0, now - issuedAt);
	const ageDays = Math.floor(ageMs / ONE_DAY_MS);

	return { isPending: true, expired, ageDays };
}

/**
 * Aggregates statistics for pending password changes.
 * Returns only anonymous totals and day buckets. Never logs or returns user ids or emails.
 */
export function summarizePendingPasswords(users, now = Date.now()) {
	let pendingPasswords = 0;
	let active = 0;
	let expired = 0;
	let oldestDays = 0;
	let newestDays = 0;
	let hasPending = false;

	const ageDays = {
		'0-1': 0,
		'2-7': 0,
		'8-30': 0,
		'>30': 0,
	};

	for (const user of users) {
		const status = evaluateAccountPasswordStatus(user, now);
		if (!status) continue;

		pendingPasswords++;
		if (status.expired) expired++;
		else active++;

		if (!hasPending) {
			oldestDays = status.ageDays;
			newestDays = status.ageDays;
			hasPending = true;
		} else {
			if (status.ageDays > oldestDays) oldestDays = status.ageDays;
			if (status.ageDays < newestDays) newestDays = status.ageDays;
		}

		if (status.ageDays <= 1) ageDays['0-1']++;
		else if (status.ageDays <= 7) ageDays['2-7']++;
		else if (status.ageDays <= 30) ageDays['8-30']++;
		else ageDays['>30']++;
	}

	return {
		pendingPasswords,
		active,
		expired,
		ageDays,
		oldestDays,
		newestDays,
	};
}

/**
 * Read-only check of the data prerequisite "auth-must-change-password": reports accounts with
 * `must_change_password` open and their age in days. Returns totals only, never an email or an
 * account id, so the output can be pasted as release evidence.
 *
 * In advisory mode (default), ok is true when the directory returned accounts, with warnings on
 * stderr if pending passwords exist. In strict mode (--strict), ok requires 0 pending accounts.
 */
export async function auditPendingPasswords({
	url,
	serviceKey,
	fetchImpl = fetch,
	now = Date.now(),
	strict = false,
}) {
	const { listUsers, target } = createAuthAdmin({ url, serviceKey, fetchImpl });
	const users = await listUsers();
	const summary = summarizePendingPasswords(users, now);
	const ok = users.length > 0 && (strict ? summary.pendingPasswords === 0 : true);
	const clean = users.length > 0 && summary.pendingPasswords === 0;

	return {
		target,
		accounts: users.length,
		...summary,
		ok,
		clean,
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const args = process.argv.slice(2);
		const strict = args.includes('--strict');
		const allowedArgs = ['--strict', '--check'];
		if (args.some((arg) => !allowedArgs.includes(arg))) {
			throw new Error('Use --check (default) or --strict.');
		}
		const connection = {
			url: process.env.SUPABASE_URL,
			serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
		};
		const result = await auditPendingPasswords({
			...connection,
			strict,
		});
		console.log(JSON.stringify(result, null, 2));
		if (!result.ok) {
			if (result.accounts === 0) {
				console.error(
					'Pending password check failed: target returned no accounts. ' +
						'Verify SUPABASE_URL and key.',
				);
			} else {
				console.error(
					`Pending password check failed: ${result.pendingPasswords} account(s) have must_change_password open (--strict).`,
				);
			}
			process.exitCode = 1;
		} else if (result.pendingPasswords > 0) {
			console.warn(
				`Advisory: ${result.pendingPasswords} account(s) have must_change_password open (oldest: ${result.oldestDays}d). ` +
					'Review age before release.',
			);
		}
	} catch {
		console.error(
			'Pending password check failed. Verify configuration and Auth API availability; no credentials are logged.',
		);
		process.exitCode = 1;
	}
}
