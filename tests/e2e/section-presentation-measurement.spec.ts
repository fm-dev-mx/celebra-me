import { test, expect } from '@playwright/test';
import {
	measureSectionPresentation,
	waitForCaptureHydration,
} from '../../scripts/screenshot/section-visual-diagnosis';

test('section typography includes labels and direct text, excluding hidden text', async ({
	page,
}) => {
	await page.setContent(`<section style="font-family:serif;font-size:12px">Direct text
		<span style="font-size:10.88px;letter-spacing:2.6112px">Retrato</span>
		<label style="font-size:14px">Nombre</label>
		<button style="font-size:16px">Confirmar</button>
		<span hidden style="font-size:99px">Hidden</span>
	</section>`);
	const section = page.locator('section');
	const before = await section.evaluate(measureSectionPresentation);
	expect(before.fonts).toEqual(
		expect.arrayContaining([
			expect.stringContaining('12px'),
			expect.stringContaining('10.88px'),
			expect.stringContaining('14px'),
			expect.stringContaining('16px'),
		]),
	);
	expect(before.fonts.some((font) => font.includes('99px'))).toBe(false);
	await page.locator('span:not([hidden])').evaluate((node) => {
		node.style.fontSize = '10.4px';
	});
	const after = await section.evaluate(measureSectionPresentation);
	expect(after.fonts).not.toEqual(before.fonts);
	expect(after.text).toBe(before.text);
});

test('capture rejects a visible island that did not hydrate', async ({ page }) => {
	await page.setContent(
		'<astro-island client="visible" ssr style="display:block;width:100px;height:100px">RSVP</astro-island>',
	);
	await expect(waitForCaptureHydration(page, 100)).rejects.toThrow();
	await page.locator('astro-island').evaluate((node) => node.removeAttribute('ssr'));
	await expect(waitForCaptureHydration(page, 100)).resolves.toBeUndefined();
});

test('nested captures preserve the outer overlay visibility state', async ({ page }) => {
	const { hideFixedOverlaysForCapture } =
		await import('../../scripts/screenshot/element-capture');
	await page.setContent('<header class="header-base">Navigation</header>');
	const outer = await hideFixedOverlaysForCapture(page);
	const inner = await hideFixedOverlaysForCapture(page);
	await inner();
	await expect(page.locator('header')).toHaveCSS('visibility', 'hidden');
	await outer();
	await expect(page.locator('header')).toHaveCSS('visibility', 'visible');
});
