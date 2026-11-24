import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';
import { isPreviewSupabaseUrl } from '@/lib/server/preview-supabase-url';

describe('isPreviewSupabaseUrl', () => {
	const previewRef = SUPABASE_PROJECT_REFS.preview;
	const prodRef = SUPABASE_PROJECT_REFS.production;

	it('returns true for a valid preview supabase.co URL', () => {
		expect(isPreviewSupabaseUrl(`https://${previewRef}.supabase.co`)).toBe(true);
		expect(isPreviewSupabaseUrl(`https://${previewRef}.supabase.co/`)).toBe(true);
		expect(isPreviewSupabaseUrl(`https://${previewRef}.supabase.co/rest/v1`)).toBe(true);
	});

	it('returns true for a valid preview supabase.com URL', () => {
		expect(isPreviewSupabaseUrl(`https://${previewRef}.supabase.com`)).toBe(true);
		expect(isPreviewSupabaseUrl(`https://${previewRef}.supabase.com/`)).toBe(true);
	});

	it('returns true case-insensitively for the hostname', () => {
		expect(isPreviewSupabaseUrl(`https://${previewRef.toUpperCase()}.SUPABASE.CO`)).toBe(true);
	});

	it('returns false for another project (e.g. production)', () => {
		expect(isPreviewSupabaseUrl(`https://${prodRef}.supabase.co`)).toBe(false);
		expect(isPreviewSupabaseUrl('https://other-project.supabase.co')).toBe(false);
	});

	it('returns false when protocol is http', () => {
		expect(isPreviewSupabaseUrl(`http://${previewRef}.supabase.co`)).toBe(false);
		expect(isPreviewSupabaseUrl(`http://${previewRef}.supabase.com`)).toBe(false);
	});

	it('returns false when user or password is present in the URL', () => {
		expect(isPreviewSupabaseUrl(`https://user@${previewRef}.supabase.co`)).toBe(false);
		expect(isPreviewSupabaseUrl(`https://user:pass@${previewRef}.supabase.co`)).toBe(false);
		expect(isPreviewSupabaseUrl(`https://:pass@${previewRef}.supabase.co`)).toBe(false);
	});

	it('returns false for invalid, malformed, or subdomain phishing URLs', () => {
		expect(isPreviewSupabaseUrl('not-a-valid-url')).toBe(false);
		expect(isPreviewSupabaseUrl(`https://${previewRef}.supabase.co.evil.com`)).toBe(false);
		expect(isPreviewSupabaseUrl(`https://evil-${previewRef}.supabase.co`)).toBe(false);
	});

	it('returns false for empty, undefined or null string', () => {
		expect(isPreviewSupabaseUrl(undefined)).toBe(false);
		expect(isPreviewSupabaseUrl('')).toBe(false);
	});
});
