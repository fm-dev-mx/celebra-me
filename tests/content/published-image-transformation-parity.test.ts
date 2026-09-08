import sharp from 'sharp';
import { shouldOptimizeThroughVercelImage } from '../../src/lib/assets/vercel-image-policy';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	getInvitationAssetSourceDir,
	type UploadedAssetMap,
} from '../../scripts/provision/invitations/invitation-definition';
import {
	getInvitationDefinition,
	listInvitationDefinitions,
} from '../../scripts/provision/invitations/registry';
import type { ImageDelivery } from '../../src/lib/assets/image-delivery';

// Production 6081525e: measured image dimensions and transformations in both viewports.
const galleryCases = (
	[
		['america-johana', 'gallery01', 1400, 1750],
		['america-johana', 'gallery02', 1400, 1750],
		['america-johana', 'gallery04', 1400, 1750],
		['america-johana', 'gallery05', 1600, 1200],
		['america-johana', 'gallery06', 4000, 6000],
		['america-johana', 'gallery07', 1600, 1200],
		['america-johana', 'gallery08', 1600, 1200],
		['america-johana', 'gallery09', 1600, 1200],
		['america-johana', 'gallery10', 1600, 1200],
		['ana-sofia-cota-guillen', 'gallery01', 1400, 2100],
		['ana-sofia-cota-guillen', 'gallery02', 1400, 2100],
		['ana-sofia-cota-guillen', 'gallery03', 1400, 2100],
		['ana-sofia-cota-guillen', 'gallery04', 1400, 1867],
		['ana-sofia-cota-guillen', 'gallery05', 1400, 2100],
		['ana-sofia-cota-guillen', 'gallery06', 1400, 2100],
		['ana-sofia-cota-guillen', 'gallery07', 941, 1672],
		['ana-sofia-cota-guillen', 'gallery08', 941, 1672],
		['ana-sofia-cota-guillen', 'gallery09', 941, 1672],
		['ana-sofia-cota-guillen', 'gallery10', 941, 1672],
		['ayrin-samantha-lerma-castro', 'gallery10', 1080, 1350],
		['ayrin-samantha-lerma-castro', 'gallery06', 1080, 1350],
		['ayrin-samantha-lerma-castro', 'gallery03', 1365, 2048],
		['ayrin-samantha-lerma-castro', 'gallery08', 1080, 1350],
		['ayrin-samantha-lerma-castro', 'gallery02', 1080, 1350],
		['ayrin-samantha-lerma-castro', 'gallery04', 1365, 2048],
		['ayrin-samantha-lerma-castro', 'interlude01', 1080, 1350],
		['cesar-ramses', 'gallery01', 1600, 2000],
		['cesar-ramses', 'gallery02', 2400, 1350],
		['cesar-ramses', 'gallery03', 1600, 2000],
		['cesar-ramses', 'gallery04', 1600, 2000],
		['cesar-ramses', 'gallery05', 1600, 2000],
		['cesar-ramses', 'gallery06', 2160, 3840],
		['leah-lexa', 'gallery03', 1400, 1600],
		['xareni-iyarit', 'gallery01', 1400, 1867],
		['xareni-iyarit', 'gallery02', 1400, 1750],
		['xareni-iyarit', 'gallery03', 1400, 1750],
		['xareni-iyarit', 'gallery04', 1400, 1750],
		['xareni-iyarit', 'gallery05', 1400, 1750],
		['xareni-iyarit', 'gallery06', 1400, 1750],
		['ximena-meza-trasvina', 'gallery01', 1125, 1600],
		['ximena-meza-trasvina', 'gallery02', 1066, 1600],
		['ximena-meza-trasvina', 'gallery03', 1066, 1600],
		['ximena-meza-trasvina', 'gallery04', 1066, 1600],
		['ximena-meza-trasvina', 'gallery05', 1066, 1600],
		['ximena-meza-trasvina', 'gallery07', 1024, 1024],
		['ximena-meza-trasvina', 'gallery09', 1024, 1024],
		['ximena-meza-trasvina', 'gallery10', 1066, 1600],
	] satisfies [string, string, number, number][]
).map(([slug, key, width, height]) => ({
	slug,
	key,
	delivery: { mode: 'original' as const, width, height },
}));

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

