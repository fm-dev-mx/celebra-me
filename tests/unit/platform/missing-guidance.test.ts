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

const NOW = new Date('2026-10-24T12:00:00.000Z');
const DEFAULT_DESCRIPTION = 'Configuración del panel de plataforma.';

const REPORTABLE_NAMES = [
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_R2_BUCKET_NAME',
	'SUPABASE_MANAGEMENT_TOKEN',
	'SUPABASE_PROJECT_REF_PREVIEW',
	'SUPABASE_PROJECT_REF_PRODUCTION',
] as const;

const SECRET_ENV_NAMES = ['SUPABASE_MANAGEMENT_TOKEN', 'SUPABASE_PROJECT_REF_PREVIEW'] as const;

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

	it('falls back to a generic description for unknown names', () => {
		expect(platformMissingInfo('SUPABASE_MANAGEMENT_TOKEN_PREVIEW')).toEqual({
			description: DEFAULT_DESCRIPTION,
			setupUrl: '',
		});
	});

	it('sends Cloudflare to the account token flow, not the empty user token page', () => {
		const info = platformMissingInfo('MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN');
		expect(info.setupUrl).toContain('/:account/api-tokens');
		expect(info.setupUrl).not.toContain('/profile/api-tokens');
		expect(info.description).toMatch(/Account API Token/);
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
	});

	it('keeps Supabase values out of the report', async () => {
		process.env.SUPABASE_MANAGEMENT_TOKEN = 'secret-pat-value';
		process.env.SUPABASE_PROJECT_REF_PREVIEW = 'secret-ref-value';

		const supabase = await getSupabasePlatformUsage('preview', NOW, async () =>
			jsonResponse({ metrics: { fs_used_bytes: 123, fs_size_bytes: 500 } }),
		);

		const payload = JSON.stringify(supabase);
		expect(payload).not.toContain('secret-pat-value');
		expect(payload).not.toContain('secret-ref-value');
	});

	it('reports disk as an informative figure, never against the 500 MB database cap', async () => {
		process.env.SUPABASE_MANAGEMENT_TOKEN = 'secret-pat-value';
		process.env.SUPABASE_PROJECT_REF_PREVIEW = 'secret-ref-value';

		const supabase = await getSupabasePlatformUsage('preview', NOW, async () =>
			jsonResponse({ metrics: { fs_used_bytes: 333_000_000, fs_size_bytes: 8_000_000_000 } }),
		);

		expect(supabase.kind).toBe('ok');
		if (supabase.kind !== 'ok') return;
		expect(supabase.metrics).toHaveLength(1);
		expect(supabase.metrics[0]).toMatchObject({
			id: 'sbDisk',
			meter: { used: 333_000_000, limit: null },
		});
	});
});
