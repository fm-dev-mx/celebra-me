import {
	buildPreviewMediaPath,
	openPreviewMediaReference,
	parsePreviewMediaAsset,
	sealPreviewMediaReference,
} from '@/lib/invitation/preview/preview-media-token';

const reference = {
	invitationId: '11111111-1111-4111-8111-111111111111',
	source: 'https://example.supabase.co/storage/v1/object/public/invitation-assets/x/hero-abc.webp',
	variant: 'photo' as const,
};

describe('preview media token', () => {
	const originalSecret = process.env.PREVIEW_MEDIA_SECRET;
	beforeEach(() => {
		process.env.PREVIEW_MEDIA_SECRET = 'test-preview-secret';
	});
	afterAll(() => {
		process.env.PREVIEW_MEDIA_SECRET = originalSecret;
	});

	it('round-trips a sealed reference', () => {
		expect(openPreviewMediaReference(sealPreviewMediaReference(reference))).toEqual(reference);
	});

	it('is deterministic per reference, so the CDN can cache it', () => {
		expect(sealPreviewMediaReference(reference)).toBe(sealPreviewMediaReference(reference));
		expect(sealPreviewMediaReference({ ...reference, variant: 'og' })).not.toBe(
			sealPreviewMediaReference(reference),
		);
	});

	it('never exposes the original URL or the invitation id', () => {
		const path = buildPreviewMediaPath(reference);
		expect(path).toMatch(/^\/vista-previa\/[A-Za-z0-9_-]+\.webp$/);
		expect(path).not.toContain('supabase');
		expect(path).not.toContain('hero-abc');
		expect(path).not.toContain(reference.invitationId);
		expect(buildPreviewMediaPath({ ...reference, variant: 'og' })).toMatch(/\.jpg$/);
	});

	it('rejects tampered, truncated or foreign tokens', () => {
		const token = sealPreviewMediaReference(reference);
		const flipped = `${token.slice(0, 20)}${token[20] === 'A' ? 'B' : 'A'}${token.slice(21)}`;
		expect(openPreviewMediaReference(flipped)).toBeNull();
		expect(openPreviewMediaReference(token.slice(0, 30))).toBeNull();
		expect(openPreviewMediaReference('not a token')).toBeNull();
		process.env.PREVIEW_MEDIA_SECRET = 'another-secret';
		expect(openPreviewMediaReference(token)).toBeNull();
	});

	it('binds the extension to the sealed variant', () => {
		const token = sealPreviewMediaReference(reference);
		expect(parsePreviewMediaAsset(`${token}.webp`)).toEqual(reference);
		expect(parsePreviewMediaAsset(`${token}.jpg`)).toBeNull();
		expect(parsePreviewMediaAsset(`${token}.png`)).toBeNull();
		expect(parsePreviewMediaAsset(undefined)).toBeNull();
	});
});
