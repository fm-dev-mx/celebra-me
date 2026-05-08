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

	it('keeps invitation desktop navigation at xl and lets mobile drawers scroll safely', () => {
		const source = read('src/styles/layout/_header-base.scss');
		const mobileNavSource = read('src/components/ui/header/NavBarMobile.astro');
		const eventHeaderSource = read('src/components/invitation/EventHeader.astro');

		expect(source).toMatch(/\.header-base\[data-variant=['"]celestial-blue['"]\]/);
		expect(source).toMatch(/respond-to\(xl\)/);
		expect(mobileNavSource).toMatch(/desktopBreakpoint\s*=\s*['"]lg['"]/);
		expect(mobileNavSource).toMatch(
			/desktopBreakpoint\s*===\s*['"]xl['"]\s*\?\s*1200\s*:\s*992/,
		);
		expect(eventHeaderSource).toMatch(/desktopBreakpoint=['"]xl['"]/);
		expect(source).toContain('overflow-y: auto;');
		expect(source).toContain('overscroll-behavior: contain;');
		expect(source).toMatch(/short-viewport/);
		expect(source).toMatch(/padding-bottom:\s*max\(/);
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
