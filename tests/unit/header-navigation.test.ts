import fs from 'node:fs';
import path from 'node:path';
import { buildCanonicalNavigation } from '@/lib/invitation/canonical-navigation';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function expectToken(source: string, token: string): void {
	expect(source).toContain(`${token}:`);
}

describe('Invitation header navigation contract', () => {
	it('renders desktop and mobile menus from the same canonical link list', () => {
		const source = read('src/components/invitation/EventHeader.astro');
		expect(source).toContain('<HeaderBase');
		expect(source).toContain('<NavBarMobile');
		expect(source).toMatch(/links=\{mobileNavLinks\}/);
		expect(source).toMatch(/ctaLink=\{rsvpLink\?\.href\}/);
		expect(source).toMatch(
			/ctaLabel=\{rsvpLink\?\.(?:label|label\s*\?\?\s*['"]Confirmar['"])\}/,
		);
		expect(source).toMatch(/links\.map/);
		expect(source).not.toContain('desktopLinkHrefs');
		expect(source).not.toContain('mobileLinks');
		expect(source).not.toContain('desktopLinks');
	});

	it('builds canonical navigation filtering out missing sections', () => {
		const allSections = {
			quote: { text: 'Test', variant: 'editorial' as const },
			countdown: {
				title: 'Test',
				subtitlePrefix: '',
				footerText: '',
				eventDate: '',
				variant: 'editorial' as const,
			},
			location: { ceremony: {} as any, variant: 'editorial' as const },
			family: { celebrantName: 'Test', variant: 'editorial' as const },
			gallery: { title: 'Test', items: [], variant: 'editorial' as const },
			itinerary: { title: 'Test', items: [], variant: 'editorial' as const },
			rsvp: {
				eventSlug: 'test',
				eventType: 'xv' as const,
				title: 'Test',
				guestCap: 1,
				accessMode: 'hybrid' as const,
				confirmationMessage: '',
				confirmationMode: 'api' as const,
				variant: 'editorial' as const,
			},
			gifts: { items: [], variant: 'editorial' as const },
			thankYou: { message: 'Test', closingName: 'Test', variant: 'editorial' as const },
		};
		const nav = buildCanonicalNavigation(allSections);
		expect(nav).toEqual([
			{ label: 'Inicio', href: '#inicio' },
			{ label: 'Evento', href: '#event-location' },
			{ label: 'Programa', href: '#itinerary' },
			{ label: 'Galería', href: '#galeria' },
			{ label: 'Confirmar', href: '#rsvp' },
		]);
	});

	it('omits nav items whose section is not present', () => {
		const partialSections = {
			location: { ceremony: {} as any, variant: 'editorial' as const },
			rsvp: {
				eventSlug: 'test',
				eventType: 'xv' as const,
				title: 'Test',
				guestCap: 1,
				accessMode: 'hybrid' as const,
				confirmationMessage: '',
				confirmationMode: 'api' as const,
				variant: 'editorial' as const,
			},
		};
		const nav = buildCanonicalNavigation(partialSections as any);
		expect(nav).toEqual([
			{ label: 'Inicio', href: '#inicio' },
			{ label: 'Evento', href: '#event-location' },
			{ label: 'Confirmar', href: '#rsvp' },
		]);
	});

	it('guards mobile drawer scroll-safety with overflow and overscroll CSS', () => {
		const source = read('src/styles/layout/_header-base.scss');

		expect(source).toMatch(/max-height:\s*100dvh/);
		expect(source).toMatch(/overflow-y:\s*auto/);
		expect(source).toMatch(/overscroll-behavior:\s*contain/);
	});

	it('maps xl and lg breakpoint props to correct pixel thresholds in NavBarMobile', () => {
		const source = read('src/components/ui/header/NavBarMobile.astro');

		// Default prop must be 'lg' so marketing pages use the standard breakpoint.
		expect(source).toMatch(/desktopBreakpoint\s*=\s*['"]lg['"]/);
		// Component must recognise both xl (1200 px) and lg (992 px) thresholds.
		expect(source).toContain('1200');
		expect(source).toContain('992');
	});

	it('uses canonical responsive mixins and no obsolete event mobile nav block', () => {
		const source = read('src/styles/invitation/_event-header.scss');

		expect(source).toContain("@use '../global/mixins' as mixins;");
		expect(source).toMatch(/respond-to\(md\)/);
		expect(source).not.toMatch(/@media\s*\(width\s*>=\s*768px\)/);
		expect(source).not.toContain('.event-mobile-nav');
		expect(source).toContain('&:focus-visible');
	});

	it('maps celestial-blue header tokens onto HeaderBase consumed variables', () => {
		const source = read('src/styles/themes/sections/header/_celestial-blue.scss');

		expect(source).toMatch(/\.header-base\[data-variant=['"]celestial-blue['"]\]/);
		expect(source).toMatch(/--header-bg:/);
		expect(source).toMatch(/--header-bg-scrolled:/);
		expect(source).toMatch(/--header-border-color:/);
		expect(source).toMatch(/--mobile-drawer-bg:/);
	});

	it('publishes the navigation token contract from _header-base.scss', () => {
		const source = read('src/styles/layout/_header-base.scss');

		[
			'--mobile-drawer-link-color',
			'--mobile-drawer-login-color',
			'--mobile-drawer-cta-bg',
			'--mobile-drawer-cta-color',
			'--mobile-drawer-cta-border',
			'--mobile-signature-color',
			'--header-nav-title-color',
			'--header-nav-cta-bg',
			'--header-nav-cta-color',
			'--nav-transparent-scrim',
			'--nav-menu-open-container-bg',
		].forEach((token) => expectToken(source, token));
	});

	it('keeps mobile navigation colors behind the shared token contract', () => {
		const source = read('src/styles/layout/_header-base.scss');

		expect(source).toContain('color: var(--mobile-drawer-link-color)');
		expect(source).toContain('color: var(--mobile-drawer-login-color)');
		expect(source).toContain('background: var(--mobile-drawer-cta-bg)');
		expect(source).toContain('color: var(--mobile-drawer-cta-color)');
		expect(source).toContain('color: var(--mobile-signature-color)');
		expect(source).not.toContain('color: rgb(255 255 255 / 60%)');
	});

	it('defines readable header and drawer tokens for affected presets', () => {
		const mandatory = [
			'--header-nav-color',
			'--header-nav-color-transparent',
			'--mobile-drawer-bg',
			'--mobile-drawer-cta-color',
			'--mobile-signature-color',
		];
		const themeTokens: Record<string, string[]> = {
			'src/styles/themes/sections/header/_premiere-floral.scss': mandatory,
			'src/styles/themes/sections/header/_jewelry-box-wedding.scss': [
				...mandatory,
				'--mobile-drawer-link-color',
				'--mobile-drawer-cta-bg',
			],
			'src/styles/themes/sections/header/_editorial.scss': [
				...mandatory,
				'--mobile-drawer-link-color',
				'--mobile-drawer-cta-bg',
			],
			'src/styles/themes/sections/header/_angelic-presence.scss': [
				...mandatory,
				'--mobile-drawer-link-color',
				'--mobile-drawer-cta-bg',
			],
			'src/styles/themes/sections/header/_celestial-blue.scss': [
				...mandatory,
				'--mobile-drawer-link-color',
				'--mobile-drawer-cta-bg',
			],
		};

		Object.entries(themeTokens).forEach(([file, tokens]) => {
			const source = read(file);
			tokens.forEach((token) => expectToken(source, token));
		});
	});

	it('does not keep a TypeScript navigation config as a second source of truth', () => {
		expect(fs.existsSync(path.join(projectRoot, 'src/config/navigation.ts'))).toBe(false);
	});

	it('NavBarMobile script has closeMenu function used for keyboard and custom-event dismiss', () => {
		const source = read('src/components/ui/header/NavBarMobile.astro');

		expect(source).toContain('closeMenu(');
		expect(source).toContain("setAttribute('aria-label', 'Cerrar menú')");
	});

	it('uses class-based overlay visibility instead of hidden attribute', () => {
		const astroSource = read('src/components/ui/header/NavBarMobile.astro');
		const scssSource = read('src/styles/layout/_header-base.scss');

		expect(astroSource).toContain('header-base__mobile-overlay--visible');
		expect(astroSource).not.toMatch(/overlay\.hidden\s*=/);
		expect(scssSource).toContain('&--visible');
		expect(scssSource).not.toContain('&[hidden]');
	});

	it('uses data-state attribute for menu transitions instead of hidden', () => {
		const astroSource = read('src/components/ui/header/NavBarMobile.astro');
		const scssSource = read('src/styles/layout/_header-base.scss');

		expect(astroSource).toContain('data-state="closed"');
		expect(astroSource).toMatch(/setAttribute\(['"]data-state['"]/);
		expect(astroSource).not.toMatch(/menu\.hidden\s*=/);
		expect(scssSource).toMatch(/\[data-state=['"]closed['"]\]/);
		expect(scssSource).toMatch(/\[data-state=['"]open['"]\]/);
	});
});
