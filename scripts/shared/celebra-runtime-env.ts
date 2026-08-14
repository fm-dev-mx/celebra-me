/**
 * Deterministic local/Preview runtime env bootstrap for Celebra-me worktrees.
 *
 * Runtime connectivity ≠ mutation authorization.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { detectWorktreeLane, type WorktreeLaneDefinition } from './worktree-lane';

export const PREVIEW_PROJECT_REF = SUPABASE_PROJECT_REFS.preview;
export const PRODUCTION_PROJECT_REF = SUPABASE_PROJECT_REFS.production;
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

export type SupabaseUrlClass =
	'local' | 'preview' | 'production' | 'other-remote' | 'invalid' | 'missing';

export type RuntimeTarget = 'local' | 'preview' | 'production';

/** Keys that local/Preview env files may override during NODE_ENV=development. */
export const RUNTIME_OVERRIDE_KEYS = new Set([
	'SUPABASE_URL',
	'SUPABASE_ANON_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'PUBLIC_SUPABASE_URL',
	'PUBLIC_SUPABASE_ANON_KEY',
	'BASE_URL',
	'NODE_ENV',
	'TRUST_DEVICE_SECRET',
	'TRUST_DEVICE_MAX_AGE_DAYS',
	'RSVP_CLAIM_CODE_PEPPER',
	'INTAKE_TOKEN_ENCRYPTION_KEY',
	'UPSTASH_REDIS_REST_URL',
	'UPSTASH_REDIS_REST_TOKEN',
	'RSVP_V2_DISTRIBUTED_RATELIMIT',
	'SUPER_ADMIN_EMAILS',
	'RSVP_ADMIN_USER',
	'RSVP_ADMIN_PASSWORD',
	'LOCAL_SUPER_ADMIN_PASSWORD',
	'REQUIRE_FRESH_MFA_FOR_ADMIN',
	'DEV_MFA_BYPASS',
	'PREVIEW_MFA_BYPASS',
	'PREVIEW_ADMIN_EMAILS',
	'VERCEL_AUTOMATION_BYPASS_SECRET',
	'GMAIL_USER',
	'GMAIL_PASS',
	'CONTACT_FORM_RECIPIENT_EMAIL',
	'CONTACT_WHATSAPP',
	'PUBLIC_GOOGLE_ANALYTICS_ID',
	'PUBLIC_GA_MEASUREMENT_ID',
	'PUBLIC_META_PIXEL_ID',
	'PUBLIC_META_PIXEL_ENABLED',
	'META_CAPI_DELIVERY_MODE',
	'META_CAPI_ACCESS_TOKEN',
	'META_TEST_EVENT_CODE',
	'CELEBRA_RUNTIME_TARGET',
	'CLOUDINARY_CLOUD_NAME',
	'CLOUDINARY_API_KEY',
	'CLOUDINARY_API_SECRET',
]);

