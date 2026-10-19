import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImageMetadata } from 'astro';
import { isR2InvitationMediaUrl } from '@/lib/intake/services/r2-invitation-media';
import {
	isMutableInPlaceMediaUrl,
	plainImgSrc,
	shouldOptimizeThroughImageService,
} from '@/lib/assets/image-delivery-policy';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

const SUPABASE_STORAGE_URL =
	'https://ineitkdkyrxqyressllp.supabase.co/storage/v1/object/public/invitations/optimized/hero.webp';
const R2_MEDIA_URL =
	'https://media.celebra-me.com/invitations/xv/demo/hero-' + 'c'.repeat(64) + '.webp';

describe('image delivery policy', () => {
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
		expect(shouldOptimizeThroughImageService(`${SUPABASE_STORAGE_URL}#fragment`)).toBe(false);
	});

	it('rejects malformed URLs and similar but unrelated hosts', () => {
		expect(isMutableInPlaceMediaUrl('not a url')).toBe(false);
		expect(isMutableInPlaceMediaUrl('https://example.com/storage/hero.webp')).toBe(false);
		expect(
			isMutableInPlaceMediaUrl('https://evil.example/.supabase.co/storage/hero.webp'),
		).toBe(false);
		expect(isR2InvitationMediaUrl('https://media.celebra-me.com.evil.example/image.webp')).toBe(
			false,
		);
		expect(isR2InvitationMediaUrl(R2_MEDIA_URL)).toBe(true);
	});

	it('does not classify R2, hashed /_astro, or unrelated remotes as mutable Storage URLs', () => {
		expect(isMutableInPlaceMediaUrl(R2_MEDIA_URL)).toBe(false);
		expect(isMutableInPlaceMediaUrl('/_astro/hero.hash.webp')).toBe(false);
		expect(isMutableInPlaceMediaUrl('https://images.unsplash.com/photo-1')).toBe(false);
	});

	it('treats mutable Storage URLs including ImageMetadata.src', () => {
		expect(shouldOptimizeThroughImageService(SUPABASE_STORAGE_URL)).toBe(false);
		expect(
			shouldOptimizeThroughImageService({
				src: SUPABASE_STORAGE_URL,
				width: 1080,
				height: 1920,
				format: 'webp',
			} as ImageMetadata),
		).toBe(false);
		expect(plainImgSrc(SUPABASE_STORAGE_URL)).toBe(SUPABASE_STORAGE_URL);
	});

	it('keeps repository-owned data URLs on a plain img path', () => {
		expect(shouldOptimizeThroughImageService('data:image/webp;base64,AAAA')).toBe(false);
	});

	it('optimizes bundled ImageMetadata but delivers prepared R2 media directly', () => {
		expect(
			shouldOptimizeThroughImageService({
				src: '/_astro/hero.hash.webp',
				width: 1080,
				height: 1920,
				format: 'webp',
			} as ImageMetadata),
		).toBe(true);
		expect(shouldOptimizeThroughImageService(R2_MEDIA_URL)).toBe(false);
	});

	it.each([
		'https://media.celebra-me.com/invitations/xv/demo/photo-' + 'a'.repeat(64) + '.webp',
		'https://abc.supabase.co/storage/v1/object/public/invitation-assets/photo-' +
			'a'.repeat(64) +
			'.webp',
		'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/photo-' +
			'b'.repeat(64) +
			'.webp',
	])('delivers prepared managed media directly without explicit encoding: %s', (src) => {
		expect(shouldOptimizeThroughImageService(src)).toBe(false);
		expect(
			shouldOptimizeThroughImageService({ src, width: 960, height: 1440, format: 'webp' }),
		).toBe(false);
		expect(shouldOptimizeThroughImageService(src, { mode: 'optimized', width: 640 })).toBe(
			true,
		);
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
				expect(source).toContain('shouldOptimizeThroughImageService');
				expect(source).toContain('<img');
				continue;
			}
			expect(source).toContain("from '@/components/common/CacheSafeImage.astro'");
			expect(source).not.toMatch(/<Image\b/);
		}
	});
});
