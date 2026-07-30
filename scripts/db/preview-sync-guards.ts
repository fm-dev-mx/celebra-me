/**
 * preview-sync-guards.ts — Environment Validation & Target Guards
 *
 * Validates that source is Production and target is Preview, rejects
 * misconfiguration, and updates the Preview admin user's role/profile.
 * Does NOT create or copy Auth users.
 */

import {
	fail,
	redactDbUrl,
	runPsql,
	sqlLiteral,
	assertProductionDbUrl,
} from './db-workflow-lib.ts';
import {
	classifyDbTarget,
	parseDbUrl as parseUrl,
	extractSupabaseProjectRef,
} from './db-target-config.ts';
import { getSecretFromEnvOrFiles as getPreviewSecret } from './db-guard.ts';
import { PREVIEW_SECRET_FILES } from './db-guard.ts';

export const PREVIEW_ADMIN_EMAIL = 'preview@preview.com';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProdContext {
	dbUrl: string;
	dbHost: string;
	supabaseUrl: string;
	supabaseProjectRef: string;
	storageUrl: string;
}

export interface PreviewContext {
	dbUrl: string;
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
	supabaseProjectRef: string;
	storageUrl: string;
	previewAdminUserId: string;
}

// ---------------------------------------------------------------------------
// Guard Functions
// ---------------------------------------------------------------------------

export function assertProductionIsProd(prodUrl: string, targetLabel: string): void {
	const prodClassification = classifyDbTarget(prodUrl);
	if (prodClassification.target !== 'production') {
		fail(
			`${targetLabel}: DB URL classifies as "${prodClassification.target}", not "production". ` +
				`Refusing to read from a non-production source. ${prodClassification.reason}`,
		);
	}
	assertProductionDbUrl(prodUrl);
}

export function assertPreviewIsPreview(previewUrl: string): void {
	const previewClassification = classifyDbTarget(previewUrl);
	if (previewClassification.target !== 'preview') {
		fail(
			`Write target classifies as "${previewClassification.target}", not "preview". ` +
				`Refusing to write to a non-preview target. ${previewClassification.reason}`,
		);
	}
}

export function assertNotSameProject(prodUrl: string, previewUrl: string): void {
	const prodRef = extractSupabaseProjectRef(prodUrl);
	const previewRef = extractSupabaseProjectRef(previewUrl);
	if (prodRef === previewRef) {
		fail(
			`SOURCE AND TARGET ARE THE SAME PROJECT (ref=${prodRef}). ` +
				`Refusing to proceed. Production and Preview must be different Supabase projects.`,
		);
	}
}

export function assertNotLocalTarget(url: string): void {
	const parsed = parseUrl(url);
	if (!parsed) fail(`Cannot parse URL: ${redactDbUrl(url)}`);
	const localHosts = ['127.0.0.1', 'localhost', '::1'];
	if (localHosts.includes(parsed.hostname)) {
		fail(
			`Refusing to use local database (${parsed.hostname}:${parsed.port}) as a sync target. ` +
				`This workflow requires a hosted Preview project.`,
		);
	}
}

export function assertNotDisposableTarget(url: string): void {
	const parsed = parseUrl(url);
	if (!parsed) return;
	if (parsed.hostname === '127.0.0.1' && parsed.port === 54332) {
		fail(
			`Refusing to use disposable test database (port 54332) as a sync target. ` +
				`This workflow requires a hosted Preview project.`,
		);
	}
}

// ---------------------------------------------------------------------------
// Preview Admin User Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the Preview administrator by email. Does NOT create Auth users.
 * Fails if zero or multiple users match.
 * Returns the user's UUID.
 */
