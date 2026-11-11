/**
 * Pure guards and SQL builders for `pnpm db:preview:bootstrap-admin`.
 *
 * The Preview admin password is read from the environment inside the CLI process and is
 * only ever placed in SQL sent over psql stdin. It is never printed, logged or returned.
 */

import { extractSupabaseProjectRef, redactDbUrl } from './db-target-config.ts';
import { sqlLiteral } from './db-workflow-lib.ts';
import {
	EXPECTED_PREVIEW_ACCOUNT_EMAIL,
	EXPECTED_PREVIEW_ACCOUNT_ROLE,
	PREVIEW_SUPABASE_PROJECT_REF,
	PRODUCTION_SUPABASE_PROJECT_REF,
} from '../playwright/preview-environment.ts';

export const PREVIEW_ADMIN_BOOTSTRAP_SLUG = 'preview-admin';
export const PREVIEW_ADMIN_BOOTSTRAP_OPERATION = 'bootstrap-admin';
export const PREVIEW_ADMIN_BOOTSTRAP_SCOPE = `preview:${PREVIEW_ADMIN_BOOTSTRAP_SLUG}:${PREVIEW_ADMIN_BOOTSTRAP_OPERATION}`;
export const PREVIEW_ADMIN_PASSWORD_MIN_LENGTH = 8;

const ERROR_PREFIX = 'PREVIEW_ADMIN_BOOTSTRAP';

export interface PreviewAdminBootstrapArgs {
	apply: boolean;
	json: boolean;
	help: boolean;
}

export function parsePreviewAdminBootstrapArgs(argv: readonly string[]): PreviewAdminBootstrapArgs {
	const args: PreviewAdminBootstrapArgs = { apply: false, json: false, help: false };
	let sawDryRun = false;
	for (const arg of argv) {
		if (arg === '--apply') args.apply = true;
		else if (arg === '--dry-run') sawDryRun = true;
		else if (arg === '--json') args.json = true;
		else if (arg === '--help' || arg === '-h') args.help = true;
		else throw new Error(`${ERROR_PREFIX}_ARGS: Unknown argument "${arg}".`);
	}
	if (args.apply && sawDryRun) {
		throw new Error(`${ERROR_PREFIX}_ARGS: --apply and --dry-run are mutually exclusive.`);
	}
	return args;
}

/**
 * The DB URL must name the canonical Preview project. Production is always rejected,
 * even before the generic Preview check, so the error is unambiguous.
 */
