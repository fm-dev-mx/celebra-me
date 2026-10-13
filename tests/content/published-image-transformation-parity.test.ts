import { type UploadedAssetMap } from '../../scripts/provision/invitations/invitation-definition';
import {
	getInvitationDefinition,
	listInvitationDefinitions,
} from '../../scripts/provision/invitations/registry';
import type { ImageDelivery } from '../../src/lib/assets/image-delivery';

// Production 6081525e: measured image dimensions and transformations in both viewports.
const originalCases = (
	[
		['daniela-y-martin', 'interlude-01', 1024, 1536],
		['daniela-y-martin', 'gallery-01', 1707, 2560],
		['daniela-y-martin', 'interlude-02', 1024, 1536],
		['romina-rios-chaparro', 'family', 1707, 2560],
		['romina-rios-chaparro', 'sagelandscape', 2560, 1707],
		['romina-rios-chaparro', 'portrait', 1707, 2560],
		['romina-rios-chaparro', 'petportrait', 1707, 2560],
		['romina-rios-chaparro', 'whiteportrait', 1707, 2560],
		['romina-rios-chaparro', 'petlandscape', 2560, 1707],
		['romina-rios-chaparro', 'whitebotanical', 1707, 2560],
		['romina-rios-chaparro', 'pinkfloral', 1665, 2560],
		['romina-rios-chaparro', 'closing', 2560, 1707],
	] satisfies [string, string, number, number][]
).map(([slug, key, width, height]) => ({ slug, key, width, height }));

function publishedContent(slug: string) {
	const definition = getInvitationDefinition(slug);
	const assets: UploadedAssetMap = Object.fromEntries(
		definition.assets.map((asset) => [
			asset.key,
			{
				type: 'uploaded' as const,
				assetId: asset.key,
				src: 'https://example.com/' + asset.key + '.webp',
			},
		]),
	);
	return definition.buildPublishedContent(assets);
}

test.each(originalCases)(
	'$slug $key avoids a second encoding of the verified original',
	({ slug, key, width, height }) => {
		const definition = getInvitationDefinition(slug);
		const asset = definition.assets.find((asset) => asset.key.toLowerCase() === key);
		expect(asset?.delivery).toEqual({ mode: 'original', width, height });
		const references: { assetId: string; delivery?: ImageDelivery }[] = [];
		const walk = (value: unknown): void => {
			if (!value || typeof value !== 'object') return;
			if ('assetId' in value)
				references.push(value as { assetId: string; delivery?: ImageDelivery });
			else Object.values(value).forEach(walk);
		};
		walk(publishedContent(slug));
		const matches = references.filter((value) => value.assetId === asset?.key);
		expect(matches.length).toBeGreaterThan(0);
		matches.forEach((value) => expect(value.delivery).toEqual(asset?.delivery));
	},
);

test('canonical managed invitations do not request runtime image transformations', () => {
	const walk = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if ('delivery' in value) expect(value.delivery).not.toMatchObject({ mode: 'optimized' });
		Object.values(value).forEach(walk);
	};
	for (const definition of listInvitationDefinitions()) walk(publishedContent(definition.slug));
});
