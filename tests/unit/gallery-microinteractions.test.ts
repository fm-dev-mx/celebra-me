import fs from 'node:fs';
import path from 'node:path';
import { compile } from 'sass-embedded';

const projectRoot = path.resolve(__dirname, '../..');

describe('Gallery microinteractions', () => {
	it('keeps gallery open flow free of section-owned reveal observers', () => {
		const component = fs.readFileSync(
			path.join(projectRoot, 'src/components/invitation/PhotoGallery.astro'),
			'utf8',
		);

		expect(component).toContain('data-reveal-item');
		expect(component).toContain("new CustomEvent('gallery:open'");
		expect(component).not.toContain('initSectionReveal');
		expect(component).not.toContain('IntersectionObserver');
		expect(component).not.toContain('galleryReveal');
	});
});

describe('Gallery lightbox CSS ownership', () => {
	let galleryCss: string;
	let intersectionCss: string;

	beforeAll(() => {
		galleryCss = compile(path.join(projectRoot, 'src/styles/invitation/_gallery.scss')).css;
		intersectionCss = compile(
			path.join(projectRoot, 'src/styles/invitation/_section-intersections.scss'),
		).css;
	});

	it.each(['gallery-first', 'intersection-first'])(
		'keeps the sibling dialog viewport-fixed without disrupting section stacking (%s)',
		(order) => {
			const style = document.createElement('style');
			style.textContent =
				order === 'gallery-first'
					? `${galleryCss}\n${intersectionCss}`
					: `${intersectionCss}\n${galleryCss}`;
			document.head.append(style);
			document.body.innerHTML = `<div class="invitation-section-wrapper" data-intersection="atmospheric-blend">
				<section class="gallery-section"></section>
				<div class="gallery-lightbox" role="dialog" aria-modal="true"></div>
			</div>`;
			try {
				const section = document.querySelector('.gallery-section')!;
				const dialog = document.querySelector('.gallery-lightbox')!;
				expect(getComputedStyle(section).position).toBe('relative');
				expect(getComputedStyle(section).zIndex).toBe('1');
				expect(getComputedStyle(dialog).position).toBe('fixed');
				expect(getComputedStyle(dialog).zIndex).toBe('20000');
			} finally {
				style.remove();
				document.body.innerHTML = '';
			}
		},
	);

	it('provides sibling-safe defaults at consumption without shadowing inherited lightbox tokens', () => {
		const style = document.createElement('style');
		style.textContent = galleryCss;
		document.head.append(style);
		try {
			const rules = Array.from(style.sheet!.cssRules).filter(
				(rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
			);
			const cases = [
				['.gallery-lightbox', 'background', '--gallery-lightbox-bg', 'rgba(0, 0, 0, 0.9)'],
				[
					'.gallery-lightbox__close',
					'color',
					'--gallery-lightbox-close-color',
					'var(--color-action-accent)',
				],
				[
					'.gallery-lightbox__content img',
					'border',
					'--gallery-lightbox-image-border',
					'2px solid rgb(var(--color-action-accent-rgb) / 30%)',
				],
				[
					'.gallery-lightbox__content img',
					'border-radius',
					'--gallery-lightbox-image-radius',
					'4px',
				],
				[
					'.gallery-lightbox__footer p',
					'font-family',
					'--gallery-lightbox-footer-font',
					'var(--font-body)',
				],
				[
					'.gallery-lightbox__footer p',
					'color',
					'--gallery-lightbox-footer-color',
					'var(--color-text-on-dark)',
				],
				[
					'.gallery-lightbox__footer p',
					'font-size',
					'--gallery-lightbox-footer-size',
					'1.15rem',
				],
			];
			for (const [selector, property, token, fallback] of cases) {
				const rule = rules.find((candidate) => candidate.selectorText === selector);
				expect(rule).toBeDefined();
				expect(rule!.style.getPropertyValue(property).replace(/\s+/g, '')).toBe(
					`var(${token}, ${fallback})`.replace(/\s+/g, ''),
				);
				for (const owner of rules.filter((candidate) =>
					candidate.selectorText.startsWith('.gallery-lightbox'),
				)) {
					expect(owner.style.getPropertyValue(token)).toBe('');
				}
			}
		} finally {
			style.remove();
		}
	});
});

describe('Gallery feature-stack layout', () => {
	it('constrains the desktop feature-stack photograph to its assigned grid column', () => {
		const style = document.createElement('style');
		style.textContent = compile(
			path.join(projectRoot, 'src/styles/themes/sections/gallery/_feature-stack.scss'),
		).css;
		document.head.append(style);
		document.body.innerHTML = `<section class="gallery-section" data-variant="feature-stack">
		<div class="gallery-grid"><div class="gallery-grid__item gallery-grid__item--feature" data-gallery-index="0"></div></div>
	</section>`;
		try {
			const feature = document.querySelector('.gallery-grid__item--feature')!;
			const desktopRules = Array.from(style.sheet!.cssRules)
				.filter(
					(rule): rule is CSSMediaRule =>
						rule instanceof CSSMediaRule && rule.conditionText.includes('768px'),
				)
				.flatMap((rule) => Array.from(rule.cssRules))
				.filter(
					(rule): rule is CSSStyleRule =>
						rule instanceof CSSStyleRule && feature.matches(rule.selectorText),
				);
			expect(
				desktopRules.some((rule) => rule.style.getPropertyValue('width') === '100%'),
			).toBe(true);
			expect(
				desktopRules.some((rule) => rule.style.getPropertyValue('min-width') === '0'),
			).toBe(true);
		} finally {
			style.remove();
			document.body.innerHTML = '';
		}
	});
});