export function assertPreviewAdminBootstrapDbTarget(dbUrl: string): string {
	let ref: string;
	try {
		ref = extractSupabaseProjectRef(dbUrl);
	} catch (error: unknown) {
		throw new Error(
			`${ERROR_PREFIX}_TARGET_REJECTED: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
	if (ref === PRODUCTION_SUPABASE_PROJECT_REF) {
		throw new Error(
			`${ERROR_PREFIX}_PRODUCTION_REJECTED: The Preview admin bootstrap never targets Production (${redactDbUrl(dbUrl)}).`,
		);
	}
	if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
		throw new Error(
			`${ERROR_PREFIX}_TARGET_REJECTED: Expected Preview project ref ${PREVIEW_SUPABASE_PROJECT_REF}, got ${ref}.`,
		);
	}
	return ref;
}

export interface PreviewAdminCredentials {
	email: string;
	password: string;
}

/**
 * Reads the Preview admin identity from the Preview Playwright env (`.env.e2e.local`).
 * Error messages name variables only, never values.
 */
export function requirePreviewAdminCredentials(env: NodeJS.ProcessEnv): PreviewAdminCredentials {
	const login = env.PLAYWRIGHT_HOST_LOGIN?.trim().toLowerCase();
	if (!login) {
		throw new Error(`${ERROR_PREFIX}_CREDENTIALS: PLAYWRIGHT_HOST_LOGIN is required.`);
	}
	if (login !== EXPECTED_PREVIEW_ACCOUNT_EMAIL) {
		throw new Error(
			`${ERROR_PREFIX}_CREDENTIALS: PLAYWRIGHT_HOST_LOGIN must be exactly ${EXPECTED_PREVIEW_ACCOUNT_EMAIL}.`,
		);
	}
	const password = env.PLAYWRIGHT_HOST_PASSWORD;
	if (!password) {
		throw new Error(`${ERROR_PREFIX}_CREDENTIALS: PLAYWRIGHT_HOST_PASSWORD is required.`);
	}
	if (password !== password.trim()) {
		throw new Error(
			`${ERROR_PREFIX}_CREDENTIALS: PLAYWRIGHT_HOST_PASSWORD must not start or end with whitespace.`,
		);
	}
	if (password.length < PREVIEW_ADMIN_PASSWORD_MIN_LENGTH) {
		throw new Error(
			`${ERROR_PREFIX}_CREDENTIALS: PLAYWRIGHT_HOST_PASSWORD must have at least ${PREVIEW_ADMIN_PASSWORD_MIN_LENGTH} characters.`,
		);
	}
	return { email: login, password };
}

export interface PreviewAdminStatus {
	passwordMatches: boolean;
	emailConfirmed: boolean;
	metadataRole: string;
	appUserRole: string;
}

export function isPreviewAdminReady(status: PreviewAdminStatus): boolean {
	return (
		status.passwordMatches &&
		status.emailConfirmed &&
		status.metadataRole === EXPECTED_PREVIEW_ACCOUNT_ROLE &&
		status.appUserRole === EXPECTED_PREVIEW_ACCOUNT_ROLE
	);
}

/** Read-only status query; compares the stored bcrypt hash without revealing it. */
export function buildPreviewAdminStatusSql(userId: string, password: string): string {
	return `select json_build_object(
  'passwordMatches', coalesce(u.encrypted_password like '$2%'
    and u.encrypted_password = extensions.crypt(${sqlLiteral(password)}, u.encrypted_password), false),
  'emailConfirmed', u.email_confirmed_at is not null,
  'metadataRole', coalesce(u.raw_app_meta_data->>'role', ''),
  'appUserRole', coalesce((select r.role::text from public.app_user_roles r where r.user_id = u.id), '')
)::text
from auth.users u
where u.id = ${sqlLiteral(userId)}::uuid;`;
}

/** Updates the existing Preview admin only. It never inserts an Auth user. */
export function buildPreviewAdminApplySql(userId: string, password: string): string {
	return `begin;
update auth.users
set encrypted_password = extensions.crypt(${sqlLiteral(password)}, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "${EXPECTED_PREVIEW_ACCOUNT_ROLE}"}'::jsonb,
    updated_at = now()
where id = ${sqlLiteral(userId)}::uuid
  and email = ${sqlLiteral(EXPECTED_PREVIEW_ACCOUNT_EMAIL)};
insert into public.app_user_roles (user_id, role)
values (${sqlLiteral(userId)}::uuid, '${EXPECTED_PREVIEW_ACCOUNT_ROLE}')
on conflict (user_id) do update set role = '${EXPECTED_PREVIEW_ACCOUNT_ROLE}';
commit;`;
}

export function parsePreviewAdminStatus(stdout: string): PreviewAdminStatus {
	const line = stdout
		.split(/\r?\n/)
		.map((value) => value.trim())
		.find((value) => value.startsWith('{'));
	if (!line) {
		throw new Error(`${ERROR_PREFIX}_STATUS: Preview admin status query returned no row.`);
	}
	const parsed = JSON.parse(line) as Record<string, unknown>;
	if (
		typeof parsed.passwordMatches !== 'boolean' ||
		typeof parsed.emailConfirmed !== 'boolean' ||
		typeof parsed.metadataRole !== 'string' ||
		typeof parsed.appUserRole !== 'string'
	) {
		throw new Error(
			`${ERROR_PREFIX}_STATUS: Preview admin status row has an unexpected shape.`,
		);
	}
	return {
		passwordMatches: parsed.passwordMatches,
		emailConfirmed: parsed.emailConfirmed,
		metadataRole: parsed.metadataRole,
		appUserRole: parsed.appUserRole,
	};
}
