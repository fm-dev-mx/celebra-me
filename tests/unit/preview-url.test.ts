import { buildPreviewUrl } from '@/lib/editor/preview-url';

describe('buildPreviewUrl', () => {
	it('returns a relative URL without hardcoded origin', () => {
		const url = buildPreviewUrl('proj-1', 0, false);
		expect(url.startsWith('/')).toBe(true);
		expect(url).not.toContain('https://');
	});

	it('includes embed=1 when embedded is true, excludes when false', () => {
		expect(buildPreviewUrl('proj-1', 0, true)).toBe(
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0',
		);
		expect(buildPreviewUrl('proj-1', 0, false)).toBe(
			'/dashboard/invitaciones/proj-1/preview?v=0',
		);
	});

	it('encodes special characters in invitation ID', () => {
		expect(buildPreviewUrl('proj with spaces', 0, false)).toContain('proj%20with%20spaces');
		expect(buildPreviewUrl('proj/1&2', 0, false)).toContain('proj%2F1%262');
	});

	it('includes the preview version in the query string', () => {
		expect(buildPreviewUrl('proj-1', 42, false)).toContain('v=42');
		expect(buildPreviewUrl('proj-1', 999999, false)).toContain('v=999999');
	});
});
