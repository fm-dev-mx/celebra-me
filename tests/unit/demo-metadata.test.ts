/** @jest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { DEMO_INVITATIONS } from '@/invitations/demos';
import { getDemoMetadata } from '@/lib/seo/demo-metadata';
import { buildDemoSitemapPages } from '@/lib/seo/demo-sitemap-pages';
import {
	getDemoPreviewComposition,
	renderDemoPreview,
	resolveDemoPreviewSource,
} from '../../scripts/seo/demo-preview';
import { buildSocialImageMetadata } from '@/lib/invitation/social-metadata';

const origin = 'https://www.celebra-me.com';

describe('demo search and sharing metadata', () => {
	it('publishes exactly the public catalog at canonical short URLs', () => {
		const publicDemos = DEMO_INVITATIONS.filter(
			(demo) =>
				demo.showroom.visibility === 'featured' &&
				demo.showroom.reviewStatus === 'approved',
		);
		const pages = buildDemoSitemapPages(
			origin,
			path.join(process.cwd(), 'src/invitations/demos'),
		);
		expect(pages).toEqual(publicDemos.map((demo) => `${origin}/${demo.routeSlug}`).sort());
		const titles = new Set<string>();
		for (const demo of publicDemos) {
			const metadata = getDemoMetadata(demo.slug)!;
			expect(metadata.title).toContain(demo.showroom.title);
			titles.add(metadata.title);
			expect(metadata.description).toBe(demo.showroom.description);
			expect(metadata.canonicalPath).toBe(`/${demo.routeSlug}`);
			expect(metadata.robots).toBe('index, follow, max-image-preview:large');
			expect(metadata.image).toBe(`/images/demo-previews/${demo.routeSlug}.jpg`);
			expect(
				buildSocialImageMetadata(metadata.image!, {
					origin,
					width: metadata.imageWidth,
					height: metadata.imageHeight,
				}),
			).toEqual({
				url: `${origin}${metadata.image}`,
				width: 1200,
				height: 630,
				type: 'image/jpeg',
			});
		}
		expect(titles.size).toBe(publicDemos.length);
	});

	it('excludes every hidden or unapproved demo from search and public previews', () => {
		const pages = buildDemoSitemapPages(
			origin,
			path.join(process.cwd(), 'src/invitations/demos'),
		);
		const hidden = DEMO_INVITATIONS.filter(
			(demo) =>
				demo.showroom.visibility !== 'featured' ||
				demo.showroom.reviewStatus !== 'approved',
		);
		expect(hidden.map((demo) => demo.slug)).toContain('demo-xv-lantern-garden');
		for (const demo of hidden) {
			expect(pages).not.toContain(`${origin}/${demo.routeSlug}`);
			expect(getDemoMetadata(demo.slug)).toMatchObject({ robots: 'noindex, nofollow' });
			expect(getDemoMetadata(demo.slug)?.image).toBeUndefined();
		}
	});

	it('does not supply metadata for client invitations or unknown slugs', () => {
		expect(getDemoMetadata('sample-client')).toBeUndefined();
		expect(getDemoMetadata('unknown')).toBeUndefined();
	});
});

describe('demo preview composition', () => {
	it('ships a real 1200x630 JPEG for every public demo and none for hidden demos', async () => {
		const folder = path.resolve('public/images/demo-previews');
		const expected = DEMO_INVITATIONS.filter(
			(demo) =>
				demo.showroom.visibility === 'featured' &&
				demo.showroom.reviewStatus === 'approved',
		)
			.map((demo) => `${demo.routeSlug}.jpg`)
			.sort();
		expect(fs.readdirSync(folder).sort()).toEqual(expected);
		for (const file of expected) {
			const jpeg = fs.readFileSync(path.join(folder, file));
			expect(jpeg.length).toBeLessThan(300_000);
			expect(await sharp(jpeg).metadata()).toMatchObject({
				width: 1200,
				height: 630,
				format: 'jpeg',
			});
		}
	});

	it('keeps every shipped preview equal to its reviewed source and crop', async () => {
		for (const demo of DEMO_INVITATIONS) {
			const metadata = getDemoMetadata(demo.slug);
			if (!metadata?.image) continue;
			const source = await resolveDemoPreviewSource(demo.slug);
			const expected = await renderDemoPreview(source, getDemoPreviewComposition(demo.slug));
			expect(fs.readFileSync(path.join('public', metadata.image))).toEqual(expected);
		}
	});

	it.each([
		[400, 800],
		[640, 640],
		[1600, 900],
		[1600, 400],
	])(
		'fills the card from a %ix%i source without padding, including small sources',
		async (width, height) => {
			const source = await sharp({
				create: { width, height, channels: 3, background: '#e02020' },
			})
				.png()
				.toBuffer();
			const jpeg = await renderDemoPreview(source);
			expect(await sharp(jpeg).metadata()).toMatchObject({
				width: 1200,
				height: 630,
				format: 'jpeg',
			});
			const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
			for (let index = 0; index < data.length; index += info.channels) {
				if (data[index] < 180 || data[index + 1] > 70) {
					throw new Error(
						`Source does not fill the card at pixel ${index / info.channels}`,
					);
				}
			}
		},
	);

	it('ships textured edges on all four sides instead of flat padding', async () => {
		for (const file of fs.readdirSync('public/images/demo-previews')) {
			const source = fs.readFileSync(path.join('public/images/demo-previews', file));
			for (const region of [
				{ left: 0, top: 0, width: 8, height: 630 },
				{ left: 1192, top: 0, width: 8, height: 630 },
				{ left: 0, top: 0, width: 1200, height: 8 },
				{ left: 0, top: 622, width: 1200, height: 8 },
			]) {
				// Materialize the crop: sharp.stats() alone measures the uncropped input.
				const edge = await sharp(source).extract(region).toBuffer();
				const { channels } = await sharp(edge).stats();
				expect({
					file,
					region,
					textured: channels.some(({ stdev }) => stdev > 1),
				}).toMatchObject({ textured: true });
			}
		}
	});

	it.each([0, 1])('uses the selected vertical position %s', async (verticalPosition) => {
		const source = await sharp({
			create: { width: 1200, height: 1260, channels: 3, background: '#e02020' },
		})
			.composite([
				{
					input: await sharp({
						create: { width: 1200, height: 630, channels: 3, background: '#2020e0' },
					})
						.png()
						.toBuffer(),
					left: 0,
					top: 630,
				},
			])
			.png()
			.toBuffer();
		const { channels } = await sharp(
			await renderDemoPreview(source, { verticalPosition }),
		).stats();
		expect(channels[verticalPosition === 0 ? 0 : 2].mean).toBeGreaterThan(180);
		expect(channels[verticalPosition === 0 ? 2 : 0].mean).toBeLessThan(70);
	});

	it.each([-0.1, 1.1, NaN])('rejects invalid crop position %s', async (verticalPosition) => {
		await expect(renderDemoPreview(Buffer.alloc(0), { verticalPosition })).rejects.toThrow(
			'between 0 and 1',
		);
	});
});
