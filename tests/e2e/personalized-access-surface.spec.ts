import { test, expect } from '@playwright/test';
import { compileString } from 'sass';

const base = 'src/styles/themes/sections/personalized-access/base';
const skin = 'src/styles/themes/sections/personalized-access/celestial-blue';
const variant = 'src/styles/themes/sections/personalized-access/ornamented';

for (const order of [
	[base, skin, variant],
	[base, variant, skin],
]) {
	test(`access paper texture survives ${order[1].split('/').pop()} loading first`, async ({
		page,
	}) => {
		const css = compileString(order.map((file) => `@use '${file}';`).join('\n'), {
			loadPaths: [process.cwd()],
		}).css;
		await page.setContent(`<style>${css}</style>
			<div class="theme-preset--celestial-blue" style="--color-diamond-white-rgb:255 255 255">
				<section class="personalized-access" data-variant="ornamented">
					<div class="access-card"></div>
				</section>
			</div>`);
		const surface = () =>
			page
				.locator('.access-card')
				.evaluate((card) => getComputedStyle(card, '::after').backgroundImage);
		expect(await surface()).toContain('fractalNoise');
		await page
			.locator('.theme-preset--celestial-blue')
			.evaluate((root) => root.removeAttribute('class'));
		expect(await surface()).toContain('radial-gradient');
		expect(await surface()).not.toContain('fractalNoise');
	});
}
