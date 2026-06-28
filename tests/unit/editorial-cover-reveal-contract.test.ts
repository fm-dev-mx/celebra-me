import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('editorial cover reveal transition contract', () => {
	const componentSource = readSource('src/components/invitation/EditorialCoverReveal.astro');
	const coverStyles = readSource('src/styles/invitation/_editorial-cover.scss');
	const heroStyles = readSource('src/styles/themes/sections/hero/_editorial-magazine.scss');
	const headerStyles = readSource('src/styles/themes/sections/header/_editorial-magazine.scss');
	const valentinaStyles = readSource('src/styles/themes/sections/_xv-valentina-hernandez.scss');

	it('uses a local editorial reveal phase without extending data-reveal-state', () => {
		expect(componentSource).toContain('editorialRevealPhase');
		expect(componentSource).toContain("dataset.editorialRevealPhase = 'revealing'");
		expect(componentSource).toContain('delete invitationRoot.dataset.editorialRevealPhase');
		expect(componentSource).not.toContain("dataset.revealState = 'revealing'");
	});

	it('guards activation and has a completion timeout fallback beyond the CSS exit duration', () => {
		expect(componentSource).toContain('EXIT_COMPLETION_FALLBACK_MS');
		expect(componentSource).toContain('EXIT_ANIMATION_MS + 600');
		expect(componentSource).toContain('openButton.disabled = true');
		expect(componentSource).toContain('openButton.setAttribute');
	});

	it('uses the approved editorial CTA copy', () => {
		expect(componentSource).toContain('ENTRAR A LA EDICIÓN');
		expect(componentSource).not.toContain('ABRIR EDICIÓN');
	});

	it('styles the revealing phase across cover, hero, and header scopes', () => {
		expect(coverStyles).toContain("[data-editorial-reveal-phase='revealing']");
		expect(coverStyles).toContain('editorialCoverWrapperExit');
		expect(heroStyles).toContain("[data-editorial-reveal-phase='revealing']");
		expect(headerStyles).toContain("[data-editorial-reveal-phase='revealing']");
	});

	it('uses the approved choreography timing and easing', () => {
		expect(heroStyles).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
		expect(heroStyles).toContain('animation-delay: 150ms');
		expect(heroStyles).toContain('animation-delay: 300ms');
		expect(heroStyles).toContain('animation-delay: 450ms');
		expect(headerStyles).toContain('1.05s both');
		expect(headerStyles).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
	});

	it('removes text shadows from the editorial cover and Valentina overrides', () => {
		const editorialCoverVariant =
			coverStyles.match(
				/\.editorial-cover-wrapper\[data-variant='editorial-magazine'\][\s\S]*$/,
			)?.[0] ?? '';

		expect(editorialCoverVariant).not.toContain('text-shadow');
		expect(valentinaStyles).not.toContain('text-shadow');
	});
});
