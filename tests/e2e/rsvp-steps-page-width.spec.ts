import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { compileString } from 'sass';

// The steps flow (rsvp.flow = 'steps') must never paint past the right edge of a phone screen.
// Published pages hide horizontal overflow on <html>/<body>, so scrollWidth stays equal to the
// viewport while phones still zoom the page out to fit the wider layout; every step that pushed
// further right made the whole invitation shrink a little more. The check therefore measures each
// element's box, not scrollWidth, on every step, for every RSVP variant skin (current and future).

const RSVP_SKIN_DIR = 'src/styles/themes/sections/rsvp';

function compile(source: string): string {
	// Skins load their fonts from packages (`@use '@fontsource-variable/…'`).
	return compileString(source, {
		loadPaths: [process.cwd(), join(process.cwd(), 'node_modules')],
	}).css;
}

const baseCss = compile(`@use '${RSVP_SKIN_DIR}/base';`);

const variants = readdirSync(RSVP_SKIN_DIR)
	.filter(
		(file) => /^_[a-z-]+\.scss$/.test(file) && !['_base.scss', '_index.scss'].includes(file),
	)
	.map((file) => file.slice(1, -'.scss'.length));

function stepsMarkup(variant: string, stepCount: number, stepIndex: number): string {
	return `<main>
		<section id="rsvp" class="rsvp-section" data-rsvp-flow="steps">
			<div class="rsvp" data-variant="${variant}" data-state="idle">
				<header class="rsvp__header"><h2 class="rsvp__title">Confirme su asistencia</h2></header>
				<form class="rsvp__form rsvp-steps" data-step-index="${stepIndex}" data-step-count="${stepCount}">
					<div class="rsvp-steps__progress">
						<span class="rsvp-steps__track" aria-hidden="true">
							<span class="rsvp-steps__lantern"></span>
						</span>
						<p class="rsvp-steps__count">Paso ${stepIndex + 1} de ${stepCount}</p>
					</div>
					<div class="rsvp-steps__panel">
						<h3 class="rsvp-steps__heading">¿Nos acompaña?</h3>
						<div class="rsvp-steps__actions">
							<button type="button" class="rsvp__button">Continuar</button>
							<button type="button" class="rsvp__cancel-link">Volver</button>
						</div>
					</div>
				</form>
			</div>
		</section>
	</main>`;
}

for (const variant of ['default', ...variants]) {
	test(`RSVP steps stay inside a phone screen on every step: ${variant}`, async ({ page }) => {
		const skinCss = variant === 'default' ? '' : compile(`@use '${RSVP_SKIN_DIR}/${variant}';`);
		for (const width of [320, 375, 414]) {
			await page.setViewportSize({ width, height: 800 });
			for (const stepCount of [2, 3]) {
				for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
					await page.setContent(`<style>
						html, body { margin: 0; overflow-x: hidden; }
						*, *::before, *::after { transition: none !important; animation: none !important; }
					</style>${stepsMarkup(variant, stepCount, stepIndex)}`);
					await page.addStyleTag({ content: baseCss });
					if (skinCss) await page.addStyleTag({ content: skinCss });

					const overflow = await page.evaluate(() => {
						const limit = document.documentElement.clientWidth + 1;
						const boxes: { name: string; right: number }[] = [];
						for (const node of document.querySelectorAll<HTMLElement>(
							'#rsvp, #rsvp *',
						)) {
							const name = `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`;
							boxes.push({ name, right: node.getBoundingClientRect().right });
						}
						return boxes
							.filter((box) => box.right > limit)
							.map((box) => `${box.name} ends at ${Math.round(box.right)}px`);
					});
					expect(
						overflow,
						`${variant} at ${width}px, step ${stepIndex + 1} of ${stepCount}`,
					).toEqual([]);
				}
			}
		}
	});
}
