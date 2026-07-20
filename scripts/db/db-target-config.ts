/**
 * db-target-config.ts — Single Source of Truth for Database Target Configuration
 *
 * Neutral, static module defining target parameters, port allocations,
 * secret file locations, URL parsing, credential redaction, and target classification.
 *
 * This module HAS NO DEPENDENCIES on workflow, CLI, guard, or query modules.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DbTarget = 'production' | 'preview' | 'persistent-local' | 'disposable-test' | 'unknown';

export interface ClassificationResult {
	target: DbTarget;
	reason: string;
	dbUrl?: string;
}

export interface GuardResult {
	ok: boolean;
	errors: string[];
}

// ---------------------------------------------------------------------------
// Secret File Paths
// ---------------------------------------------------------------------------

export const PREVIEW_SECRET_FILES = [
	'.env.preview.local',
	'.env.preview',
	'.secrets/preview-db-url',
	'.tmp/secrets/preview-db-url',
] as const;

export const PROD_SECRET_FILES = [
	'.env.production.local',
	'.env.prod.local',
	'.secrets/prod-db-url',
	'.tmp/secrets/prod-db-url',
] as const;

// ---------------------------------------------------------------------------
// Static Target Configurations
// ---------------------------------------------------------------------------

/** Persistent Local Supabase (used by `pnpm dev` & local Docker). */
export const PERSISTENT_LOCAL = {
	projectId: 'celebra-me-rsvp',
	apiUrl: 'http://127.0.0.1:54321',
	dbPort: 54322,
	dbUser: 'postgres',
	dbPassword: 'postgres',
	dbName: 'postgres',
	dbHosts: ['127.0.0.1', 'localhost', '::1'] as readonly string[],
	studioPort: 54323,
	shadowPort: 54320,
} as const;

/** Dedicated Disposable Test Supabase / Docker environment. */
export const DISPOSABLE_TEST = {
	projectId: 'celebra-me-test',
	containerName: 'celebra-me-test-db',
	postgrestContainerName: 'celebra-me-test-postgrest',
	apiPort: 54331,
	dbPort: 54332,
	studioPort: 54333,
	shadowPort: 54330,
	dbUser: 'supabase_admin',
	dbPassword: 'postgres',
	dbName: 'postgres',
	dbHosts: ['127.0.0.1', 'localhost', '::1'] as readonly string[],
} as const;

/** Canonical Connection Strings */
export const LOCAL_DB_URL = `postgresql://${PERSISTENT_LOCAL.dbUser}:${PERSISTENT_LOCAL.dbPassword}@127.0.0.1:${PERSISTENT_LOCAL.dbPort}/${PERSISTENT_LOCAL.dbName}`;
export const DISPOSABLE_DB_URL = `postgresql://${DISPOSABLE_TEST.dbUser}:${DISPOSABLE_TEST.dbPassword}@127.0.0.1:${DISPOSABLE_TEST.dbPort}/${DISPOSABLE_TEST.dbName}`;

/** Cloud Supabase Host Suffixes */
const SUPABASE_HOST_SUFFIXES = ['.supabase.co', '.supabase.com'] as const;

// ---------------------------------------------------------------------------
// Secret Resolvers
// ---------------------------------------------------------------------------

export function getSecretFromEnvOrFiles(envVar: string, files: readonly string[]): string {
	if (process.env[envVar]?.trim()) {
		return process.env[envVar]!.trim();
	}
	for (const fileName of files) {
		const path = resolve(process.cwd(), fileName);
		if (!existsSync(path)) continue;
		const content = readFileSync(path, 'utf8').trim();
		if (content.includes(`${envVar}=`)) {
			const match = content.match(new RegExp(`${envVar}\\s*=\\s*["']?([^"'\r\n]+)["']?`));
			if (match?.[1]) return match[1].trim();
		} else if (content && !content.includes('\n')) {
			return content;
		}
	}
	return '';
}

export function resolveDbUrl(target: string, dbUrl?: string): string {
	if (dbUrl?.trim()) return dbUrl.trim();

	if (target === 'production') {
		return getSecretFromEnvOrFiles('PROD_DB_URL', PROD_SECRET_FILES);
	}
	if (target === 'preview') {
		return getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	}
	if (target === 'persistent-local') {
		return LOCAL_DB_URL;
	}
	if (target === 'disposable-test') {
		return DISPOSABLE_DB_URL;
	}
	return '';
}

// ---------------------------------------------------------------------------
// URL Parsing & Redaction Utilities
// ---------------------------------------------------------------------------

