import { resolvePreviewMediaSource } from '@/lib/invitation/preview/preview-media-source';

const origin = 'https://www.celebra-me.com';

describe('preview media source allowlist', () => {
	const originalUrl = process.env.SUPABASE_URL;
	afterAll(() => {
		process.env.SUPABASE_URL = originalUrl;
	});

	it.each([
		'/_astro/hero.abc123.webp',
		'https://www.celebra-me.com/images/x.webp',
		'https://abcdefgh.supabase.co/storage/v1/object/public/invitation-assets/a/b.webp',
		'https://media.celebra-me.com/invitations/xv/demo/hero-abc.webp',
		'https://media-staging.celebra-me.com/invitations/xv/demo/hero-abc.webp',
	])('accepts %s', (source) => {
		expect(resolvePreviewMediaSource(source, origin)).not.toBeNull();
	});

	it('accepts the configured local Storage origin over http', () => {
		process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
		expect(
			resolvePreviewMediaSource(
				'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/a.webp',
				origin,
			),
		).not.toBeNull();
	});

	it.each([
		'https://evil.example.com/x.webp',
		'http://abcdefgh.supabase.co/storage/v1/object/public/a.webp',
		'https://abcdefgh.supabase.co/rest/v1/invitations',
		'http://169.254.169.254/latest/meta-data',
		'https://user:pass@media.celebra-me.com/x.jpg',
		'https://res.cloudinary.com/demo/image/upload/v1/x.jpg',
		'https://media.celebra-me.com.evil.example/x.jpg',
		'http://media.celebra-me.com/x.jpg',
		'file:///etc/passwd',
		'javascript:alert(1)',
	])('rejects %s', (source) => {
		expect(resolvePreviewMediaSource(source, origin)).toBeNull();
	});
});
