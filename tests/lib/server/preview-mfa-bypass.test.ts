import { isPreviewMfaBypassEnabled } from '@/lib/server/preview-mfa-bypass';
import type { PreviewMfaBypassInput } from '@/lib/server/preview-mfa-bypass';

const PREVIEW_SUPABASE = 'https://iwipdvisoyerfdytuhwi.supabase.co';

function makeInput(overrides: Partial<PreviewMfaBypassInput> = {}): PreviewMfaBypassInput {
	return {
		previewMfaBypass: 'true',
		deployEnvironment: 'preview',
		buildRef: 'develop',
		supabaseUrl: PREVIEW_SUPABASE,
		adminEmails: 'preview@preview.com',
		userEmail: 'preview@preview.com',
		userRole: 'super_admin',
		...overrides,
	};
}

describe('isPreviewMfaBypassEnabled', () => {
	it('returns true when all conditions are met', () => {
		expect(isPreviewMfaBypassEnabled(makeInput())).toBe(true);
	});

	it('works with .com preview host', () => {
		const comUrl = 'https://iwipdvisoyerfdytuhwi.supabase.com';
		expect(isPreviewMfaBypassEnabled(makeInput({ supabaseUrl: comUrl }))).toBe(true);
	});

	it('returns false for a different Supabase project', () => {
		expect(
			isPreviewMfaBypassEnabled(
				makeInput({ supabaseUrl: 'https://different-project.supabase.co' }),
			),
		).toBe(false);
	});

	it('returns false when multiple conditions are wrong', () => {
		expect(
			isPreviewMfaBypassEnabled(
				makeInput({
					previewMfaBypass: undefined,
					deployEnvironment: 'production',
					supabaseUrl: 'https://production.supabase.co',
					userEmail: 'other@example.com',
				}),
			),
		).toBe(false);
	});

	describe('PREVIEW_MFA_BYPASS flag', () => {
		it.each([
			{ desc: 'missing', previewMfaBypass: undefined },
			{ desc: 'false', previewMfaBypass: 'false' },
			{ desc: 'empty string', previewMfaBypass: '' },
		])('returns false when flag is $desc', ({ previewMfaBypass }) => {
			expect(isPreviewMfaBypassEnabled(makeInput({ previewMfaBypass }))).toBe(false);
		});
	});

	describe('Deploy identity', () => {
		it.each([
			{ desc: 'production', deployEnvironment: 'production' as const },
			{ desc: 'local, missing or invalid', deployEnvironment: null },
		])('returns false when the deploy identity is $desc', ({ deployEnvironment }) => {
			expect(isPreviewMfaBypassEnabled(makeInput({ deployEnvironment }))).toBe(false);
		});
	});

	describe('Build git ref', () => {
		it.each([
			{ desc: 'main branch', buildRef: 'main' },
			{ desc: 'feature branch', buildRef: 'feature/new-thing' },
			{ desc: 'unknown', buildRef: null },
		])('returns false when branch is $desc', ({ buildRef }) => {
			expect(isPreviewMfaBypassEnabled(makeInput({ buildRef }))).toBe(false);
		});
	});

	describe('Supabase URL validation', () => {
		it.each([
			{ desc: 'undefined', supabaseUrl: undefined },
			{ desc: 'empty string', supabaseUrl: '' },
			{
				desc: 'Production Supabase',
				supabaseUrl: 'https://ineitkdkyrxqyressllp.supabase.co',
			},
			{ desc: 'wrong project', supabaseUrl: 'https://other-project.supabase.co' },
			{ desc: 'local URL', supabaseUrl: 'http://127.0.0.1:54321' },
			{ desc: 'malformed URL', supabaseUrl: 'not-a-url' },
			{ desc: 'http protocol', supabaseUrl: `http://iwipdvisoyerfdytuhwi.supabase.co` },
		])('returns false for $desc', ({ supabaseUrl }) => {
			expect(isPreviewMfaBypassEnabled(makeInput({ supabaseUrl }))).toBe(false);
		});
	});

	describe('User role', () => {
		it.each([
			{ desc: 'host_client', userRole: 'host_client' },
			{ desc: 'empty', userRole: '' },
			{ desc: 'undefined', userRole: '' },
		])('returns false when role is $desc', ({ userRole }) => {
			const input = makeInput({ userRole });
			if (userRole === '') {
				expect(isPreviewMfaBypassEnabled({ ...input, userRole: '' })).toBe(false);
			}
			expect(isPreviewMfaBypassEnabled(input)).toBe(false);
		});
	});

	describe('Admin email allowlist', () => {
		it('allows a listed email', () => {
			expect(
				isPreviewMfaBypassEnabled(
					makeInput({
						adminEmails: 'beta@test.com,preview@preview.com,admin@preview.com',
						userEmail: 'admin@preview.com',
					}),
				),
			).toBe(true);
		});

		it('rejects a non-allowlisted email', () => {
			expect(
				isPreviewMfaBypassEnabled(
					makeInput({
						adminEmails: 'preview@preview.com',
						userEmail: 'unauthorized@example.com',
					}),
				),
			).toBe(false);
		});

		it('rejects when adminEmails is undefined', () => {
			expect(isPreviewMfaBypassEnabled(makeInput({ adminEmails: undefined }))).toBe(false);
		});
	});

	describe('Production fail-closed', () => {
		it('returns false on Production even with every bypass variable set', () => {
			expect(
				isPreviewMfaBypassEnabled(
					makeInput({
						deployEnvironment: 'production',
					}),
				),
			).toBe(false);
		});
	});
});
