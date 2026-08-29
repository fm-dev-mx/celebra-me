import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
	VALENTINA_MEMORIES_QR_TARGET_URL,
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesCaptureCopy,
	valentinaMemoriesPageCopy,
} from '@/data/valentina-memories.data';
import { VALENTINA_MEMORIES_SIGN_URL_PUBLIC_ENV_NAME } from '@/data/valentina-memories-upload.contract';

const readSource = (relativePath: string) =>
	readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('valentina memories route source contracts', () => {
	it('defines a prerendered static page that wins over the dynamic invitation route', () => {
		const pagePath = 'src/pages/r/valentina.astro';
		expect(existsSync(pagePath)).toBe(true);

		const source = readSource(pagePath);
		expect(source).toContain('export const prerender = true');
		expect(source).toContain("from '@/data/valentina-memories.data'");
		expect(source).toContain('valentinaMemoriesPageCopy');
		expect(source).toContain('ValentinaMemoriesCapture');
		expect(source).toContain('client:load');
		expect(source).toContain('slot="head"');
		expect(source).toContain('name="robots"');
		expect(source).toContain(VALENTINA_MEMORIES_SIGN_URL_PUBLIC_ENV_NAME);
		expect(source).not.toContain('Astro.redirect');
		expect(source).not.toContain('resolveInvitationContent');
		expect(source).not.toContain('process.env');
		expect(source).not.toContain('getEnv(');
		expect(source).not.toContain('supabase');
		expect(source).not.toContain('Cloudinary');
		expect(source).not.toContain('R2_ACCESS_KEY');

		expect(existsSync('src/pages/[eventType]/[slug].astro')).toBe(true);
		expect(existsSync('src/pages/r/valentina.astro')).toBe(true);
	});

	it('keeps capture copy and noindex in the shared contract', () => {
		expect(VALENTINA_MEMORIES_ROUTE_PATH).toBe('/r/valentina');
		expect(VALENTINA_MEMORIES_QR_TARGET_URL).toBe('https://celebra-me.com/r/valentina');
		expect(valentinaMemoriesPageCopy.title).toMatch(/Recuerdos de Valentina/i);
		expect(valentinaMemoriesPageCopy.heading).toBe('Recuerdos de Valentina');
		expect(valentinaMemoriesPageCopy.subtitle).not.toBe('Próximamente');
		expect(valentinaMemoriesPageCopy.body).toMatch(/fotos?|video/i);
		expect(valentinaMemoriesPageCopy.body).toMatch(/Valentina/i);
		expect(valentinaMemoriesPageCopy.robots).toBe('noindex');
		expect(valentinaMemoriesCaptureCopy.chooseFile).toMatch(/foto|video/i);
		expect(valentinaMemoriesCaptureCopy.success).toMatch(/guardó/i);
		expect(valentinaMemoriesCaptureCopy.uploadAnother).toBe('Subir otra');
		expect(valentinaMemoriesCaptureCopy.unavailable).toMatch(/no está disponible/i);
	});

	it('renders the Layout named head slot so noindex metadata can emit', () => {
		const layout = readSource('src/layouts/Layout.astro');
		expect(layout).toContain('<slot name="head" />');
		expect(layout.indexOf('<slot name="head" />')).toBeGreaterThan(layout.indexOf('<head>'));
		expect(layout.indexOf('<slot name="head" />')).toBeLessThan(layout.indexOf('</head>'));
	});

	it('does not hardcode the QR URL outside the shared data module', () => {
		const page = readSource('src/pages/r/valentina.astro');
		const capture = readSource('src/components/memories/ValentinaMemoriesCapture.tsx');
		const generator = readSource('scripts/qr/generate-valentina-memories.ts');

		expect(page).not.toContain('https://celebra-me.com/r/valentina');
		expect(capture).not.toContain('https://celebra-me.com/r/valentina');
		expect(generator).toContain('VALENTINA_MEMORIES_QR_TARGET_URL');
		expect(generator).not.toMatch(/BASE_URL|process\.env\.VERCEL|request origin/i);
	});

	it('does not render a gallery or object listing surface', () => {
		const page = readSource('src/pages/r/valentina.astro');
		const capture = readSource('src/components/memories/ValentinaMemoriesCapture.tsx');
		expect(page).not.toMatch(/objectKey|bucket listing|ListObjects/i);
		expect(`${page}\n${capture}`).not.toContain('gallery');
	});
});
