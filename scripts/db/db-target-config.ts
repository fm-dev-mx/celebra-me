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
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DbTarget =
	'production' | 'preview' | 'persistent-local' | 'disposable-test' | 'unknown';

export interface ClassificationResult {
	target: DbTarget;
	reason: string;
	dbUrl?: string;
}

export interface GuardResult {
	ok: boolean;
	errors: string[];
}

export interface ValidatedTargetUrls {
	target: 'preview' | 'production';
	dbUrl: string;
	supabaseUrl: string;
	storageUrl: string;
	projectRef: string;
}

export function validateEnvironmentUrlsPreflight(input: {
	target: 'preview' | 'production';
	targetDbUrl: string;
	explicitSupabaseUrl?: string;
}): ValidatedTargetUrls {
	const { target, targetDbUrl, explicitSupabaseUrl } = input;
	if (!targetDbUrl || typeof targetDbUrl !== 'string') {
		throw new Error(`Target "${target}" requires a non-empty database connection URL.`);
	}
	const projectRef = extractSupabaseProjectRef(targetDbUrl);
	const expectedProjectRef = SUPABASE_PROJECT_REFS[target];

	if (projectRef !== expectedProjectRef) {
		throw new Error(
			`${target === 'preview' ? 'Preview' : 'Production'} promotion safety abort: expected project "${expectedProjectRef}", got "${projectRef}".`,
		);
	}

	let supabaseUrl = `https://${projectRef}.supabase.co`;
	if (explicitSupabaseUrl) {
		let parsedApi: URL;
		try {
			parsedApi = new URL(explicitSupabaseUrl);
		} catch {
			throw new Error(
				`Invalid explicit Supabase API URL provided: "${explicitSupabaseUrl}".`,
			);
		}
		if (
			parsedApi.hostname.includes('pooler.supabase.com') ||
			parsedApi.hostname.includes('pooler.supabase.co')
		) {
			throw new Error(
				`Supabase API URL "${explicitSupabaseUrl}" contains a pooler hostname. Pooler connection strings must never be used as HTTP or Storage API endpoints.`,
			);
		}
		const apiRef = parsedApi.hostname.replace('.supabase.co', '').replace('.supabase.com', '');
		if (apiRef !== projectRef) {
			throw new Error(
				`Cross-project URL mismatch: DB connection project reference ("${projectRef}") does not match API URL project reference ("${apiRef}").`,
			);
		}
		supabaseUrl = explicitSupabaseUrl.replace(/\/+$/, '');
	}

	const storageUrl = `${supabaseUrl}/storage/v1/object/public/invitation-assets`;

	return {
		target,
		dbUrl: targetDbUrl,
		supabaseUrl,
		storageUrl,
		projectRef,
	};
}

// ---------------------------------------------------------------------------
// Secret File Paths
// ---------------------------------------------------------------------------

