import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import {
	CLOUDFLARE_WORKER_SECRET_NAMES,
	assertEnvFileMatchesEnvironment,
	parseSecretsArgs,
	selectCloudflareWorkerSecrets,
} from '../../scripts/ops/cloudflare-worker-secrets.ts';

const CLOUDFLARE_PREVIEW_SECRET_NAMES = CLOUDFLARE_WORKER_SECRET_NAMES.preview;
const selectCloudflarePreviewSecrets = (parsed: Record<string, string>) =>
	selectCloudflareWorkerSecrets('preview', parsed);

describe('Cloudflare Preview secret selection', () => {
	it('uploads only allow-listed names with a value and reports the rest by name', () => {
		const selection = selectCloudflarePreviewSecrets({
			SUPABASE_SERVICE_ROLE_KEY: ' service-role ',
			PREVIEW_MFA_BYPASS: '',
			SUPABASE_URL: 'https://iwipdvisoyerfdytuhwi.supabase.co',
			CELEBRA_DEPLOY_ENV: 'preview',
			DEV_MFA_BYPASS: 'true',
			SUPABASE_PROJECT_REF_PRODUCTION: 'never',
			PLAYWRIGHT_HOST_PASSWORD: 'script-only',
		});
		expect(selection.selected).toEqual({
			SUPABASE_SERVICE_ROLE_KEY: 'service-role',
		});
		expect(selection.missing).toContain('PREVIEW_MFA_BYPASS');
		expect(selection.missing).toContain('SUPABASE_ANON_KEY');
		expect(selection.skipped).toEqual([
			'CELEBRA_DEPLOY_ENV',
			'DEV_MFA_BYPASS',
			'PLAYWRIGHT_HOST_PASSWORD',
			'SUPABASE_PROJECT_REF_PRODUCTION',
			'SUPABASE_URL',
		]);
	});

	it('never allow-lists identity variables, build identity or Production-only names', () => {
		for (const name of [
			'CELEBRA_DEPLOY_ENV',
			'CELEBRA_BUILD_SHA',
			'CELEBRA_BUILD_REF',
			'CELEBRA_RUNTIME_TARGET',
			'SUPABASE_URL',
			'PUBLIC_SUPABASE_URL',
			'BASE_URL',
			'NODE_ENV',
			'DEV_MFA_BYPASS',
			'SUPABASE_PROJECT_REF_PRODUCTION',
		]) {
			expect(CLOUDFLARE_PREVIEW_SECRET_NAMES).not.toContain(name);
		}
		expect(new Set(CLOUDFLARE_PREVIEW_SECRET_NAMES).size).toBe(
			CLOUDFLARE_PREVIEW_SECRET_NAMES.length,
		);
	});

	it('lists every allow-listed name in the Preview lane template and no Production name', () => {
		const template = parseEnv(
			readFileSync(resolve(process.cwd(), '.env.preview.local.example'), 'utf8'),
		) as Record<string, string>;
		const names = Object.keys(template);
		expect(CLOUDFLARE_PREVIEW_SECRET_NAMES.filter((name) => !names.includes(name))).toEqual([]);
		expect(names.filter((name) => /PRODUCTION|^PROD_/.test(name))).toEqual([]);
		expect(selectCloudflarePreviewSecrets(template).skipped).toEqual(
			[
				'CELEBRA_RUNTIME_TARGET',
				'PREVIEW_DB_URL',
				'PREVIEW_SUPABASE_SERVICE_ROLE_KEY',
				'PREVIEW_SUPABASE_URL',
				'PUBLIC_SUPABASE_URL',
				'SUPABASE_URL',
			].sort(),
		);
	});
});

describe('Cloudflare Production secret selection', () => {
	const production = CLOUDFLARE_WORKER_SECRET_NAMES.production;

	it('keeps Preview-only switches and the Preview project ref out of Production', () => {
		for (const name of [
			'PREVIEW_MFA_BYPASS',
			'PREVIEW_ADMIN_EMAILS',
			'SUPABASE_PROJECT_REF_PREVIEW',
			'DEV_MFA_BYPASS',
			'CELEBRA_DEPLOY_ENV',
			'SUPABASE_URL',
			'BASE_URL',
		]) {
			expect(production).not.toContain(name);
		}
		expect(production).toContain('SUPABASE_PROJECT_REF_PRODUCTION');
		expect(new Set(production).size).toBe(production.length);
	});

	it('shares every other name with Preview', () => {
		const previewOnly = [
			'PREVIEW_MFA_BYPASS',
			'PREVIEW_ADMIN_EMAILS',
			'SUPABASE_PROJECT_REF_PREVIEW',
		];
		expect(
			CLOUDFLARE_PREVIEW_SECRET_NAMES.filter((name) => !previewOnly.includes(name)).sort(),
		).toEqual(production.filter((name) => name !== 'SUPABASE_PROJECT_REF_PRODUCTION').sort());
	});

	it('skips Preview switches found in a Production file', () => {
		const selection = selectCloudflareWorkerSecrets('production', {
			PREVIEW_MFA_BYPASS: 'true',
			SUPABASE_PROJECT_REF_PRODUCTION: 'ineitkdkyrxqyressllp',
		});
		expect(selection.selected).toEqual({
			SUPABASE_PROJECT_REF_PRODUCTION: 'ineitkdkyrxqyressllp',
		});
		expect(selection.skipped).toEqual(['PREVIEW_MFA_BYPASS']);
	});

	it('refuses a file whose Supabase URL names another project', () => {
		expect(() =>
			assertEnvFileMatchesEnvironment('production', {
				SUPABASE_URL: 'https://iwipdvisoyerfdytuhwi.supabase.co',
			}),
		).toThrow('SUPABASE_URL in the file belongs to another project, not production.');
		expect(() =>
			assertEnvFileMatchesEnvironment('preview', {
				PUBLIC_SUPABASE_URL: 'https://ineitkdkyrxqyressllp.supabase.co',
			}),
		).toThrow('PUBLIC_SUPABASE_URL');
		expect(() =>
			assertEnvFileMatchesEnvironment('production', {
				SUPABASE_URL: 'https://ineitkdkyrxqyressllp.supabase.co',
				PUBLIC_SUPABASE_URL: 'https://ineitkdkyrxqyressllp.supabase.co',
			}),
		).not.toThrow();
	});

	it('requires an explicit non-lane file for Production', () => {
		expect(() => parseSecretsArgs(['--env', 'production'])).toThrow('--env-file');
		for (const file of ['.env', '.env.local', '.env.preview.local', '.env.e2e.local']) {
			expect(() => parseSecretsArgs(['--env=production', `--env-file=${file}`])).toThrow(
				'lane file',
			);
		}
		expect(
			parseSecretsArgs(['--env', 'production', '--env-file', '../legacy-production.env']),
		).toEqual({
			environment: 'production',
			envFile: '../legacy-production.env',
			dryRun: false,
		});
		expect(parseSecretsArgs([])).toEqual({
			environment: 'preview',
			envFile: '.env.preview.local',
			dryRun: false,
		});
		expect(() => parseSecretsArgs(['--env', 'staging'])).toThrow('--env');
	});
});
