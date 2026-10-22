import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';
import { isDevMfaBypassEnabled } from '@/lib/server/dev-mfa-bypass';
import type { DevMfaBypassInput } from '@/lib/server/dev-mfa-bypass';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';

const localSupabase = 'http://127.0.0.1:54321';
const previewSupabase = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`;
const previewSupabaseCom = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.com`;
const productionSupabase = `https://${SUPABASE_PROJECT_REFS.production}.supabase.co`;

function makeInput(overrides: Partial<DevMfaBypassInput> = {}): DevMfaBypassInput {
	return {
		devMfaBypass: 'true',
		isDevServer: true,
		supabaseUrl: localSupabase,
		celebraRuntimeTarget: undefined,
		...overrides,
	};
}

describe('isDevMfaBypassEnabled', () => {
	it('returns true when all conditions are met', () => {
		expect(isDevMfaBypassEnabled(makeInput())).toBe(true);
	});

	it('works with localhost hostname', () => {
		expect(isDevMfaBypassEnabled(makeInput({ supabaseUrl: 'http://localhost:54321' }))).toBe(
			true,
		);
	});

	it('returns false when multiple conditions are wrong', () => {
		asHostedDeploy('production');
		expect(
			isDevMfaBypassEnabled(
				makeInput({
					devMfaBypass: undefined,
					isDevServer: false,
					supabaseUrl: 'https://project.supabase.co',
				}),
			),
		).toBe(false);
	});

	describe('DEV_MFA_BYPASS flag', () => {
		it.each([
			{ desc: 'missing', devMfaBypass: undefined },
			{ desc: 'false', devMfaBypass: 'false' },
			{ desc: 'empty string', devMfaBypass: '' },
		])('returns false when devMfaBypass is $desc', ({ devMfaBypass }) => {
			expect(isDevMfaBypassEnabled(makeInput({ devMfaBypass }))).toBe(false);
		});
	});

	describe('Astro dev server', () => {
		it('returns false for any built bundle, even on Local Supabase', () => {
			expect(isDevMfaBypassEnabled(makeInput({ isDevServer: false }))).toBe(false);
		});

		it('returns false for a built bundle against Preview (edge runtimes report no NODE_ENV)', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({
						isDevServer: false,
						supabaseUrl: previewSupabase,
						celebraRuntimeTarget: 'preview',
					}),
				),
			).toBe(false);
		});
	});

	describe('Declared deploy identity', () => {
		it.each([
			{ desc: 'production', deployEnv: 'production' },
			{ desc: 'preview', deployEnv: 'preview' },
			{ desc: 'an invalid value', deployEnv: 'staging' },
		])('returns false when CELEBRA_DEPLOY_ENV is $desc', ({ deployEnv }) => {
			asHostedDeploy(deployEnv);
			expect(isDevMfaBypassEnabled(makeInput())).toBe(false);
		});
	});

	describe('Supabase URL validation', () => {
		it.each([
			{ desc: 'undefined', supabaseUrl: undefined },
			{ desc: 'empty string', supabaseUrl: '' },
			{ desc: 'remote Supabase', supabaseUrl: 'https://project.supabase.co' },
			{ desc: 'https protocol on localhost', supabaseUrl: 'https://127.0.0.1:54321' },
			{ desc: 'wrong port', supabaseUrl: 'http://127.0.0.1:8080' },
			{ desc: 'subdomain attack', supabaseUrl: 'http://localhost:54321.evil.com' },
			{ desc: 'credentials attack', supabaseUrl: 'http://localhost:54321@evil.com' },
			{ desc: 'malformed URL', supabaseUrl: 'not-a-url' },
		])('returns false for $desc', ({ supabaseUrl }) => {
			expect(isDevMfaBypassEnabled(makeInput({ supabaseUrl }))).toBe(false);
		});
	});

	describe('Preview runtime bypass (f11-preview lane)', () => {
		it('returns true with CELEBRA_RUNTIME_TARGET=preview and Preview project URL', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({ supabaseUrl: previewSupabase, celebraRuntimeTarget: 'preview' }),
				),
			).toBe(true);
		});

		it('returns true with Preview .supabase.com hostname', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({
						supabaseUrl: previewSupabaseCom,
						celebraRuntimeTarget: 'preview',
					}),
				),
			).toBe(true);
		});

		it('returns false when CELEBRA_RUNTIME_TARGET is not preview', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({ supabaseUrl: previewSupabase, celebraRuntimeTarget: 'local' }),
				),
			).toBe(false);
		});

		it('returns false when CELEBRA_RUNTIME_TARGET is undefined', () => {
			expect(isDevMfaBypassEnabled(makeInput({ supabaseUrl: previewSupabase }))).toBe(false);
		});

		it('returns false for non-Supabase remote URLs', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({
						supabaseUrl: 'https://example.com/api',
						celebraRuntimeTarget: 'preview',
					}),
				),
			).toBe(false);
		});

		it('returns false for Production Supabase even with preview target', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({
						supabaseUrl: productionSupabase,
						celebraRuntimeTarget: 'preview',
					}),
				),
			).toBe(false);
		});

		it('returns false for other remote Supabase projects', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({
						supabaseUrl: 'https://other-project.supabase.co',
						celebraRuntimeTarget: 'preview',
					}),
				),
			).toBe(false);
		});

		it('still rejects unsafe remote URL patterns', () => {
			expect(
				isDevMfaBypassEnabled(
					makeInput({
						supabaseUrl: 'http://127.0.0.1:54321.evil.supabase.co',
						celebraRuntimeTarget: 'preview',
					}),
				),
			).toBe(false);
		});

		it('blocks when a hosted deploy identity is declared even with preview target', () => {
			asHostedDeploy('preview');
			expect(
				isDevMfaBypassEnabled(
					makeInput({
						supabaseUrl: previewSupabase,
						celebraRuntimeTarget: 'preview',
					}),
				),
			).toBe(false);
		});
	});
});
