/**
 * Uploads the application Worker secrets with `wrangler secret bulk --env <preview|production>`.
 * Only the names on the environment's allow-list below travel; identity variables
 * (`CELEBRA_DEPLOY_ENV`, Supabase URLs, `BASE_URL`) are `vars` in `wrangler.jsonc` and never
 * secrets. The script prints names and counts, never values.
 *
 * Preview reads the lane's `.env.preview.local`. Production has no lane file: the operator passes
 * a one-off file (for example a previous host's Production variables) with `--env-file`, and deletes it
 * afterwards. A file whose Supabase URL names another project is refused.
 *
 * Usage: tsx scripts/ops/cloudflare-worker-secrets.ts [--env preview|production] [--env-file <path>] [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';

const WRANGLER_BIN = 'node_modules/wrangler/bin/wrangler.js';

export type CloudflareWorkerEnvironment = 'preview' | 'production';

/** Hosted runtime secrets both application Workers read (`src/env.d.ts` names minus the `vars`). */
const SHARED_SECRET_NAMES: readonly string[] = [
	'SUPABASE_ANON_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'PUBLIC_SUPABASE_ANON_KEY',
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
	'MEMORIES_R2_BUCKET_NAME',
	'SUPER_ADMIN_EMAILS',
	'SUPABASE_MANAGEMENT_TOKEN',
	'META_CAPI_DELIVERY_MODE',
	'META_CAPI_ACCESS_TOKEN',
	'META_PIXEL_ID',
	'META_TEST_EVENT_CODE',
	'TRUST_DEVICE_SECRET',
	'TRUST_DEVICE_MAX_AGE_DAYS',
	'REQUIRE_FRESH_MFA_FOR_ADMIN',
	'PREVIEW_MEDIA_SECRET',
];

/** Allow-list per environment; Preview-only switches never reach Production. */
export const CLOUDFLARE_WORKER_SECRET_NAMES: Readonly<
	Record<CloudflareWorkerEnvironment, readonly string[]>
> = {
	preview: [
		...SHARED_SECRET_NAMES,
		'SUPABASE_PROJECT_REF_PREVIEW',
		'PREVIEW_MFA_BYPASS',
		'PREVIEW_ADMIN_EMAILS',
	],
	production: [...SHARED_SECRET_NAMES, 'SUPABASE_PROJECT_REF_PRODUCTION'],
};

/**
 * Names that must never reach the Worker even when the file carries them: identity `vars`
 * and Local-only switches.
 */
const ALWAYS_REFUSED = [
	'CELEBRA_DEPLOY_ENV',
	'CELEBRA_RUNTIME_TARGET',
	'SUPABASE_URL',
	'PUBLIC_SUPABASE_URL',
	'BASE_URL',
	'NODE_ENV',
	'DEV_MFA_BYPASS',
];

const REFUSED_NAMES: Readonly<Record<CloudflareWorkerEnvironment, ReadonlySet<string>>> = {
	preview: new Set([...ALWAYS_REFUSED, 'SUPABASE_PROJECT_REF_PRODUCTION']),
	production: new Set([
		...ALWAYS_REFUSED,
		'SUPABASE_PROJECT_REF_PREVIEW',
		'PREVIEW_MFA_BYPASS',
		'PREVIEW_ADMIN_EMAILS',
	]),
};

/** Lane files that must never feed the Production Worker. */
const LANE_ENV_FILES = new Set(['.env', '.env.local', '.env.preview.local', '.env.e2e.local']);

export interface SecretSelection {
	/** Allow-listed names with a non-empty value, ready for upload. */
	selected: Record<string, string>;
	/** Allow-listed names absent or empty in the file. */
	missing: string[];
	/** Names in the file that are not uploaded. */
	skipped: string[];
}

export function selectCloudflareWorkerSecrets(
	environment: CloudflareWorkerEnvironment,
	parsed: Record<string, string>,
): SecretSelection {
	const selected: Record<string, string> = {};
	const missing: string[] = [];
	for (const name of CLOUDFLARE_WORKER_SECRET_NAMES[environment]) {
		if (REFUSED_NAMES[environment].has(name))
			throw new Error(`${name} is both allowed and refused.`);
		const value = parsed[name]?.trim() ?? '';
		if (value) selected[name] = value;
		else missing.push(name);
	}
	const skipped = Object.keys(parsed)
		.filter((name) => !(name in selected) && !missing.includes(name))
		.sort();
	return { selected, missing, skipped };
}

/**
 * Refuses a file that belongs to another environment: any Supabase URL it carries must name the
 * target project. Throws with the variable name only, never its value.
 */
export function assertEnvFileMatchesEnvironment(
	environment: CloudflareWorkerEnvironment,
	parsed: Record<string, string>,
): void {
	const expected = `${SUPABASE_PROJECT_REFS[environment]}.supabase.co`;
	for (const name of ['SUPABASE_URL', 'PUBLIC_SUPABASE_URL']) {
		const value = parsed[name]?.trim();
		if (!value) continue;
		let host: string;
		try {
			host = new URL(value).hostname.toLowerCase();
		} catch {
			throw new Error(`${name} in the file is not a URL.`);
		}
		if (host !== expected)
			throw new Error(`${name} in the file belongs to another project, not ${environment}.`);
	}
}

export interface SecretsOptions {
	environment: CloudflareWorkerEnvironment;
	envFile: string;
	dryRun: boolean;
}

export function parseSecretsArgs(argv: string[]): SecretsOptions {
	const value = (name: string) => {
		const inline = argv.find((arg) => arg.startsWith(`${name}=`));
		if (inline) return inline.slice(name.length + 1);
		const index = argv.indexOf(name);
		return index >= 0 ? argv[index + 1] : undefined;
	};
	const environment = value('--env') ?? 'preview';
	if (environment !== 'preview' && environment !== 'production')
		throw new Error('--env must be "preview" or "production".');
	const envFile = value('--env-file');
	if (environment === 'production') {
		if (!envFile)
			throw new Error('Production needs --env-file <path>; no lane file feeds Production.');
		if (LANE_ENV_FILES.has(basename(envFile)))
			throw new Error(`${basename(envFile)} is a lane file and never feeds Production.`);
	}
	return {
		environment,
		envFile: envFile ?? '.env.preview.local',
		dryRun: argv.includes('--dry-run'),
	};
}

function main(): void {
	const options = parseSecretsArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
	const path = resolve(process.cwd(), options.envFile);
	if (!existsSync(path)) throw new Error(`${options.envFile} was not found.`);
	const parsed = parseEnv(readFileSync(path, 'utf8')) as Record<string, string>;
	assertEnvFileMatchesEnvironment(options.environment, parsed);
	const selection = selectCloudflareWorkerSecrets(options.environment, parsed);
	const names = Object.keys(selection.selected).sort();
	console.info(
		`Secrets selected for ${options.environment} (${names.length}): ${names.join(', ')}`,
	);
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
	execFileSync(process.execPath, [WRANGLER_BIN, 'secret', 'bulk', '--env', options.environment], {
		input: JSON.stringify(selection.selected),
		env: { ...process.env, CLOUDFLARE_ENV: options.environment },
		stdio: ['pipe', 'inherit', 'inherit'],
	});
	if (options.environment === 'production')
		console.info(`Delete ${options.envFile} now; it holds Production values.`);
}

if (process.argv[1] && /^cloudflare-worker-secrets\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : 'Secret upload failed.');
		process.exitCode = 1;
	}
}
