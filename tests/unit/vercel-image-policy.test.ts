import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImageMetadata } from 'astro';
import {
	isCloudinaryDeliveryHostname,
	isMutableInPlaceMediaUrl,
	plainImgSrc,
	shouldOptimizeThroughVercelImage,
} from '@/lib/assets/vercel-image-policy';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

const SUPABASE_STORAGE_URL =
	'https://ineitkdkyrxqyressllp.supabase.co/storage/v1/object/public/invitations/optimized/hero.webp';
const CLOUDINARY_VERSIONED_URL =
	'https://res.cloudinary.com/demo/image/upload/v1/xv/demo/assets/hero-abc123.webp';

describe('vercel image optimization policy', () => {
	it('treats in-place Supabase Storage URLs as mutable', () => {
		expect(isMutableInPlaceMediaUrl(SUPABASE_STORAGE_URL)).toBe(true);
		expect(
			isMutableInPlaceMediaUrl(
				'https://xyz.supabase.co/storage/v1/object/public/invitations/gallery.webp',
			),
		).toBe(true);
	});

	it('still classifies Storage URLs that carry query strings', () => {
		expect(
			isMutableInPlaceMediaUrl(
				'https://xyz.supabase.co/storage/v1/object/public/invitations/hero.webp?v=2',
			),
		).toBe(true);
		expect(shouldOptimizeThroughVercelImage(`${SUPABASE_STORAGE_URL}#fragment`)).toBe(false);
	});

	it('rejects malformed URLs and similar but unrelated hosts', () => {
		expect(isMutableInPlaceMediaUrl('not a url')).toBe(false);
		expect(isMutableInPlaceMediaUrl('https://example.com/storage/hero.webp')).toBe(false);
		expect(
			isMutableInPlaceMediaUrl('https://evil.example/.supabase.co/storage/hero.webp'),
		).toBe(false);
		expect(isCloudinaryDeliveryHostname('https://res.cloudinary.com.evil.example/image')).toBe(
			false,
		);
		expect(isCloudinaryDeliveryHostname(CLOUDINARY_VERSIONED_URL)).toBe(true);
	});

	it('keeps versioned Cloudinary, hashed /_astro, and unrelated remotes eligible for optimization', () => {
		expect(isMutableInPlaceMediaUrl(CLOUDINARY_VERSIONED_URL)).toBe(false);
		expect(isMutableInPlaceMediaUrl('/_astro/hero.hash.webp')).toBe(false);
		expect(isMutableInPlaceMediaUrl('https://images.unsplash.com/photo-1')).toBe(false);
	});

	it('bypasses /_vercel/image for mutable Storage URLs including ImageMetadata.src', () => {
		expect(shouldOptimizeThroughVercelImage(SUPABASE_STORAGE_URL)).toBe(false);
		expect(
			shouldOptimizeThroughVercelImage({
				src: SUPABASE_STORAGE_URL,
				width: 1080,
				height: 1920,
				format: 'webp',
			} as ImageMetadata),
		).toBe(false);
		expect(plainImgSrc(SUPABASE_STORAGE_URL)).toBe(SUPABASE_STORAGE_URL);
	});

	it('keeps repository-owned data URLs on a plain img path', () => {
		expect(shouldOptimizeThroughVercelImage('data:image/webp;base64,AAAA')).toBe(false);
	});

	it('still optimizes local ImageMetadata and versioned remotes', () => {
		expect(
			shouldOptimizeThroughVercelImage({
				src: '/_astro/hero.hash.webp',
				width: 1080,
				height: 1920,
				format: 'webp',
			} as ImageMetadata),
		).toBe(true);
		expect(shouldOptimizeThroughVercelImage(CLOUDINARY_VERSIONED_URL)).toBe(true);
	});
});

describe('cache-safe invitation image owners', () => {
	const owners = [
		'src/components/common/OptimizedImage.astro',
		'src/components/common/CacheSafeImage.astro',
		'src/components/invitation/Hero.astro',
		'src/components/invitation/EditorialCoverHero.astro',
		'src/components/invitation/EditorialCoverReveal.astro',
	];

	it('route published invitation images through CacheSafeImage instead of raw Astro Image', () => {
		for (const file of owners) {
			const source = readSource(file);
			if (file.endsWith('CacheSafeImage.astro')) {
				expect(source).toContain('shouldOptimizeThroughVercelImage');
				expect(source).toContain('<img');
				continue;
			}
			expect(source).toContain("from '@/components/common/CacheSafeImage.astro'");
			expect(source).not.toMatch(/<Image\b/);
		}
	});
});
