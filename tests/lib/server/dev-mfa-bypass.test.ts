import { isDevMfaBypassEnabled } from '@/lib/server/dev-mfa-bypass';
import type { DevMfaBypassInput } from '@/lib/server/dev-mfa-bypass';

const localSupabase = 'http://127.0.0.1:54321';

function makeInput(overrides: Partial<DevMfaBypassInput> = {}): DevMfaBypassInput {
	return {
		devMfaBypass: 'true',
		nodeEnv: 'development',
		vercel: undefined,
		vercelEnv: undefined,
		supabaseUrl: localSupabase,
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
		expect(
			isDevMfaBypassEnabled(
				makeInput({
					devMfaBypass: undefined,
					nodeEnv: 'production',
					vercel: '1',
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

	describe('NODE_ENV', () => {
		it.each([
			{ desc: 'production', nodeEnv: 'production' },
			{ desc: 'test', nodeEnv: 'test' },
			{ desc: 'undefined', nodeEnv: undefined },
		])('returns false when nodeEnv is $desc', ({ nodeEnv }) => {
			expect(isDevMfaBypassEnabled(makeInput({ nodeEnv }))).toBe(false);
		});
	});

	describe('Vercel environment', () => {
		it.each([
			{ desc: 'VERCEL=1', vercel: '1' },
			{ desc: 'VERCEL_ENV=production', vercelEnv: 'production' },
			{ desc: 'VERCEL_ENV=preview', vercelEnv: 'preview' },
		])('returns false when $desc', ({ vercel, vercelEnv }) => {
			expect(isDevMfaBypassEnabled(makeInput({ vercel, vercelEnv }))).toBe(false);
		});

		it('returns true when VERCEL_ENV=development (Vercel dev)', () => {
			expect(isDevMfaBypassEnabled(makeInput({ vercelEnv: 'development' }))).toBe(true);
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
});
