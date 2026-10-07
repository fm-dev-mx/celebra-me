const mockIsValidEvent = jest.fn();

jest.mock('@/lib/assets/asset-registry', () => ({
	isValidEvent: mockIsValidEvent,
}));

import { resolveAssetSlug, getAssetSlugFromContent } from '@/lib/assets/asset-slug';

function invitation(overrides: Record<string, unknown> = {}) {
	return {
		id: 'inv-1',
		kind: 'client',
		slug: null,
		eventType: 'xv-anos',
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
	it('uses published content _assetSlug when present', () => {
		mockIsValidEvent.mockReturnValue(false);

		expect(
			resolveAssetSlug(invitation({ slug: 'my-event' }), { _assetSlug: 'published-slug' }),
		).toBe('published-slug');
	});

	it('uses the invitation slug when it names a registry namespace', () => {
		mockIsValidEvent.mockReturnValue(true);

		expect(resolveAssetSlug(invitation({ slug: 'my-event' }), null)).toBe('my-event');
	});

	it('uses the slug-eventType namespace when the slug alone is not registered', () => {
		mockIsValidEvent.mockImplementation((s: string) => s === 'my-event-xv-anos');

		expect(resolveAssetSlug(invitation({ slug: 'my-event' }), null)).toBe('my-event-xv-anos');
	});

	it('returns undefined when the invitation has no versioned namespace', () => {
		mockIsValidEvent.mockReturnValue(false);

		expect(resolveAssetSlug(invitation({ slug: 'my-event' }), null)).toBeUndefined();
		expect(resolveAssetSlug(invitation({ slug: null }), null)).toBeUndefined();
	});
});
