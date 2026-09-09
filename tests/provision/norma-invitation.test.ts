import {
	normaInvitation,
	NORMA_COPY,
	type NormaAssetKey,
} from '../../scripts/provision/invitations/norma-hernandez';
import { canonicalEventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { gallerySchema } from '@/lib/schemas/content/gallery.schema';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry';
import type { UploadedAssetMap } from '../../scripts/provision/invitations/invitation-definition';

const assets = Object.fromEntries(
	normaInvitation.assets.map((asset) => [
		asset.key,
		{
			type: 'uploaded' as const,
			assetId: `__INVITATION_ASSET_KEY__:${asset.key}`,
			src: `https://example.com/${asset.relativePath}`,
			delivery: asset.delivery,
		},
	]),
) as UploadedAssetMap<NormaAssetKey>;

describe('Norma invitation publication contract', () => {
	it('preserves the approved narrative, timing and personalized access without demo restrictions', () => {
		const content = canonicalEventContentSchema.parse(
			normaInvitation.buildPublishedContent(assets),
		);
		expect(content.hero.variant).toBe('framed-portrait');
		expect(content.gallery?.variant).toBe('narrative-stack');
		expect(content.gallery?.items.map((item) => item.caption)).toEqual([
			NORMA_COPY.children,
			NORMA_COPY.grandchildren,
			NORMA_COPY.family,
			NORMA_COPY.life,
		]);
		expect(content.quote?.text).toBe(NORMA_COPY.childhood);
		expect(content.thankYou?.message).toBe(NORMA_COPY.closing);
		expect(content.eventTiming?.startsAtUtc).toBe('2026-11-15T00:00:00.000Z');
		expect(content.eventTiming?.timeZone).toBe('America/Mazatlan');
		expect(content.location?.venues).toHaveLength(2);
		expect(content.rsvp).toMatchObject({
			accessMode: 'personalized-only',
			confirmationMode: 'api',
		});
		expect(content.music).toBeUndefined();
		expect(content.gifts).toBeUndefined();
		expect(content.navigation?.map((item) => item.href)).toEqual(['#event-location', '#rsvp']);
		expect(normaInvitation.lifecycle).toBe('published');
	});
	it('owns a unique identity and exclusive asset paths with explicit intrinsic dimensions', () => {
		const all = listInvitationDefinitions();
		for (const field of ['slug', 'managedIdentityId', 'hostLoginAlias'] as const) {
			expect(all.filter((item) => item[field] === normaInvitation[field])).toHaveLength(1);
		}
		expect(normaInvitation.assets).toHaveLength(6);
		for (const asset of normaInvitation.assets) {
			expect(asset.delivery?.mode).toBe('original');
			expect(asset.delivery?.width).toBeGreaterThan(0);
			expect(asset.delivery?.height).toBeGreaterThan(0);
		}
	});
});

describe('portable narrative gallery prerequisites', () => {
	it.each(
		[
			[],
			[{ image: '/neutral.webp' }],
			[{ image: '/neutral.webp', caption: ' ' }],
			[{ image: '/neutral.webp', caption: 'Recuerdo', aspectRatio: '1 / 1' }],
		].map((items) => ({ items })),
	)('rejects missing captions or forced crops: %j', ({ items }) => {
		expect(gallerySchema.safeParse({ variant: 'narrative-stack', items }).success).toBe(false);
	});
	it('accepts a neutral photograph and caption without a client profile', () => {
		expect(
			gallerySchema.safeParse({
				variant: 'narrative-stack',
				items: [{ image: '/neutral.webp', caption: 'Un recuerdo compartido.' }],
			}).success,
		).toBe(true);
	});
});
