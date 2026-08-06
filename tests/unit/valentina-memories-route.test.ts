import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
	VALENTINA_MEMORIES_QR_TARGET_URL,
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesPageCopy,
} from '@/data/valentina-memories.data';

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
		expect(source).toContain('slot="head"');
		expect(source).toContain('name="robots"');
		expect(source).not.toContain('Astro.redirect');
		expect(source).not.toContain('resolveInvitationContent');
		expect(source).not.toContain('client:');
		expect(source).not.toContain('process.env');
		expect(source).not.toContain('getEnv(');
		expect(source).not.toContain('supabase');

		// Static file-based route under src/pages/r/ takes precedence over
		// src/pages/[eventType]/[slug].astro for /r/valentina.
		expect(existsSync('src/pages/[eventType]/[slug].astro')).toBe(true);
		expect(existsSync('src/pages/r/valentina.astro')).toBe(true);
	});

	it('keeps temporary Spanish copy and noindex in the shared contract', () => {
		expect(VALENTINA_MEMORIES_ROUTE_PATH).toBe('/r/valentina');
		expect(VALENTINA_MEMORIES_QR_TARGET_URL).toBe('https://celebra-me.com/r/valentina');
		expect(valentinaMemoriesPageCopy.title).toMatch(/Recuerdos de Valentina/i);
		expect(valentinaMemoriesPageCopy.heading).toBe('Recuerdos de Valentina');
		expect(valentinaMemoriesPageCopy.subtitle).toBe('Próximamente');
		expect(valentinaMemoriesPageCopy.body).toMatch(/fotos y videos/i);
		expect(valentinaMemoriesPageCopy.body).toMatch(/Valentina/i);
		expect(valentinaMemoriesPageCopy.robots).toBe('noindex');
	});

	it('renders the Layout named head slot so noindex metadata can emit', () => {
		const layout = readSource('src/layouts/Layout.astro');
		expect(layout).toContain('<slot name="head" />');
		expect(layout.indexOf('<slot name="head" />')).toBeGreaterThan(layout.indexOf('<head>'));
		expect(layout.indexOf('<slot name="head" />')).toBeLessThan(layout.indexOf('</head>'));
	});

	it('does not hardcode the QR URL outside the shared data module', () => {
		const page = readSource('src/pages/r/valentina.astro');
		const generator = readSource('scripts/qr/generate-valentina-memories.ts');

		expect(page).not.toContain('https://celebra-me.com/r/valentina');
		expect(generator).toContain('VALENTINA_MEMORIES_QR_TARGET_URL');
		expect(generator).not.toMatch(/BASE_URL|process\.env\.VERCEL|request origin/i);
	});
});