export function parseDbUrl(rawUrl: string): {
	protocol: string;
	user: string;
	password: string;
	hostname: string;
	port: number;
	pathname: string;
} | null {
	try {
		const url = new URL(rawUrl);
		if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
		const userVal = decodeURIComponent(url.username || '');
		return {
			protocol: url.protocol,
			user: userVal,
			password: decodeURIComponent(url.password || ''),
			hostname: url.hostname.toLowerCase(),
			port: parseInt(url.port || '5432', 10),
			pathname: (url.pathname || '/postgres').replace(/^\//, '') || 'postgres',
		};
	} catch {
		return null;
	}
}

export function redactDbUrl(rawUrl: string): string {
	const parsed = parseDbUrl(rawUrl);
	if (!parsed) return '<invalid-url>';
	const { protocol, user, hostname, port, pathname } = parsed;
	return `${protocol}//${user || '<user>'}:<redacted>@${hostname}:${port}/${pathname}`;
}

export function redactCredentials(text: string): string {
	const urlPattern = /(postgres(?:ql)?:\/\/)(?:[^\s@]+@)?(?:[^\s:]+(?::\d+)?\/[^\s]*)/gi;
	return text.replace(urlPattern, (_match, protocol) => `${protocol}<redacted>@<host>`);
}

// ---------------------------------------------------------------------------
// Target Classification
// ---------------------------------------------------------------------------

export function isLocalDbUrl(dbUrl: string): boolean {
	const parsed = parseDbUrl(dbUrl);
	if (!parsed) return false;
	const { hostname, port } = parsed;
	return (
		(PERSISTENT_LOCAL.dbHosts.includes(hostname) && port === PERSISTENT_LOCAL.dbPort) ||
		(DISPOSABLE_TEST.dbHosts.includes(hostname) && port === DISPOSABLE_TEST.dbPort)
	);
}

export function classifyDbTarget(
	dbUrl: string,
	options?: { apiUrl?: string },
): ClassificationResult {
	const parsed = parseDbUrl(dbUrl);
	if (!parsed) {
		return { target: 'unknown', reason: 'Invalid or non-postgres URL' };
	}

	const { hostname, port } = parsed;

	// 1. Preview check: matches PREVIEW_DB_URL
	const previewDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (previewDbUrl) {
		const previewParsed = parseDbUrl(previewDbUrl);
		if (
			dbUrl === previewDbUrl ||
			(previewParsed && parsed.hostname === previewParsed.hostname && parsed.port === previewParsed.port)
		) {
			return {
				target: 'preview',
				reason: `Matches PREVIEW_DB_URL (host=${hostname}, port=${port})`,
				dbUrl,
			};
		}
	}

	// 2. Production check: cloud Supabase host
	if (SUPABASE_HOST_SUFFIXES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix))) {
		return { target: 'production', reason: `Supabase cloud host: ${hostname}`, dbUrl };
	}

	// 3. Disposable test check
	if (DISPOSABLE_TEST.dbHosts.includes(hostname) && port === DISPOSABLE_TEST.dbPort) {
		return {
			target: 'disposable-test',
			reason: `Disposable test environment (host=${hostname}, port=${port})`,
			dbUrl,
		};
	}

	// 4. Persistent local check
	if (PERSISTENT_LOCAL.dbHosts.includes(hostname) && port === PERSISTENT_LOCAL.dbPort) {
		if (options?.apiUrl) {
			try {
				const apiParsed = new URL(options.apiUrl);
				if (
					!PERSISTENT_LOCAL.dbHosts.includes(apiParsed.hostname.toLowerCase()) ||
					apiParsed.port !== String(PERSISTENT_LOCAL.apiUrl.split(':')[2])
				) {
					return {
						target: 'unknown',
						reason: `Port matches persistent-local but API URL ${options.apiUrl} does not match expected ${PERSISTENT_LOCAL.apiUrl}`,
						dbUrl,
					};
				}
			} catch {
				return { target: 'unknown', reason: 'Invalid API URL provided', dbUrl };
			}
		}

		return {
			target: 'persistent-local',
			reason: `Persistent local environment (host=${hostname}, port=${port})`,
			dbUrl,
		};
	}

	// 5. Local but non-standard port
	if (PERSISTENT_LOCAL.dbHosts.includes(hostname)) {
		return {
			target: 'unknown',
			reason: `Local host ${hostname} on non-standard port ${port} — cannot classify`,
			dbUrl,
		};
	}

	return { target: 'unknown', reason: `Unrecognized host: ${hostname}`, dbUrl };
}
