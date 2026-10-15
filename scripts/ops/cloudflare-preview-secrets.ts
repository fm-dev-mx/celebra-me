/**
 * Uploads the Preview Worker secrets with `wrangler secret bulk --env preview`, taking the
 * values from the lane's `.env.preview.local`. Only the names on the allow-list below travel;
 * identity variables (`CELEBRA_DEPLOY_ENV`, Supabase URLs, `BASE_URL`) are `vars` in
 * `wrangler.jsonc` and never secrets. The script prints names and counts, never values.
 *
 * Usage: tsx scripts/ops/cloudflare-preview-secrets.ts [--env-file .env.preview.local] [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseEnv } from 'node:util';

const DEFAULT_ENV_FILE = '.env.preview.local';
const WRANGLER_BIN = 'node_modules/wrangler/bin/wrangler.js';
const WRANGLER_ENV = 'preview';

/**
 * Hosted runtime secrets the application reads on Preview (`src/env.d.ts` names minus the
 * `vars`, the build-provided identity and the local-only switches).
 */
export const CLOUDFLARE_PREVIEW_SECRET_NAMES: readonly string[] = [
	'SUPABASE_ANON_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'PUBLIC_SUPABASE_ANON_KEY',
	'GMAIL_USER',
	'GMAIL_PASS',
	'CONTACT_FORM_RECIPIENT_EMAIL',
	'CONTACT_WHATSAPP',
	'PUBLIC_GA_MEASUREMENT_ID',
	'PUBLIC_META_PIXEL_ID',
	'PUBLIC_META_PIXEL_ENABLED',
	'MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY',
	'MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY',
	'MEMORIES_PRIVATE_UPLOAD_ORIGIN',
	'MEMORIES_PRIVATE_RETRIEVAL_ORIGIN',
	'MEMORIES_SHARE_SECRET',
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW',
	'MEMORIES_R2_BUCKET_NAME',
	'MEMORIES_R2_BUCKET_NAME_PREVIEW',
	'CRON_SECRET',
	'SUPER_ADMIN_EMAILS',
	'SUPABASE_MANAGEMENT_TOKEN_PREVIEW',
	'SUPABASE_PROJECT_REF_PREVIEW',
	'CLOUDINARY_CLOUD_NAME',
	'CLOUDINARY_API_KEY',
	'CLOUDINARY_API_SECRET',
	'CLOUDINARY_USAGE_API_KEY',
	'CLOUDINARY_USAGE_API_SECRET',
	'META_CAPI_DELIVERY_MODE',
	'META_CAPI_ACCESS_TOKEN',
	'META_PIXEL_ID',
	'META_TEST_EVENT_CODE',
	'TRUST_DEVICE_SECRET',
	'TRUST_DEVICE_MAX_AGE_DAYS',
	'REQUIRE_FRESH_MFA_FOR_ADMIN',
	'PREVIEW_MEDIA_SECRET',
	'PREVIEW_MFA_BYPASS',
	'PREVIEW_ADMIN_EMAILS',
];

/** Names that must never reach the Worker even when the lane file carries them. */
const REFUSED_NAMES = new Set([
	'CELEBRA_DEPLOY_ENV',
	'CELEBRA_RUNTIME_TARGET',
	'SUPABASE_URL',
	'PUBLIC_SUPABASE_URL',
	'BASE_URL',
	'NODE_ENV',
	'DEV_MFA_BYPASS',
	'SUPABASE_MANAGEMENT_TOKEN',
	'SUPABASE_MANAGEMENT_TOKEN_PRODUCTION',
	'SUPABASE_PROJECT_REF_PRODUCTION',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
	'MEMORIES_R2_BUCKET_NAME_PRODUCTION',
]);

export interface SecretSelection {
	/** Allow-listed names with a non-empty value, ready for upload. */
	selected: Record<string, string>;
	/** Allow-listed names absent or empty in the file. */
	missing: string[];
	/** Names in the file that are not uploaded. */
	skipped: string[];
}

export function selectCloudflarePreviewSecrets(parsed: Record<string, string>): SecretSelection {
	const selected: Record<string, string> = {};
	const missing: string[] = [];
	for (const name of CLOUDFLARE_PREVIEW_SECRET_NAMES) {
		if (REFUSED_NAMES.has(name)) throw new Error(`${name} is both allowed and refused.`);
		const value = parsed[name]?.trim() ?? '';
		if (value) selected[name] = value;
		else missing.push(name);
	}
	const skipped = Object.keys(parsed)
		.filter((name) => !(name in selected) && !missing.includes(name))
		.sort();
	return { selected, missing, skipped };
}

function parseArgs(argv: string[]): { envFile: string; dryRun: boolean } {
	const value = (name: string) => {
		const inline = argv.find((arg) => arg.startsWith(`${name}=`));
		if (inline) return inline.slice(name.length + 1);
		const index = argv.indexOf(name);
		return index >= 0 ? argv[index + 1] : undefined;
	};
	return { envFile: value('--env-file') ?? DEFAULT_ENV_FILE, dryRun: argv.includes('--dry-run') };
}

function main(): void {
	const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
	const path = resolve(process.cwd(), options.envFile);
	if (!existsSync(path)) throw new Error(`${options.envFile} was not found in the current lane.`);
	const selection = selectCloudflarePreviewSecrets(
		parseEnv(readFileSync(path, 'utf8')) as Record<string, string>,
	);
	const names = Object.keys(selection.selected).sort();
	console.info(`Secrets selected for ${WRANGLER_ENV} (${names.length}): ${names.join(', ')}`);
	if (selection.missing.length)
		console.warn(
			`Allow-listed names without a value (${selection.missing.length}): ${selection.missing.join(', ')}`,
		);
	if (selection.skipped.length)
		console.info(
			`Names in the file left out (${selection.skipped.length}): ${selection.skipped.join(', ')}`,
		);
	if (options.dryRun) {
		console.info('Dry run: nothing uploaded.');
		return;
	}
	if (names.length === 0) throw new Error('No secret value to upload.');
	execFileSync(process.execPath, [WRANGLER_BIN, 'secret', 'bulk', '--env', WRANGLER_ENV], {
		input: JSON.stringify(selection.selected),
		env: { ...process.env, CLOUDFLARE_ENV: WRANGLER_ENV },
		stdio: ['pipe', 'inherit', 'inherit'],
	});
}

if (process.argv[1] && /^cloudflare-preview-secrets\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : 'Secret upload failed.');
		process.exitCode = 1;
	}
}
