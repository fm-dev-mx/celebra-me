import { isPreviewMfaBypassEnabled, isProductionWithPreviewBypassVarsSet } from '@/lib/server/preview-mfa-bypass';
import type { PreviewMfaBypassInput } from '@/lib/server/preview-mfa-bypass';

const PREVIEW_SUPABASE = 'https://iwipdvisoyerfdytuhwi.supabase.co';

function makeInput(overrides: Partial<PreviewMfaBypassInput> = {}): PreviewMfaBypassInput {
	return {
		previewMfaBypass: 'true',
		vercelEnv: 'preview',
		vercelGitCommitRef: 'develop',
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
					vercelEnv: 'production',
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

	describe('VERCEL_ENV', () => {
		it.each([
			{ desc: 'production', vercelEnv: 'production' },
			{ desc: 'undefined', vercelEnv: undefined },
			{ desc: 'empty', vercelEnv: '' },
		])('returns false when VERCEL_ENV is $desc', ({ vercelEnv }) => {
			expect(isPreviewMfaBypassEnabled(makeInput({ vercelEnv }))).toBe(false);
		});
	});

	describe('VERCEL_GIT_COMMIT_REF', () => {
		it.each([
			{ desc: 'main branch', vercelGitCommitRef: 'main' },
			{ desc: 'feature branch', vercelGitCommitRef: 'feature/new-thing' },
			{ desc: 'undefined', vercelGitCommitRef: undefined },
		])('returns false when branch is $desc', ({ vercelGitCommitRef }) => {
			expect(isPreviewMfaBypassEnabled(makeInput({ vercelGitCommitRef }))).toBe(false);
		});
	});

	describe('Supabase URL validation', () => {
		it.each([
			{ desc: 'undefined', supabaseUrl: undefined },
			{ desc: 'empty string', supabaseUrl: '' },
			{ desc: 'Production Supabase', supabaseUrl: 'https://ineitkdkyrxqyressllp.supabase.co' },
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
						vercelEnv: 'production',
					}),
				),
			).toBe(false);
		});
	});
});

describe('isProductionWithPreviewBypassVarsSet', () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		originalEnv = { ...process.env };
		delete process.env.VERCEL_ENV;
		delete process.env.PREVIEW_MFA_BYPASS;
		delete process.env.VERCEL_GIT_COMMIT_REF;
		delete process.env.PREVIEW_ADMIN_EMAILS;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it('returns false on production without bypass vars', () => {
		process.env.VERCEL_ENV = 'production';
		expect(isProductionWithPreviewBypassVarsSet()).toBe(false);
	});

	it('returns true on production with PREVIEW_MFA_BYPASS set', () => {
		process.env.VERCEL_ENV = 'production';
		process.env.PREVIEW_MFA_BYPASS = 'true';
		expect(isProductionWithPreviewBypassVarsSet()).toBe(true);
	});

	it('returns true on production with PREVIEW_ADMIN_EMAILS set', () => {
		process.env.VERCEL_ENV = 'production';
		process.env.PREVIEW_ADMIN_EMAILS = 'preview@preview.com';
		expect(isProductionWithPreviewBypassVarsSet()).toBe(true);
	});

	it('returns false when not on production', () => {
		process.env.VERCEL_ENV = 'preview';
		process.env.PREVIEW_MFA_BYPASS = 'true';
		expect(isProductionWithPreviewBypassVarsSet()).toBe(false);
	});

	it('returns false when no VERCEL_ENV', () => {
		expect(isProductionWithPreviewBypassVarsSet()).toBe(false);
	});
});
