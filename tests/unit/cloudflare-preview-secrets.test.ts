import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import {
	CLOUDFLARE_PREVIEW_SECRET_NAMES,
	selectCloudflarePreviewSecrets,
} from '../../scripts/ops/cloudflare-preview-secrets.ts';

describe('Cloudflare Preview secret selection', () => {
	it('uploads only allow-listed names with a value and reports the rest by name', () => {
		const selection = selectCloudflarePreviewSecrets({
			SUPABASE_SERVICE_ROLE_KEY: ' service-role ',
			CRON_SECRET: 'cron',
			PREVIEW_MFA_BYPASS: '',
			SUPABASE_URL: 'https://iwipdvisoyerfdytuhwi.supabase.co',
			CELEBRA_DEPLOY_ENV: 'preview',
			DEV_MFA_BYPASS: 'true',
			SUPABASE_MANAGEMENT_TOKEN_PRODUCTION: 'never',
			PLAYWRIGHT_HOST_PASSWORD: 'script-only',
		});
		expect(selection.selected).toEqual({
			SUPABASE_SERVICE_ROLE_KEY: 'service-role',
			CRON_SECRET: 'cron',
		});
		expect(selection.missing).toContain('PREVIEW_MFA_BYPASS');
		expect(selection.missing).toContain('SUPABASE_ANON_KEY');
		expect(selection.skipped).toEqual([
			'CELEBRA_DEPLOY_ENV',
			'DEV_MFA_BYPASS',
			'PLAYWRIGHT_HOST_PASSWORD',
			'SUPABASE_MANAGEMENT_TOKEN_PRODUCTION',
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
			'SUPABASE_MANAGEMENT_TOKEN',
			'SUPABASE_MANAGEMENT_TOKEN_PRODUCTION',
			'SUPABASE_PROJECT_REF_PRODUCTION',
			'MEMORIES_R2_BUCKET_NAME_PRODUCTION',
			'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
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
