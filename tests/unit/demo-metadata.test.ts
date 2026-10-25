/** @jest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { DEMO_INVITATIONS } from '@/invitations/demos';
import { getDemoMetadata } from '@/lib/seo/demo-metadata';
import { buildDemoSitemapPages } from '@/lib/seo/demo-sitemap-pages';
import { renderDemoPreview, resolveDemoPreviewSource } from '../../scripts/seo/demo-preview';
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

	it('keeps every shipped preview equal to the complete current source photograph', async () => {
		for (const demo of DEMO_INVITATIONS) {
			const metadata = getDemoMetadata(demo.slug);
			if (!metadata?.image) continue;
			const source = await resolveDemoPreviewSource(demo.slug);
			const expected = await renderDemoPreview(source);
			expect(fs.readFileSync(path.join('public', metadata.image))).toEqual(expected);
		}
	});

	it.each([
		[400, 800],
		[640, 640],
		[1600, 900],
	])(
		'keeps the complete %ix%i photograph without enlargement or cropping',
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
			const redPixels = Array.from(
				{ length: info.width * info.height },
				(_, index) => index,
			).filter(
				(index) =>
					data[index * info.channels] > 180 && data[index * info.channels + 1] < 70,
			);
			const xs = redPixels.map((index) => index % info.width);
			const ys = redPixels.map((index) => Math.floor(index / info.width));
			const renderedWidth =
				xs.reduce((max, x) => Math.max(max, x), 0) -
				xs.reduce((min, x) => Math.min(min, x), info.width) +
				1;
			const renderedHeight =
				ys.reduce((max, y) => Math.max(max, y), 0) -
				ys.reduce((min, y) => Math.min(min, y), info.height) +
				1;
			const scale = Math.min(1200 / width, 630 / height, 1);
			expect(Math.abs(renderedWidth - width * scale)).toBeLessThan(4);
			expect(Math.abs(renderedHeight - height * scale)).toBeLessThan(4);
		},
	);
});