/** Runtime Supabase keys that Preview lane must source from `.env.preview.local`. */
export const PREVIEW_RUNTIME_SUPABASE_KEYS = [
	'SUPABASE_URL',
	'PUBLIC_SUPABASE_URL',
	'SUPABASE_ANON_KEY',
	'PUBLIC_SUPABASE_ANON_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/**
 * Vite-compatible env file merge (no vite import — keeps Jest/Node consumers light).
 * Order: `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local` (later wins).
 */
export function loadModeEnvFiles(mode: string, cwd: string): Record<string, string> {
	const merged: Record<string, string> = {};
	for (const fileName of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
		const file = readEnvFile(cwd, fileName);
		if (!file) continue;
		Object.assign(merged, file.values);
	}
	return merged;
}

export function parseEnvContent(content: string): Record<string, string> {
	const parsed: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		const inlineComment = value.match(/^(.*?)(\s+#.*)$/);
		if (inlineComment) value = inlineComment[1]?.trim() ?? value;
		parsed[key] = value;
	}
	return parsed;
}

export function readEnvFile(
	root: string,
	fileName: string,
): { path: string; values: Record<string, string> } | null {
	const path = resolve(root, fileName);
	if (!existsSync(path)) return null;
	return { path, values: parseEnvContent(readFileSync(path, 'utf8')) };
}

export function classifySupabaseUrl(urlString: string | undefined): SupabaseUrlClass {
	if (!urlString?.trim()) return 'missing';
	try {
		const url = new URL(urlString.trim());
		if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
			if (url.port === '54321') return 'local';
			return 'invalid';
		}
		if (url.protocol !== 'https:') return 'invalid';
		const match = url.hostname.match(/^([^.]+)\.supabase\.(?:co|com)$/i);
		if (!match?.[1]) return 'other-remote';
		const ref = match[1].toLowerCase();
		if (ref === PREVIEW_PROJECT_REF) return 'preview';
		if (ref === PRODUCTION_PROJECT_REF) return 'production';
		return 'other-remote';
	} catch {
		return 'invalid';
	}
}

export function assertRuntimeSupabaseIdentity(
	env: Record<string, string | undefined>,
	expectedTarget: 'local' | 'preview',
): void {
	const serverUrl = env.SUPABASE_URL ?? '';
	const publicUrl = env.PUBLIC_SUPABASE_URL ?? '';
	const serverClass = classifySupabaseUrl(serverUrl);
	const publicClass = classifySupabaseUrl(publicUrl);

	if (!serverUrl || !publicUrl) {
		throw new Error(
			`Incomplete ${expectedTarget} runtime configuration: SUPABASE_URL and PUBLIC_SUPABASE_URL are required.`,
		);
	}
	if (serverClass !== publicClass) {
		throw new Error(
			'Mixed Supabase configuration: SUPABASE_URL and PUBLIC_SUPABASE_URL must target the same project.',
		);
	}
	if (serverUrl.replace(/\/$/, '') !== publicUrl.replace(/\/$/, '')) {
		throw new Error(
			'Mixed Supabase configuration: SUPABASE_URL and PUBLIC_SUPABASE_URL must be identical origins.',
		);
	}
	if (expectedTarget === 'local') {
		if (serverClass !== 'local') {
			throw new Error(
				`Local runtime requires Local Supabase (${LOCAL_SUPABASE_URL}); received a ${serverClass} target.`,
			);
		}
		return;
	}

	if (serverClass === 'production') {
		throw new Error('Preview runtime rejected Production Supabase credentials.');
	}
	if (serverClass !== 'preview') {
		throw new Error(
			`Preview runtime requires Preview project ${PREVIEW_PROJECT_REF}; received a ${serverClass} target.`,
		);
	}
	for (const key of PREVIEW_RUNTIME_SUPABASE_KEYS) {
		if (!env[key]?.trim()) {
			throw new Error(
				`Incomplete Preview runtime configuration: ${key} is required in .env.preview.local.`,
			);
		}
	}
}

export function resolveRuntimeTarget(
	options: {
		cwd?: string;
		env?: NodeJS.ProcessEnv;
	} = {},
): {
	target: RuntimeTarget;
	lane: WorktreeLaneDefinition;
	source: string;
} {
	const env = options.env ?? process.env;
	const cwd = options.cwd ?? process.cwd();
	const lane = detectWorktreeLane(cwd);
	const vercelEnv = (env.VERCEL_ENV ?? '').trim().toLowerCase();

	if (vercelEnv === 'production') {
		return { target: 'production', lane, source: 'vercel' };
	}
	if (vercelEnv === 'preview') {
		return { target: 'preview', lane, source: 'vercel-preview' };
	}

	const override = (env.CELEBRA_RUNTIME_TARGET ?? '').trim().toLowerCase();
	if (override === 'local' || override === 'preview') {
		return { target: override, lane, source: 'CELEBRA_RUNTIME_TARGET' };
	}

	return {
		target: lane.runtimeDefault,
		lane,
		source: `worktree:${lane.id}`,
	};
}

function overlayPreviewRuntimeFile(
	cwd: string,
	merged: Record<string, string>,
	validate: boolean,
): void {
	const previewFile = readEnvFile(cwd, '.env.preview.local');
	if (!previewFile) {
		if (validate) {
			throw new Error(
				'Preview runtime lane requires .env.preview.local with Preview SUPABASE_* values. See .env.preview.local.example.',
			);
		}
		return;
	}
	Object.assign(merged, previewFile.values);
}

function applyMergedEnvToProcess(
	merged: Record<string, string>,
	options: { isLocalDev: boolean; isVercel: boolean },
): void {
	for (const [key, value] of Object.entries(merged)) {
		if (options.isLocalDev && !options.isVercel && RUNTIME_OVERRIDE_KEYS.has(key)) {
			process.env[key] = value;
			continue;
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

function ensureLocalRuntimeTarget(defaultTarget: 'local' | 'preview'): 'local' | 'preview' {
	if (!process.env.CELEBRA_RUNTIME_TARGET?.trim()) {
		process.env.CELEBRA_RUNTIME_TARGET = defaultTarget;
	}
	return process.env.CELEBRA_RUNTIME_TARGET.trim().toLowerCase() === 'preview'
		? 'preview'
		: 'local';
}

export function bootstrapCelebraRuntimeEnv(
	options: {
		cwd?: string;
		mode?: string;
		validate?: boolean;
		loadEnvFn?: (mode: string, cwd: string) => Record<string, string>;
	} = {},
): {
	lane: WorktreeLaneDefinition;
	target: RuntimeTarget;
	source: string;
	env: NodeJS.ProcessEnv;
} {
	const cwd = options.cwd ?? process.cwd();
	const mode = options.mode ?? process.env.NODE_ENV ?? 'development';
	const validate = options.validate !== false;
	const loadEnvFn = options.loadEnvFn ?? loadModeEnvFiles;
	const isLocalDev = (process.env.NODE_ENV ?? mode) === 'development';
	const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

	const resolved = resolveRuntimeTarget({ cwd, env: process.env });
	const merged: Record<string, string> = { ...loadEnvFn(mode, cwd) };

	if (!isVercel && resolved.target === 'preview') {
		overlayPreviewRuntimeFile(cwd, merged, validate);
	}

	const laneDefault: 'local' | 'preview' = resolved.target === 'preview' ? 'preview' : 'local';
	if (!process.env.CELEBRA_RUNTIME_TARGET?.trim() && !isVercel) {
		merged.CELEBRA_RUNTIME_TARGET = laneDefault;
	}

	applyMergedEnvToProcess(merged, { isLocalDev, isVercel });

	const effectiveTarget = isVercel ? resolved.target : ensureLocalRuntimeTarget(laneDefault);

	if (
		validate &&
		!isVercel &&
		isLocalDev &&
		(effectiveTarget === 'local' || effectiveTarget === 'preview')
	) {
		assertRuntimeSupabaseIdentity(process.env, effectiveTarget);
	}

	return {
		lane: resolved.lane,
		target: effectiveTarget,
		source: resolved.source,
		env: process.env,
	};
}
