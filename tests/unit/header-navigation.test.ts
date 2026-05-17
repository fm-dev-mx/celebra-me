import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function expectToken(source: string, token: string): void {
	expect(source).toContain(`${token}:`);
}

describe('Invitation header navigation contract', () => {
	it('promotes RSVP (Confirmación) into the mobile CTA while preserving desktop links', () => {
		const source = read('src/components/invitation/EventHeader.astro');
		const event = JSON.parse(read('src/content/events/ana-sofia-cota-guillen.json')) as {
			navigation: Array<{ label: string; href: string }>;
		};
		const rsvpLinks = event.navigation.filter((link) => link.href === '#rsvp');

		expect(rsvpLinks).toEqual([{ label: 'Confirmación', href: '#rsvp' }]);
		expect(event.navigation.at(-1)).toEqual({ label: 'Confirmación', href: '#rsvp' });
		expect(source).toContain('<HeaderBase');
		expect(source).toContain('<NavBarMobile');
		expect(source).toMatch(/links=\{mobileLinks\}/);
		expect(source).toMatch(/ctaLink=\{rsvpLink\?\.href\}/);
		expect(source).toMatch(/ctaLabel=\{rsvpLink\?\.label \?\? ['"]Confirmar asistencia['"]\}/);
		expect(source).toMatch(/links\.map/);
	});

	it('strips decorative ordinal prefixes from desktop labels only', () => {
		const source = read('src/components/invitation/EventHeader.astro');
		const event = JSON.parse(read('src/content/events/cesar-ramses.json')) as {
			navigation: Array<{ label: string; href: string }>;
		};

		expect(event.navigation[0]?.label).toBe('01 · Mensaje');
		expect(source).toMatch(/const\s+stripDesktopOrdinal/);
		expect(source).toMatch(
			/link\.href === RSVP_HREF \? link\.label : stripDesktopOrdinal\(link\.label\)/,
		);
		expect(source).toMatch(/desktopBreakpoint=["']lg["']/);
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

	it('publishes the complete navigation token contract from the semantic token layer', () => {
		const source = read('src/styles/tokens/semantic/_navigation.scss');

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
		const themes = [
			'src/styles/themes/sections/header/_premiere-floral.scss',
			'src/styles/themes/sections/header/_jewelry-box-wedding.scss',
			'src/styles/themes/sections/header/_editorial.scss',
			'src/styles/themes/sections/header/_angelic-presence.scss',
			'src/styles/themes/sections/header/_celestial-blue.scss',
		];

		themes.forEach((file) => {
			const source = read(file);

			expectToken(source, '--header-nav-color');
			expectToken(source, '--header-nav-color-transparent');
			expectToken(source, '--mobile-drawer-bg');
			expectToken(source, '--mobile-drawer-link-color');
			expectToken(source, '--mobile-drawer-cta-bg');
			expectToken(source, '--mobile-drawer-cta-color');
			expectToken(source, '--mobile-signature-color');
		});
	});

	it('does not keep a TypeScript navigation config as a second source of truth', () => {
		expect(fs.existsSync(path.join(projectRoot, 'src/config/navigation.ts'))).toBe(false);
	});
});
