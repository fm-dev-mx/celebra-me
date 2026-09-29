import path from 'node:path';
import { compile } from 'sass-embedded';

const projectRoot = path.resolve(__dirname, '../..');
const profileSelector = '.event--demo-xv-celestial-blue.theme-preset--celestial-blue';

function compileRules(relativePath: string): CSSStyleRule[] {
	const style = document.createElement('style');
	style.textContent = compileCss(relativePath);
	document.head.append(style);
	try {
		return Array.from(style.sheet!.cssRules).filter(
			(rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
		);
	} finally {
		style.remove();
	}
}

function compileCss(relativePath: string): string {
	return compile(path.join(projectRoot, relativePath), {
		loadPaths: [path.join(projectRoot, 'node_modules')],
	}).css;
}

describe('Quote and family presentation controls', () => {
	let quoteRules: CSSStyleRule[];
	let familyRules: CSSStyleRule[];
	let profileRules: CSSStyleRule[];
	let celestialHeroRules: CSSStyleRule[];
	let intersectionRules: CSSStyleRule[];

	beforeAll(() => {
		quoteRules = compileRules('src/styles/invitation/_quote.scss');
		familyRules = compileRules('src/styles/invitation/_family.scss');
		profileRules = compileRules('src/styles/invitation-profiles/demo-xv-celestial-blue.scss');
		celestialHeroRules = compileRules('src/styles/themes/sections/hero/_celestial-blue.scss');
		intersectionRules = compileRules('src/styles/invitation/_section-intersections.scss');
	});

	it('retains the shared presentation defaults at their property consumers', () => {
		const cases = [
			['.quote-section', 'min-height', 'var(--quote-min-height, 40svh)'],
			['.quote-section', 'text-align', 'var(--quote-text-align, center)'],
			['.quote-container', 'max-width', 'var(--quote-container-max-width, 800px)'],
			['.quote-mark', 'margin', 'var(--quote-mark-margin, 0 auto 1.5rem)'],
			['.quote-line', 'margin-block-start', 'var(--quote-line-margin-start, 1em)'],
			[
				'.quote-line + .quote-line',
				'padding-inline-start',
				'var(--quote-continuation-indent, 0)',
			],
			['.quote-author-container', 'justify-content', 'var(--quote-author-justify, center)'],
			['.family__item', 'align-items', 'var(--family-item-align, center)'],
		];
		for (const [selector, property, value] of cases) {
			const rule = [...quoteRules, ...familyRules].find(
				(candidate) => candidate.selectorText === selector,
			);
			expect(rule).toBeDefined();
			expect(rule!.style.getPropertyValue(property)).toBe(value);
		}
	});

	it('gives an opted-in quote arch its restrained asymmetric entrance shape', () => {
		const rule = intersectionRules.find(
			(candidate) =>
				candidate.selectorText.includes('[data-section-kind=quote]') &&
				candidate.selectorText.includes('[data-intersection=arch]'),
		);
		expect(rule).toBeDefined();
		expect(rule!.style.getPropertyValue('--intersection-surface')).toBe(
			'var(--color-surface-primary)',
		);
		expect(rule!.style.getPropertyValue('--intersection-arch-height')).toBe(
			'clamp(1.5rem, 3vw, 2.75rem)',
		);
		expect(rule!.style.getPropertyValue('--intersection-arch-mask')).toContain('32 7C44 3');
	});

	it('keeps the first fold hero-only and starts an asymmetrical blend with the quote', () => {
		const profileRule = profileRules.find(
			(candidate) =>
				candidate.selectorText.includes('[data-section-kind=quote]') &&
				candidate.selectorText.includes('[data-intersection=atmospheric-blend]'),
		);
		const heroPaintRule = profileRules.find(
			(candidate) =>
				candidate.selectorText.includes('[data-intersection-source=hero]') &&
				candidate.selectorText.includes('.quote-section'),
		);
		const heroHeightRule = celestialHeroRules.find(
			(candidate) =>
				candidate.selectorText.includes('.invitation-hero') &&
				candidate.style.getPropertyValue('min-height') === '100svh',
		);
		expect(profileRule).toBeDefined();
		expect(profileRule!.style.getPropertyValue('--intersection-depth')).toBe(
			'clamp(3.25rem, 6.5vw, 4.5rem)',
		);
		expect(profileRule!.style.getPropertyValue('--intersection-blend')).toContain('68% 0%');
		expect(heroHeightRule).toBeDefined();
		expect(heroHeightRule!.style.getPropertyValue('min-height')).toBe('100svh');
		expect(heroPaintRule).toBeDefined();
		expect(heroPaintRule!.style.getPropertyValue('margin-top')).toBe('');
		expect(heroPaintRule!.style.getPropertyValue('background-image')).toContain(
			'var(--intersection-blend)',
		);
		expect(heroPaintRule!.style.getPropertyValue('background-size')).toBe(
			'100% var(--intersection-depth)',
		);
	});

	it('scopes the editorial overrides to Celestial Blue without a blur or compositing workaround', () => {
		const quote = profileRules.find(
			(rule) => rule.selectorText === `${profileSelector} .quote-section`,
		)!;
		const family = profileRules.find((rule) => rule.selectorText === profileSelector)!;
		expect(quote).toBeDefined();
		expect(family).toBeDefined();
		expect(quote.style.getPropertyValue('--quote-text-align')).toBe('start');
		expect(quote.style.getPropertyValue('--quote-content-weight')).toBe('500');
		expect(quote.style.getPropertyValue('--quote-content-style')).toBe('italic');
		expect(quote.style.getPropertyValue('--quote-content-shadow')).toBe('none');
		expect(quote.style.getPropertyValue('--quote-continuation-indent')).toBe('1.5em');
		expect(quote.style.getPropertyValue('--quote-line-margin-start')).toBe('0');
		expect(family.style.getPropertyValue('--family-item-align')).toBe('flex-start');
		expect(family.style.getPropertyValue('--family-group-text-align')).toBe('start');
		expect(family.style.getPropertyValue('--family-divider')).toBe('transparent');
		for (const property of [
			'filter',
			'backdrop-filter',
			'transform',
			'will-change',
			'text-shadow',
		]) {
			expect(quote.style.getPropertyValue(property)).toBe('');
		}
		for (const rule of profileRules) {
			if (
				rule.style.getPropertyValue('--quote-text-align') ||
				rule.style.getPropertyValue('--family-item-align')
			) {
				expect(rule.selectorText.startsWith(profileSelector)).toBe(true);
			}
		}
	});

	it('indents only an explicit continuation paragraph, leaving the first paragraph unchanged', () => {
		const quote = document.createElement('blockquote');
		quote.innerHTML = '<p class="quote-line">First</p><p class="quote-line">Continuation</p>';
		const indentRules = quoteRules.filter((rule) =>
			rule.style
				.getPropertyValue('padding-inline-start')
				.includes('--quote-continuation-indent'),
		);
		expect(indentRules).toHaveLength(1);
		expect(quote.children[0].matches(indentRules[0].selectorText)).toBe(false);
		expect(quote.children[1].matches(indentRules[0].selectorText)).toBe(true);
	});
});