test.each(galleryCases)(
	'$slug gallery $key retains measured delivery through publication',
	async ({ slug, key, delivery }) => {
		const content = publishedContent(slug) as {
			gallery: { items: { image: { assetId: string; delivery?: ImageDelivery } }[] };
		};
		expect(
			content.gallery.items.find((item) => item.image.assetId === key)?.image.delivery,
		).toEqual(delivery);
		const asset = getInvitationDefinition(slug).assets.find((asset) => asset.key === key);
		expect(asset?.delivery).toBeUndefined();
		if (!asset) throw new Error('Missing prepared gallery asset');
		const source = resolve(
			getInvitationAssetSourceDir(getInvitationDefinition(slug)),
			asset.relativePath,
		);
		const metadata = await sharp(source).metadata();
		expect([metadata.width, metadata.height]).toEqual([delivery.width, delivery.height]);
		expect(
			shouldOptimizeThroughVercelImage(
				'https://res.cloudinary.com/demo/image/upload/v1/photo.webp',
				delivery,
			),
		).toBe(false);
	},
);

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

const boundedOriginalCases = [
	{
		slug: 'america-johana',
		key: 'gallery06',
		sha256: '0021476cd6a4a0d3bd2a174b1ae1d48819835c8855523ebb4e1dbdf09f602321',
	},
	{
		slug: 'cesar-ramses',
		key: 'gallery06',
		sha256: 'd0e5f658bf890f2a51137dc7234cbe8953e23c589172f7779550c337a66c7ef5',
	},
	{
		slug: 'gerardo-sesenta',
		key: 'portrait',
		sha256: 'b543a6673ff86f7ca6c28874f7c16eeecdc07edc23113cc92364fa32ae0b071c',
	},
];

test.each(boundedOriginalCases)(
	'$slug retains the verified high-resolution $key input',
	({ slug, key, sha256 }) => {
		const definition = getInvitationDefinition(slug);
		const asset = definition.assets.find((entry) => entry.key === key);
		if (!asset) throw new Error('Missing verified original');
		expect(asset.sourcePolicy).toBe('preserve');
		const bytes = readFileSync(
			resolve(getInvitationAssetSourceDir(definition), asset.relativePath),
		);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
	},
);

test('America mobile hero is prepared once and its high-resolution source remains intact', async () => {
	const definition = getInvitationDefinition('america-johana');
	const asset = definition.assets.find((entry) => entry.key === 'heroMobile')!;
	const root = getInvitationAssetSourceDir(definition);
	const source = readFileSync(resolve(root, 'hero.webp'));
	expect(createHash('sha256').update(source).digest('hex')).toBe(
		'af1b0d24d27f97d375621b84f13ba7f7dbef692695e6426f441efa04c7844db2',
	);
	const prepared = readFileSync(resolve(root, asset.relativePath));
	const metadata = await sharp(prepared).metadata();
	expect([metadata.width, metadata.height]).toEqual([960, 1440]);
	expect(prepared.length).toBeLessThan(350 * 1024);
	expect(asset.sourcePolicy).toBe('preserve');
	expect(asset.delivery).toEqual({ mode: 'original', width: 960, height: 1440 });
});

test('canonical managed invitations do not request runtime image transformations', () => {
	const walk = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if ('delivery' in value) expect(value.delivery).not.toMatchObject({ mode: 'optimized' });
		Object.values(value).forEach(walk);
	};
	for (const definition of listInvitationDefinitions()) walk(publishedContent(definition.slug));
});
