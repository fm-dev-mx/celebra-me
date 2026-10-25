import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { landingData } from '@/data/landing-page.data';

/**
 * Extracts width and height from a JPEG buffer (reading SOF0/SOF2 marker).
 */
function getJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
	if (buffer.readUInt16BE(0) !== 0xffd8) return null;
	let offset = 2;
	while (offset < buffer.length) {
		const marker = buffer.readUInt16BE(offset);
		offset += 2;
		if (marker === 0xffc0 || marker === 0xffc2) {
			return {
				height: buffer.readUInt16BE(offset + 3),
				width: buffer.readUInt16BE(offset + 5),
			};
		}
		const length = buffer.readUInt16BE(offset);
		offset += length;
	}
	return null;
}

describe('page metadata and Open Graph tags', () => {
	const rootDir = resolve(__dirname, '../../../');

	describe('social preview images', () => {
		it('ensures public/images/og/og-vitrina.jpg exists with 1200x630 dimensions', () => {
			const imagePath = resolve(rootDir, 'public/images/og/og-vitrina.jpg');
			expect(existsSync(imagePath)).toBe(true);
			const buffer = readFileSync(imagePath);
			const dimensions = getJpegDimensions(buffer);
			expect(dimensions).toEqual({ width: 1200, height: 630 });
		});

		it('ensures public/images/og/og-home.jpg exists with 1200x630 dimensions', () => {
			const imagePath = resolve(rootDir, 'public/images/og/og-home.jpg');
			expect(existsSync(imagePath)).toBe(true);
			const buffer = readFileSync(imagePath);
			const dimensions = getJpegDimensions(buffer);
			expect(dimensions).toEqual({ width: 1200, height: 630 });
		});
	});

	describe('landing page metadata (src/pages/index.astro)', () => {
		const indexSource = readFileSync(resolve(rootDir, 'src/pages/index.astro'), 'utf8');

		it('configures title and description in landingData', () => {
			expect(landingData.seo.title).toBeTruthy();
			expect(landingData.seo.description).toBeTruthy();
			expect(landingData.seo.ogTitle).toBeTruthy();
			expect(landingData.seo.ogDescription).toBeTruthy();
		});

		it('passes 1200x630 og:image and canonicalPath to Layout', () => {
			expect(indexSource).toMatch(/canonicalPath=["']\/["']/);
			expect(indexSource).toMatch(/ogTitle=\{landingData\.seo\.ogTitle\}/);
			expect(indexSource).toMatch(/ogDescription=\{landingData\.seo\.ogDescription\}/);
			expect(landingData.seo.ogImage).toBe('/images/og/og-vitrina.jpg');
		});
	});

	describe('demos page metadata (src/pages/demos/index.astro)', () => {
		const demosSource = readFileSync(resolve(rootDir, 'src/pages/demos/index.astro'), 'utf8');

		it('declares its own distinct title, description, and canonicalPath="/demos"', () => {
			expect(demosSource).toMatch(/canonicalPath=["']\/demos["']/);
			expect(demosSource).toMatch(/image=\{ogImage\}/);
			expect(demosSource).toMatch(/const ogImage = ['"]\/images\/og\/og-vitrina\.jpg['"]/);

			// Extract title and description defined in demos/index.astro
			const titleMatch = demosSource.match(/const title = ['"]([^'"]+)['"]/);
			const descMatch = demosSource.match(/const description =\s*['"]([^'"]+)['"]/);
			expect(titleMatch).toBeTruthy();
			expect(descMatch).toBeTruthy();

			const demosTitle = titleMatch![1];
			const demosDesc = descMatch![1];

			// Distinct from landing
			expect(demosTitle).not.toBe(landingData.seo.title);
			expect(demosDesc).not.toBe(landingData.seo.description);
			expect(demosTitle.toLowerCase()).toContain('demos');
		});
	});

	describe('legal pages metadata (privacidad and terminos)', () => {
		const privacidadSource = readFileSync(
			resolve(rootDir, 'src/pages/privacidad.astro'),
			'utf8',
		);
		const terminosSource = readFileSync(resolve(rootDir, 'src/pages/terminos.astro'), 'utf8');

		it('privacidad.astro has title, description, and canonicalPath="/privacidad"', () => {
			expect(privacidadSource).toMatch(/title=["']Política de Privacidad \| Celebra-me["']/);
			expect(privacidadSource).toMatch(/description=["'][^"']+["']/);
			expect(privacidadSource).toMatch(/canonicalPath=["']\/privacidad["']/);
		});

		it('terminos.astro has title, description, and canonicalPath="/terminos"', () => {
			expect(terminosSource).toMatch(/title=["']Términos y Condiciones \| Celebra-me["']/);
			expect(terminosSource).toMatch(/description=["'][^"']+["']/);
			expect(terminosSource).toMatch(/canonicalPath=["']\/terminos["']/);
		});
	});

	describe('404 error page (src/pages/404.astro)', () => {
		const errorSource = readFileSync(resolve(rootDir, 'src/pages/404.astro'), 'utf8');

		it('links to the landing, to demos, and to WhatsApp', () => {
			// Landing link
			expect(errorSource).toMatch(/href=["']\/["']/);

			// Demos link
			expect(errorSource).toMatch(/href=["']\/demos["']/);

			// WhatsApp link
			expect(errorSource).toMatch(/href=\{whatsappUrl\}/);
			expect(errorSource).toMatch(/getWhatsAppLink\(/);
		});

		it('disallows indexing and omits canonical URL', () => {
			expect(errorSource).toMatch(/omitCanonical=\{true\}/);
			expect(errorSource).toMatch(/robots=["']noindex, nofollow["']/);
		});
	});

	describe('Layout Open Graph and canonical tag contracts', () => {
		const layoutSource = readFileSync(resolve(rootDir, 'src/layouts/Layout.astro'), 'utf8');

		it('renders og:title, og:description, and og:image tags', () => {
			expect(layoutSource).toMatch(
				/<meta property=["']og:title["'] content=\{resolvedOgTitle\} \/>/,
			);
			expect(layoutSource).toMatch(
				/<meta property=["']og:description["'] content=\{resolvedOgDescription\} \/>/,
			);
			expect(layoutSource).toMatch(/<meta property=["']og:image["'] content=\{ogImage\} \/>/);
			expect(layoutSource).toMatch(
				/<meta property=["']og:image:width["'] content=\{String\(socialImage\.width\)\} \/>/,
			);
			expect(layoutSource).toMatch(
				/<meta property=["']og:image:height["'] content=\{String\(socialImage\.height\)\} \/>/,
			);
			expect(layoutSource).toMatch(
				/<link rel=["']canonical["'] href=\{canonicalUrl\.href\} \/>/,
			);
		});
	});
});
