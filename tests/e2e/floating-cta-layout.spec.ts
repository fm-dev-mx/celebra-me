import { test, expect } from '@playwright/test';
import { compile } from 'sass';

const css = compile('src/styles/invitation/_floating-cta.scss', {
	loadPaths: [process.cwd()],
}).css;

// The pill and its open calendar panel beside the music button (bottom right on phones).
const markup = (withMusic: boolean) => `<style>
		body { margin: 0; font-size: 16px; }
		[data-music-player] { position: fixed; right: 1rem; bottom: 1rem; width: 2.9rem; height: 2.9rem; }
		${css}
	</style>
	<div class="floating-cta" data-visible="true">
		<div class="floating-cta__panel" data-floating-cta-panel><p>Agendar en Google Calendar</p></div>
		<button type="button" class="floating-cta__button" data-floating-cta-calendar>Agendar</button>
	</div>
	${withMusic ? '<div data-music-player><button type="button">▶</button></div>' : ''}`;

for (const width of [360, 375]) {
	test(`the open calendar panel stays on screen beside the music button at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 780 });
		await page.setContent(markup(true));

		const panel = await page.locator('[data-floating-cta-panel]').boundingBox();
		const pill = await page.locator('[data-floating-cta-calendar]').boundingBox();
		const music = await page.locator('[data-music-player]').boundingBox();
		if (!panel || !pill || !music) throw new Error('Floating CTA fixture did not render');

		expect(panel.x).toBeGreaterThanOrEqual(0);
		expect(panel.x + panel.width).toBeLessThanOrEqual(width);
		// The panel opens above the music button and the pill stays clear of it.
		expect(panel.y + panel.height).toBeLessThanOrEqual(music.y);
		expect(pill.x + pill.width).toBeLessThanOrEqual(music.x);
	});
}

test('the music button does not move the open panel', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 780 });
	await page.setContent(markup(false));
	const alone = await page.locator('[data-floating-cta-panel]').boundingBox();
	await page.setContent(markup(true));
	const beside = await page.locator('[data-floating-cta-panel]').boundingBox();

	expect(beside?.x).toBeCloseTo(alone?.x ?? Number.NaN, 0);
});
