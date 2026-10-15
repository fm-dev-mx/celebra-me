import sharp from 'sharp';
import { readImageContainerFacts } from '@/lib/images/image-bytes';
import { embedProvenanceMetadata, type ProvenanceMetadata } from '@/lib/images/image-metadata';

const METADATA: ProvenanceMetadata = {
	exif: {
		artist: 'Celebra-me',
		copyright: 'Vista previa generada por Celebra-me. No autorizada para uso final.',
		description: 'Vista previa · Celebra-me · ref abcdef123456',
	},
	xmp: '<x:xmpmeta xmlns:x="adobe:ns:meta/"><dc:source>celebra-me-preview:abcdef123456</dc:source></x:xmpmeta>',
};

const base = { create: { width: 64, height: 48, channels: 3, background: '#b68b73' } } as const;

describe('provenance metadata embedding', () => {
	it.each([
		['jpeg', () => sharp(base).jpeg().toBuffer()],
		['webp', () => sharp(base).webp({ quality: 80 }).toBuffer()],
		['webp', () => sharp(base).webp({ lossless: true }).toBuffer()],
	] as const)('writes readable EXIF and XMP into a %s', async (format, encode) => {
		const original = await encode();
		const embedded = embedProvenanceMetadata(original, format, METADATA);

		const meta = await sharp(embedded, { failOn: 'error' }).metadata();
		expect([meta.format, meta.width, meta.height]).toEqual([format, 64, 48]);
		expect(meta.exif?.toString('utf8')).toContain('Celebra-me');
		expect(meta.exif?.toString('utf8')).toContain('ref abcdef123456');
		expect(meta.xmp?.toString('utf8')).toContain('celebra-me-preview:abcdef123456');
		// Pixels are untouched: the image still decodes to the same raw data.
		const before = await sharp(original).raw().toBuffer();
		const after = await sharp(embedded).raw().toBuffer();
		expect(Buffer.compare(before, after)).toBe(0);
	});

	it('keeps an alpha WebP flagged and replaces earlier metadata', async () => {
		const withAlpha = await sharp({
			create: {
				width: 32,
				height: 32,
				channels: 4,
				background: { r: 1, g: 2, b: 3, alpha: 0.5 },
			},
		})
			.webp({ lossless: true })
			.withXmp('<x:xmpmeta>old</x:xmpmeta>')
			.toBuffer();
		const embedded = embedProvenanceMetadata(withAlpha, 'webp', METADATA);
		const meta = await sharp(embedded).metadata();
		expect(meta.hasAlpha).toBe(true);
		expect(meta.xmp?.toString('utf8')).not.toContain('old');
		expect(meta.xmp?.toString('utf8')).toContain('abcdef123456');
	});

	it('does not duplicate metadata segments of a JPEG that already has them', async () => {
		const first = embedProvenanceMetadata(
			await sharp(base).jpeg().toBuffer(),
			'jpeg',
			METADATA,
		);
		const second = embedProvenanceMetadata(first, 'jpeg', METADATA);
		expect(second.byteLength).toBe(first.byteLength);
	});

	it('refuses bytes of another container', () => {
		expect(() => embedProvenanceMetadata(new Uint8Array(32), 'jpeg', METADATA)).toThrow();
		expect(() => embedProvenanceMetadata(new Uint8Array(32), 'webp', METADATA)).toThrow();
	});
});

describe('image container facts', () => {
	it('reads the EXIF orientation of a JPEG and none for an unrotated file', async () => {
		const rotated = await sharp(base).withMetadata({ orientation: 6 }).jpeg().toBuffer();
		const plain = await sharp(base).jpeg().toBuffer();
		expect(readImageContainerFacts(rotated)).toEqual({ orientation: 6, pages: 1 });
		expect(readImageContainerFacts(plain).orientation).toBeUndefined();
	});

	it('reads the orientation of a WebP carrying EXIF', async () => {
		const rotated = await sharp(base).withMetadata({ orientation: 3 }).webp().toBuffer();
		expect(readImageContainerFacts(rotated)).toEqual({ orientation: 3, pages: 1 });
	});

	it('reports animated WebP as several pages and a still PNG as one', async () => {
		const frame = (shade: number) =>
			sharp({
				create: {
					width: 32,
					height: 32,
					channels: 3,
					background: { r: shade, g: 0, b: 0 },
				},
			})
				.png()
				.toBuffer();
		const frames = await sharp([await frame(10), await frame(200)], {
			join: { animated: true },
		})
			.webp({ loop: 0, delay: [100, 100] })
			.toBuffer();
		expect(readImageContainerFacts(frames).pages).toBeGreaterThan(1);
		expect(readImageContainerFacts(await sharp(base).png().toBuffer()).pages).toBe(1);
	});

	it('treats unknown bytes as one still page', () => {
		expect(readImageContainerFacts(new Uint8Array([1, 2, 3, 4]))).toEqual({ pages: 1 });
	});
});
