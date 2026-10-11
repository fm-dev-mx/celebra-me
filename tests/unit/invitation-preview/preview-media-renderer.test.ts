import sharp from 'sharp';
import {
	previewProvenanceReference,
	renderPreviewMedia,
} from '@/lib/invitation/preview/preview-media-renderer';

const INVITATION_ID = '11111111-1111-4111-8111-111111111111';

async function photo(width: number, height: number): Promise<Buffer> {
	return sharp({
		create: { width, height, channels: 3, background: { r: 120, g: 160, b: 200 } },
	})
		.webp({ quality: 90 })
		.toBuffer();
}

describe('preview media renderer', () => {
	it('keeps the original pixel size of a photo and marks it visibly', async () => {
		const source = await photo(1066, 1600);
		const rendered = await renderPreviewMedia({
			bytes: source,
			variant: 'photo',
			invitationId: INVITATION_ID,
			termsUrl: 'https://www.celebra-me.com/terminos',
		});

		const meta = await sharp(rendered.bytes).metadata();
		expect(rendered.contentType).toBe('image/webp');
		expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1066, 1600]);
		const { channels } = await sharp(rendered.bytes).stats();
		const flat = await sharp(source).stats();
		// A flat source gains light and dark strokes: its channel spread grows.
		expect(channels[0].stdev).toBeGreaterThan(flat.channels[0].stdev + 1);
	});

	it('produces a 1200×630 JPEG social card', async () => {
		const rendered = await renderPreviewMedia({
			bytes: await photo(2160, 3840),
			variant: 'og',
			invitationId: INVITATION_ID,
			termsUrl: 'https://www.celebra-me.com/terminos',
		});

		const meta = await sharp(rendered.bytes).metadata();
		expect(rendered.contentType).toBe('image/jpeg');
		expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630]);
		expect(rendered.bytes.byteLength).toBeLessThan(300 * 1024);
	});

	it('embeds provenance metadata without the invitation id', async () => {
		const rendered = await renderPreviewMedia({
			bytes: await photo(600, 400),
			variant: 'photo',
			invitationId: INVITATION_ID,
			termsUrl: 'https://www.celebra-me.com/terminos',
		});

		const meta = await sharp(rendered.bytes).metadata();
		const xmp = meta.xmp?.toString('utf8') ?? '';
		const exif = meta.exif?.toString('latin1') ?? '';
		const reference = previewProvenanceReference(INVITATION_ID);
		expect(xmp).toContain(`celebra-me-preview:${reference}`);
		expect(xmp).toContain('https://www.celebra-me.com/terminos');
		expect(exif).toContain('Celebra-me');
		expect(`${xmp}${exif}`).not.toContain(INVITATION_ID);
		expect(reference).toMatch(/^[0-9a-f]{12}$/);
	});
});
