import { test, expect } from '@playwright/test';
import { compileString } from 'sass';

const skin = compileString("@use 'src/styles/themes/sections/rsvp/enchanted-rose';", {
	loadPaths: [process.cwd()],
}).css;

for (const width of [390, 1440]) {
	test(`RSVP decorations stay below the hero at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.setContent(`<style>
			body { margin: 0; }
			.hero { height: 900px; background: white; }
			.rsvp-section { min-height: 900px; }
			.theme-preset--enchanted-rose {
				--color-warm-ivory-rgb: 247 239 228;
				--color-midnight-navy-rgb: 46 15 25;
				--color-candle-gold-rgb: 230 184 92;
				--color-deep-rose-red-rgb: 75 21 34;
				--color-antique-gold-rgb: 200 154 69;
				--color-rose-shadow-rgb: 37 9 18;
				--rose-satin-sheen: linear-gradient(pink, pink);
			}
		</style>
		<div class="theme-preset--enchanted-rose">
			<section class="hero"></section>
			<section class="rsvp-section">
				<section class="rsvp-section"><div class="rsvp"></div></section>
			</section>
		</div>`);
		const hero = page.locator('.hero');
		const before = await hero.screenshot();
		await page.addStyleTag({ content: skin });
		expect((await hero.screenshot()).equals(before), 'RSVP must not paint over the hero').toBe(
			true,
		);
		for (const shell of await page.locator('.rsvp-section').all()) {
			expect(await shell.evaluate((node) => getComputedStyle(node).position)).toBe(
				'relative',
			);
			expect(await shell.evaluate((node) => getComputedStyle(node, '::before').content)).toBe(
				'""',
			);
		}
	});
}
