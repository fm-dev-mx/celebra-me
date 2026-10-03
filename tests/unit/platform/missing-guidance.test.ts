/**
 * Missing-credential guidance and the no-secret-value guarantee for the
 * platform usage report: every reportable variable name has a description and
 * a setup link, and provider payloads never carry credential values.
 */

import { platformMissingInfo } from '@/lib/platform/dashboard-copy';
import {
	getSupabasePlatformUsage,
	resetSupabaseUsageCache,
} from '@/lib/platform/server/supabase-usage';
import { getVercelPlatformUsage, resetVercelUsageCache } from '@/lib/platform/server/vercel-usage';
import {
	getCloudinaryPlatformUsage,
	resetCloudinaryUsageCache,
} from '@/lib/platform/server/cloudinary-usage';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const DEFAULT_DESCRIPTION = 'Configuración del panel de plataforma.';

const REPORTABLE_NAMES = [
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
	'MEMORIES_R2_BUCKET_NAME',
	'MEMORIES_R2_BUCKET_NAME_PREVIEW',
	'MEMORIES_R2_BUCKET_NAME_PRODUCTION',
	'SUPABASE_MANAGEMENT_TOKEN',
	'SUPABASE_MANAGEMENT_TOKEN_PREVIEW',
	'SUPABASE_MANAGEMENT_TOKEN_PRODUCTION',
	'SUPABASE_PROJECT_REF_PREVIEW',
	'SUPABASE_PROJECT_REF_PRODUCTION',
	'VERCEL_API_TOKEN',
	'CLOUDINARY_USAGE_API_KEY',
	'CLOUDINARY_USAGE_API_SECRET',
	'CLOUDINARY_CLOUD_NAME',
] as const;

const SECRET_ENV_NAMES = [
	'SUPABASE_MANAGEMENT_TOKEN',
	'SUPABASE_PROJECT_REF_PREVIEW',
	'VERCEL_API_TOKEN',
	'VERCEL_TEAM_ID',
	'CLOUDINARY_CLOUD_NAME',
	'CLOUDINARY_USAGE_API_KEY',
	'CLOUDINARY_USAGE_API_SECRET',
	'CLOUDINARY_API_KEY',
	'CLOUDINARY_API_SECRET',
] as const;

function jsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('missing-credential guidance', () => {
	it('describes every reportable variable and links where to generate it', () => {
		for (const name of REPORTABLE_NAMES) {
			const info = platformMissingInfo(name);
			expect(info.description).not.toBe(DEFAULT_DESCRIPTION);
			expect(info.description.length).toBeGreaterThan(10);
			expect(info.setupUrl).toMatch(/^https:\/\//);
		}
	});

	it('reuses the base entry for Local-only suffixed names', () => {
		expect(platformMissingInfo('VERCEL_API_TOKEN_PREVIEW')).toEqual(
			platformMissingInfo('VERCEL_API_TOKEN'),
		);
	});
});

describe('no credential values in provider payloads', () => {
	const originalEnv: Partial<Record<(typeof SECRET_ENV_NAMES)[number], string>> = {};

	beforeAll(() => {
		for (const name of SECRET_ENV_NAMES) originalEnv[name] = process.env[name];
	});

	afterAll(() => {
		for (const name of SECRET_ENV_NAMES) {
			if (originalEnv[name] === undefined) delete process.env[name];
			else process.env[name] = originalEnv[name];
		}
	});

	beforeEach(() => {
		for (const name of SECRET_ENV_NAMES) delete process.env[name];
		resetSupabaseUsageCache();
		resetVercelUsageCache();
		resetCloudinaryUsageCache();
	});

	it('keeps Supabase, Vercel and Cloudinary values out of the report', async () => {
		process.env.SUPABASE_MANAGEMENT_TOKEN = 'secret-pat-value';
		process.env.SUPABASE_PROJECT_REF_PREVIEW = 'secret-ref-value';
		process.env.VERCEL_API_TOKEN = 'secret-vercel-token';
		process.env.VERCEL_TEAM_ID = 'secret-team-id';
		process.env.CLOUDINARY_CLOUD_NAME = 'secret-cloud-name';
		process.env.CLOUDINARY_API_KEY = 'secret-upload-key';
		process.env.CLOUDINARY_API_SECRET = 'secret-upload-secret';

		const supabase = await getSupabasePlatformUsage('preview', NOW, async () =>
			jsonResponse({ metrics: { fs_used_bytes: 123, fs_size_bytes: 500 } }),
		);
		const vercel = await getVercelPlatformUsage(NOW, async () =>
			jsonResponse({ BilledCost: '0.00' }),
		);
		const cloudinary = await getCloudinaryPlatformUsage(NOW, async () =>
			jsonResponse({ used_credits: 1, credits: 25 }),
		);

		const payloads = JSON.stringify({ supabase, vercel, cloudinary });
		for (const secret of [
			'secret-pat-value',
			'secret-ref-value',
			'secret-vercel-token',
			'secret-team-id',
			'secret-cloud-name',
			'secret-upload-key',
			'secret-upload-secret',
		]) {
			expect(payloads).not.toContain(secret);
		}
	});

	it('recommends the restricted Cloudinary key while the upload key covers the request', async () => {
		process.env.CLOUDINARY_CLOUD_NAME = 'secret-cloud-name';
		process.env.CLOUDINARY_API_KEY = 'secret-upload-key';
		process.env.CLOUDINARY_API_SECRET = 'secret-upload-secret';

		const cloudinary = await getCloudinaryPlatformUsage(NOW, async () =>
			jsonResponse({ used_credits: 1, credits: 25 }),
		);

		expect(cloudinary.kind).toBe('ok');
		if (cloudinary.kind !== 'ok') return;
		expect(cloudinary.missing.map((entry) => entry.name)).toEqual([
			'CLOUDINARY_USAGE_API_KEY',
			'CLOUDINARY_USAGE_API_SECRET',
		]);
		expect(cloudinary.missing.every((entry) => entry.state === 'absent')).toBe(true);
	});
});