export function resolvePreviewAdminUser(dbUrl: string): string {
	const result = runPsql(
		`select id::text from auth.users where email = ${sqlLiteral(PREVIEW_ADMIN_EMAIL)};`,
		dbUrl,
	);
	const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);

	if (lines.length === 0) {
		fail(
			`Preview administrator "${PREVIEW_ADMIN_EMAIL}" not found in auth.users. ` +
				`Create this user through the Supabase Auth dashboard or CLI before running the mirror. ` +
				`The sync workflow does not create Auth users automatically.`,
		);
	}
	if (lines.length > 1) {
		fail(
			`Multiple (${lines.length}) users found with email "${PREVIEW_ADMIN_EMAIL}" in auth.users. ` +
				`Expected exactly one. Cannot safely resolve the Preview administrator.`,
		);
	}

	return lines[0];
}

export function updatePreviewAdminRole(dbUrl: string, userId: string): void {
	// Update app_metadata.role — does NOT create user, does NOT reset password
	runPsql(
		`update auth.users
		 set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
		 where id = ${sqlLiteral(userId)};`,
		dbUrl,
	);
	// Upsert app_user_roles
	runPsql(
		`insert into public.app_user_roles (user_id, role)
		 values (${sqlLiteral(userId)}::uuid, 'super_admin')
		 on conflict (user_id) do update set role = 'super_admin';`,
		dbUrl,
	);
}

export function ensureHostProfile(dbUrl: string, userId: string): void {
	runPsql(
		`insert into public.host_profiles (user_id, display_name)
		 values (${sqlLiteral(userId)}::uuid, 'Preview Administrator')
		 on conflict (user_id) do update set display_name = 'Preview Administrator';`,
		dbUrl,
	);
}

// ---------------------------------------------------------------------------
// URL Resolution
// ---------------------------------------------------------------------------

const PREVIEW_SECRET_FILES_CONFIG = ['.env.preview.local'] as const;

const SERVICE_ROLE_SECRET_FILES = ['.env.preview.local'] as const;

export function getPreviewSupabaseUrl(): string {
	const fromEnv = getPreviewSecret('PREVIEW_SUPABASE_URL', PREVIEW_SECRET_FILES_CONFIG);
	if (fromEnv?.trim()) return fromEnv.trim();

	// Derive from PREVIEW_DB_URL using the shared project-ref resolver
	const previewDbUrl = getPreviewSecret('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (previewDbUrl) {
		try {
			const ref = extractSupabaseProjectRef(previewDbUrl);
			return `https://${ref}.supabase.co`;
		} catch {
			// fall through to fail below
		}
	}

	fail(
		'PREVIEW_SUPABASE_URL is required. Set it in the environment or in gitignored .env.preview.local',
	);
}

export function getPreviewServiceRoleKey(): string {
	const key = getPreviewSecret('PREVIEW_SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_SECRET_FILES);
	if (!key) {
		throw new Error(
			'PREVIEW_SUPABASE_SERVICE_ROLE_KEY is required for Storage operations. ' +
				'Set it in environment or .env.preview.local',
		);
	}
	return key;
}

/**
 * Derive the Supabase REST API URL from a DB connection string using the
 * shared project-ref resolver. Supports both direct and pooler URLs.
 */
export function deriveSupabaseUrlFromDbUrl(dbUrl: string): string {
	const ref = extractSupabaseProjectRef(dbUrl);
	return `https://${ref}.supabase.co`;
}

/**
 * Extract the project ref from an already-resolved Supabase REST URL.
 */
export function getProjectRefFromSupabaseUrl(url: string): string {
	try {
		const hostname = new URL(url).hostname;
		return hostname.replace('.supabase.co', '').replace('.supabase.com', '');
	} catch {
		return '';
	}
}

export function buildStorageUrl(supabaseUrl: string): string {
	return `${supabaseUrl}/storage/v1/object/public/invitation-assets`;
}

export function rewriteStorageUrl(
	content: string,
	prodStorageUrl: string,
	previewStorageUrl: string,
): string {
	if (!prodStorageUrl || !previewStorageUrl) return content;
	return content.replaceAll(prodStorageUrl, previewStorageUrl);
}