export const PREVIEW_SECRET_FILES = [
	'.env.preview.local',
	'.env.preview',
	'.secrets/preview-db-url',
	'.tmp/secrets/preview-db-url',
	'.secrets/preview-supabase-service-role-key',
	'.tmp/secrets/preview-supabase-service-role-key',
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
export const LOCAL_DB_URL =
	`postgresql://${PERSISTENT_LOCAL.dbUser}:${PERSISTENT_LOCAL.dbPassword}` +
	`@127.0.0.1:${PERSISTENT_LOCAL.dbPort}/${PERSISTENT_LOCAL.dbName}`;
export const DISPOSABLE_DB_URL =
	`postgresql://${DISPOSABLE_TEST.dbUser}:${DISPOSABLE_TEST.dbPassword}` +
	`@127.0.0.1:${DISPOSABLE_TEST.dbPort}/${DISPOSABLE_TEST.dbName}`;

/** Cloud Supabase Host Suffixes */
const SUPABASE_HOST_SUFFIXES = ['.supabase.co', '.supabase.com'] as const;

// ---------------------------------------------------------------------------
// Secret Resolvers
// ---------------------------------------------------------------------------

export function getSecretFromEnvOrFiles(envVar: string, files: readonly string[]): string {
	if (process.env[envVar]?.trim()) {
		return process.env[envVar]!.trim();
	}
	const normalizedVar = envVar.toLowerCase().replace(/_/g, '-');
	for (const fileName of files) {
		const path = resolve(process.cwd(), fileName);
		if (!existsSync(path)) continue;
		const content = readFileSync(path, 'utf8').trim();
		if (!content) continue;
		if (content.includes(`${envVar}=`)) {
			const match = content.match(new RegExp(`${envVar}\\s*=\\s*["']?([^"'\r\n]+)["']?`));
			if (match?.[1]) return match[1].trim();
		} else if (fileName.toLowerCase().includes(normalizedVar)) {
			return content.trim();
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

	// 1. Disposable test check
	if (DISPOSABLE_TEST.dbHosts.includes(hostname) && port === DISPOSABLE_TEST.dbPort) {
		return {
			target: 'disposable-test',
			reason: `Disposable test environment (host=${hostname}, port=${port})`,
			dbUrl,
		};
	}

	// 2. Persistent local check
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

	// 3. Local but non-standard port
	if (PERSISTENT_LOCAL.dbHosts.includes(hostname)) {
		return {
			target: 'unknown',
			reason: `Local host ${hostname} on non-standard port ${port} — cannot classify`,
			dbUrl,
		};
	}

	// 4. Cloud Supabase check via project reference (direct host or pooler)
	try {
		const projectRef = extractSupabaseProjectRef(dbUrl);
		const previewDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
		let previewProjectRef: string = SUPABASE_PROJECT_REFS.preview;
		if (previewDbUrl) {
			try {
				previewProjectRef = extractSupabaseProjectRef(previewDbUrl);
			} catch {
				// Use fallback preview project ref if PREVIEW_DB_URL cannot yield a ref
			}
		}

		if (projectRef === previewProjectRef) {
			return {
				target: 'preview',
				reason: `Matches PREVIEW_DB_URL / Preview project reference (${projectRef})`,
				dbUrl,
			};
		}
		if (projectRef === SUPABASE_PROJECT_REFS.production) {
			return {
				target: 'production',
				reason: `Matches allowlisted Production project reference (${projectRef})`,
				dbUrl,
			};
		}
		return {
			target: 'unknown',
			reason: `Supabase project reference is not allowlisted (${projectRef})`,
			dbUrl,
		};
	} catch {
		// A cloud-shaped host without a verifiable allowlisted ref remains unknown.
		if (
			SUPABASE_HOST_SUFFIXES.some(
				(suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
			)
		) {
			return {
				target: 'unknown',
				reason: `Supabase cloud host does not expose an allowlisted project ref: ${hostname}`,
				dbUrl,
			};
		}
	}

	return { target: 'unknown', reason: `Unrecognized host: ${hostname}`, dbUrl };
}

/**
 * Extract the Supabase project reference from a DB URL.
 *
 * Supports two formats:
 *
 *   1. Direct DB host:  db.<project-ref>.supabase.co
 *      → extracted from hostname
 *
 *   2. Supabase Pooler: postgres.<project-ref>@<region>.pooler.supabase.com
 *      → extracted from username: the username must start exactly with
 *        "postgres." and the project ref is the segment after that prefix.
 *
 * Returns the project ref string, or throws a descriptive error if neither
 * format can be matched.
 */
export function extractSupabaseProjectRef(dbUrl: string): string {
	const parsed = parseDbUrl(dbUrl);
	if (!parsed) {
		throw new Error(`Cannot parse DB URL: ${redactDbUrl(dbUrl)}`);
	}

	const { hostname, user } = parsed;

	// 1. Pooler: exact hostname or dot-delimited subdomain of pooler.supabase.com
	if (hostname === 'pooler.supabase.com' || hostname.endsWith('.pooler.supabase.com')) {
		if (!user.includes('.')) {
			throw new Error(
				`Pooler URL username "${user}" does not contain a project reference segment. ` +
					`Expected format: postgres.<project-ref>`,
			);
		}
		const parts = user.split('.');
		// e.g. "postgres.iwipdvisoyerfdytuhwi" → ["postgres", "iwipdvisoyerfdytuhwi"]
		if (parts[0] !== 'postgres') {
			throw new Error(
				`Pooler URL username "${user}" does not start with "postgres.". ` +
					`Expected format: postgres.<project-ref>`,
			);
		}
		if (parts.length < 2 || !parts[1]) {
			throw new Error(
				`Pooler URL username "${user}" is missing the project reference segment. ` +
					`Expected format: postgres.<project-ref>`,
			);
		}
		if (parts.length > 2) {
			throw new Error(
				`Pooler URL username "${user}" has unexpected segments (${parts.length}). ` +
					`Expected exactly 2 segments: postgres.<project-ref>`,
			);
		}
		return parts[1];
	}

	// 2. Direct host: db.<ref>.supabase.co or <ref>.supabase.co
	const directMatch = hostname.match(/^(?:db\.)?([^.]+)\.supabase\.(co|com)$/);
	if (directMatch) {
		return directMatch[1];
	}

	throw new Error(
		`Cannot extract Supabase project reference from DB URL host="${hostname}" user="${user}". ` +
			`Expected db.<ref>.supabase.co or postgres.<ref>@pooler.supabase.com format.`,
	);
}

/**
 * Tables that must never be synced to Preview for privacy/security reasons.
 * Mirror-sync scripts use this to exclude guest, RSVP, tracking, and other
 * operational data from the Preview environment.
 */
export const EXCLUDED_TABLES = [
	'guest_invitations',
	'guest_invitation_audit',
	'event_claim_codes',
	'intake_requests',
	'intake_submissions',
	'audit_logs',
	'rsvp_records',
	'rsvp_audit_log',
	'rsvp_channel_log',
	'visitor_sessions',
	'commercial_attribution_identity',
	'commercial_analytics',
] as const;
