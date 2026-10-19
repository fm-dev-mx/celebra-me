/**
 * Missing-credential guidance for the platform usage report: every
 * reportable variable name has a description and a setup link.
 */

import { platformMissingInfo } from '@/lib/platform/dashboard-copy';
const DEFAULT_DESCRIPTION = 'Configuración del panel de plataforma.';

const REPORTABLE_NAMES = [
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_R2_BUCKET_NAME',
	'SUPABASE_MANAGEMENT_TOKEN',
	'SUPABASE_PROJECT_REF_PREVIEW',
	'SUPABASE_PROJECT_REF_PRODUCTION',
] as const;

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
