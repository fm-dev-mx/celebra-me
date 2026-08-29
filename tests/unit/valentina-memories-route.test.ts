import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
	VALENTINA_MEMORIES_QR_TARGET_URL,
	VALENTINA_MEMORIES_RECOVERY_ROUTE_PATH,
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesCaptureCopy,
	valentinaMemoriesPageCopy,
	valentinaMemoriesRecoveryPageCopy,
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
		expect(source).toContain('ValentinaMemoriesCapture');
		expect(source).toContain('client:load');
		expect(source).toContain('slot="head"');
		expect(source).toContain('name="robots"');
		expect(source).not.toContain('PUBLIC_VALENTINA_MEMORIES_SIGN_URL');
		expect(source).not.toContain('signUrl');
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
		expect(valentinaMemoriesPageCopy.heading).toBe('Comparta sus fotos y videos');
		expect(valentinaMemoriesPageCopy.subtitle).not.toBe('Próximamente');
		expect(valentinaMemoriesPageCopy.body).toMatch(/fotos?|video/i);
		expect(valentinaMemoriesPageCopy.body).toMatch(/Valentina/i);
		expect(valentinaMemoriesPageCopy.robots).toBe('noindex');
		expect(valentinaMemoriesCaptureCopy.chooseFile).toMatch(/foto|video/i);
		expect(valentinaMemoriesCaptureCopy.success).toMatch(/guardó/i);
		expect(valentinaMemoriesCaptureCopy.uploadAnother).toBe('Subir otro recuerdo');
		expect(valentinaMemoriesCaptureCopy.unavailable).toMatch(/no está disponible/i);
	});

	it('separates recovery into a noindex route and reuses dashboard authentication', () => {
		const recoveryPath = 'src/pages/r/valentina/recuperar.astro';
		expect(existsSync(recoveryPath)).toBe(true);
		const recoveryPage = readSource(recoveryPath);
		const capture = readSource('src/components/memories/ValentinaMemoriesCapture.tsx');
		expect(VALENTINA_MEMORIES_RECOVERY_ROUTE_PATH).toBe('/r/valentina/recuperar');
		expect(recoveryPage).toContain('ValentinaMemoriesRecovery');
		expect(recoveryPage).toContain('name="robots"');
		expect(valentinaMemoriesRecoveryPageCopy.robots).toBe('noindex');
		expect(valentinaMemoriesPageCopy.organizerCtaHref).toBe(
			'/login?next=%2Fdashboard%2Fmemories',
		);
		expect(capture).not.toContain('recoverSession');
		expect(capture).not.toContain('recoveryDraft');
		expect(capture).not.toContain('guestAlias');
	});

	it('models an absent session as a private successful response', () => {
		const sessionRoute = readSource('src/pages/api/memories/valentina/session.ts');
		expect(sessionRoute).toContain('jsonResponse({ profile: null })');
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
