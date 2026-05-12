import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Invitation header navigation contract', () => {
	it('promotes RSVP into the mobile CTA while preserving desktop links', () => {
		const source = read('src/components/invitation/EventHeader.astro');
		const event = JSON.parse(read('src/content/events/ana-sofia-cota-guillen.json')) as {
			navigation: Array<{ label: string; href: string }>;
		};
		const rsvpLinks = event.navigation.filter((link) => link.href === '#rsvp');

		expect(rsvpLinks).toEqual([{ label: 'RSVP', href: '#rsvp' }]);
		expect(event.navigation.at(-1)).toEqual({ label: 'RSVP', href: '#rsvp' });
		expect(source).toContain('<HeaderBase');
		expect(source).toContain('<NavBarMobile');
		expect(source).toMatch(/links=\{mobileLinks\}/);
		expect(source).toMatch(/ctaLink=\{rsvpLink\?\.href\}/);
		expect(source).toMatch(/ctaLabel=\{'Confirmar asistencia'\}/);
		expect(source).toMatch(/links\.map/);
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
		const source = read('src/styles/themes/sections/_header-theme.scss');

		expect(source).toMatch(/\.header-base\[data-variant=['"]celestial-blue['"]\]/);
		expect(source).toMatch(/--header-bg:/);
		expect(source).toMatch(/--header-bg-scrolled:/);
		expect(source).toMatch(/--header-border-color:/);
		expect(source).toMatch(/--mobile-drawer-bg:/);
	});
});
