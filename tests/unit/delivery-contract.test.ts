import {
	ANONYMOUS_PUBLISHED_CONTENT_READS,
	PERSONALIZED_GUEST_CONTEXT_READS_ON_HIT,
	PERSONALIZED_GUEST_CONTEXT_READS_ON_MISS,
	PERSONALIZED_VIEW_TRACK_WRITES_ON_HIT,
	classifyDeliveryUrl,
	hasPositiveSharedCacheTtl,
	inventoryInvitationHtml,
	isOriginRevalidatePublicDocument,
	isPrivateNoStoreCacheContract,
	selectHeroResource,
	vercelImageSourceUrl,
} from '@/lib/invitation/delivery-contract';
import {
	assertDeliveryBudgets,
	DELIVERY_HTML_BUDGETS,
	MEASURED_PRODUCTION_HTML,
} from '@/lib/invitation/delivery-budget';

const STORAGE_HERO =
	'https://ineitkdkyrxqyressllp.supabase.co/storage/v1/object/public/invitation-assets/invitations/abc/optimized/hero.webp';
const CLOUDINARY_HERO =
	'https://res.cloudinary.com/demo/image/upload/v1/xv/renata/assets/hero-desktop-0cc4c2f74a2b.webp';

describe('invitation document cache contracts', () => {
	it('accepts origin-revalidate public documents with or without s-maxage=0', () => {
		expect(
			isOriginRevalidatePublicDocument('public, max-age=0, s-maxage=0, must-revalidate'),
		).toBe(true);
		expect(isOriginRevalidatePublicDocument('public, max-age=0, must-revalidate')).toBe(true);
		expect(hasPositiveSharedCacheTtl('public, max-age=0, must-revalidate')).toBe(false);
	});

	it('rejects a positive shared TTL or SWR on invitation HTML', () => {
		expect(
			isOriginRevalidatePublicDocument('public, s-maxage=60, stale-while-revalidate=30'),
		).toBe(false);
		expect(hasPositiveSharedCacheTtl('public, max-age=0, s-maxage=60, must-revalidate')).toBe(
			true,
		);
		expect(isOriginRevalidatePublicDocument('no-store, private')).toBe(false);
	});

	it('requires private no-store for personalized documents', () => {
		expect(isPrivateNoStoreCacheContract('no-store, private')).toBe(true);
		expect(isPrivateNoStoreCacheContract('private, no-store')).toBe(true);
		expect(isPrivateNoStoreCacheContract('public, max-age=0, must-revalidate')).toBe(false);
		expect(isPrivateNoStoreCacheContract('no-store')).toBe(false);
	});
});

describe('invitation HTML delivery inventory', () => {
	it('flags mutable Storage media routed through /_vercel/image', () => {
		const encoded = encodeURIComponent(STORAGE_HERO);
		const html = `<img src="/_vercel/image?url=${encoded}&amp;w=960&amp;q=84" alt="" fetchpriority="high">`;
		const inventory = inventoryInvitationHtml(html);
		expect(inventory.mutableStorageThroughVercelImage).toEqual([STORAGE_HERO]);
		expect(inventory.highPriorityImageCount).toBe(1);
		expect(vercelImageSourceUrl(inventory.urls[0])).toBe(STORAGE_HERO);
	});

	it('allows versioned Cloudinary through /_vercel/image and raw Storage after the mutable-media bypass', () => {
		const encoded = encodeURIComponent(CLOUDINARY_HERO);
		const html = `
			<img src="/_vercel/image?url=${encoded}&w=1080&q=84" alt="hero" fetchpriority="high">
			<img src="${STORAGE_HERO}" alt="legacy" width="1080" height="1920">
			<link rel="stylesheet" href="/_astro/invitation.C0de.css">
			<img src="${STORAGE_HERO}" alt="duplicate-check" loading="lazy">
		`;
		const inventory = inventoryInvitationHtml(html);
		expect(inventory.mutableStorageThroughVercelImage).toEqual([]);
		expect(classifyDeliveryUrl(CLOUDINARY_HERO)).toBe('cloudinary');
		expect(inventory.supabaseStorageCount).toBe(2);
		expect(inventory.astroHashedCount).toBe(1);
		expect(inventory.lazyImageCount).toBe(1);
		expect(inventory.duplicateUrls).toContain(STORAGE_HERO);
		expect(selectHeroResource(inventory)?.highPriority).toBe(true);
	});

	it('does not treat hashed /_astro assets as mutable storage', () => {
		expect(classifyDeliveryUrl('/_astro/hero.DEXMG-Os.png')).toBe('astro-hashed');
		expect(
			inventoryInvitationHtml('<img src="/_astro/hero.DEXMG-Os.png" alt="">')
				.vercelImageCount,
		).toBe(0);
	});
});

describe('invitation delivery query budgets', () => {
	it('keeps published anonymous resolution to a single content read', () => {
		expect(ANONYMOUS_PUBLISHED_CONTENT_READS).toBe(1);
	});

	it('documents the extra personalized lookup without implying anonymous caching', () => {
		expect(PERSONALIZED_GUEST_CONTEXT_READS_ON_HIT).toBe(2);
		expect(PERSONALIZED_GUEST_CONTEXT_READS_ON_MISS).toBe(1);
		expect(PERSONALIZED_VIEW_TRACK_WRITES_ON_HIT).toBe(1);
	});
});

describe('invitation delivery HTML budgets', () => {
	it('keeps HTML budgets above the measured production snapshot', () => {
		for (const id of [
			'versionedAnonymous',
			'legacyStorageAnonymous',
			'personalizedLookupMiss',
		] as const) {
			expect(DELIVERY_HTML_BUDGETS[id].htmlBytes).toBeGreaterThan(
				MEASURED_PRODUCTION_HTML[id].htmlBytes,
			);
		}
	});

	it('does not treat unique HTML URL counts as a budget', () => {
		expect(() =>
			assertDeliveryBudgets([
				{
					id: 'legacyStorageAnonymous',
					htmlBytes: 80_000,
					cacheControl: 'public, max-age=0, must-revalidate',
					personalized: false,
					vercelCache: 'MISS',
				},
			]),
		).not.toThrow();
		expect(MEASURED_PRODUCTION_HTML.legacyStorageAnonymous.uniqueUrlCount).toBe(54);
	});

	it('accepts observations inside the measured ceilings and rejects a shared-cache HIT', () => {
		expect(() =>
			assertDeliveryBudgets([
				{
					id: 'versionedAnonymous',
					htmlBytes: 80_000,
					cacheControl: 'public, max-age=0, must-revalidate',
					personalized: false,
					vercelCache: 'MISS',
				},
			]),
		).not.toThrow();
		expect(() =>
			assertDeliveryBudgets([
				{
					id: 'versionedAnonymous',
					htmlBytes: 80_000,
					cacheControl: 'public, max-age=0, must-revalidate',
					personalized: false,
					vercelCache: 'HIT',
				},
			]),
		).toThrow(/shared-cache HIT/);
	});

	it('rejects HTML that exceeds the derived ceiling', () => {
		expect(() =>
			assertDeliveryBudgets([
				{
					id: 'versionedAnonymous',
					htmlBytes: 95_000,
					cacheControl: 'public, max-age=0, must-revalidate',
					personalized: false,
					vercelCache: 'MISS',
				},
			]),
		).toThrow(/html 95000 B exceeds budget/);
	});
});
