const mockIsValidEvent = jest.fn();

jest.mock('@/lib/assets/asset-registry', () => ({
	isValidEvent: mockIsValidEvent,
}));

import { resolveAssetSlug, getAssetSlugFromContent } from '@/lib/assets/asset-slug';

function invitation(overrides: Record<string, unknown> = {}) {
	return {
		id: 'inv-1',
		kind: 'demo',
		slug: null,
		eventType: 'xv-anos',
		snapshot: { previewSlug: 'demo-default-fallback' },
		...overrides,
	} as any;
}

describe('getAssetSlugFromContent', () => {
	it('returns _assetSlug when present and non-empty', () => {
		expect(getAssetSlugFromContent({ _assetSlug: 'my-slug' })).toBe('my-slug');
	});

	it('returns undefined when content is null', () => {
		expect(getAssetSlugFromContent(null)).toBeUndefined();
	});

	it('returns undefined when content has no _assetSlug', () => {
		expect(getAssetSlugFromContent({})).toBeUndefined();
	});

	it('returns undefined when _assetSlug is empty string', () => {
		expect(getAssetSlugFromContent({ _assetSlug: '' })).toBeUndefined();
	});

	it('returns undefined when _assetSlug is whitespace-only', () => {
		expect(getAssetSlugFromContent({ _assetSlug: '  ' })).toBeUndefined();
	});

	it('returns undefined when content is undefined', () => {
		expect(getAssetSlugFromContent(undefined)).toBeUndefined();
	});
});

describe('resolveAssetSlug', () => {
	it('uses published content _assetSlug when present (tier 1)', () => {
		mockIsValidEvent.mockReturnValue(false);

		const result = resolveAssetSlug(
			invitation({ snapshot: { previewSlug: 'fallback-slug' } }),
			{ _assetSlug: 'published-slug' },
		);

		expect(result).toBe('published-slug');
	});

	it('uses client slug directly when isValidEvent passes (tier 2a)', () => {
		mockIsValidEvent.mockReturnValue(true);

		const result = resolveAssetSlug(
			invitation({ kind: 'client', slug: 'my-event', eventType: 'xv-anos' }),
			null,
		);

		expect(result).toBe('my-event');
	});

	it('uses client slug-eventType derivation when slug alone is invalid (tier 2b)', () => {
		mockIsValidEvent.mockImplementation((s: string) => s === 'my-event-xv-anos');

		const result = resolveAssetSlug(
			invitation({ kind: 'client', slug: 'my-event', eventType: 'xv-anos' }),
			null,
		);

		expect(result).toBe('my-event-xv-anos');
	});

	it('skips client derivation when kind is demo (tier 2 skipped)', () => {
		mockIsValidEvent.mockReturnValue(true);

		const result = resolveAssetSlug(invitation({ kind: 'demo', slug: 'my-event' }), null);

		expect(result).toBe('demo-default-fallback');
	});

	it('falls back to snapshot.previewSlug when no published slug and no client derivation (tier 3)', () => {
		mockIsValidEvent.mockReturnValue(false);

		const result = resolveAssetSlug(
			invitation({ kind: 'demo', slug: null, snapshot: { previewSlug: 'demo-legacy-slug' } }),
			null,
		);

		expect(result).toBe('demo-legacy-slug');
	});
});
