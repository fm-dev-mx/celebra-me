import { test, expect } from '@playwright/test';
import {
	measureSectionPresentation,
	waitForCaptureHydration,
	hashDeliveredImage,
	parseDiagnosisArgs,
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

test('SVG identity normalizes only XML line endings and keeps byte integrity', () => {
	const svg = '<svg xmlns="http://www.w3.org/2000/svg">\n<path fill="red"/>\n</svg>';
	const original = hashDeliveredImage(Buffer.from(svg), 'image/svg+xml');
	const windows = hashDeliveredImage(Buffer.from(svg.replace(/\n/g, '\r\n')), 'image/svg+xml');
	expect(windows.deliveredSha256).not.toBe(original.deliveredSha256);
	expect(windows.normalizedSvgSha256).toBe(original.normalizedSvgSha256);
	expect(
		hashDeliveredImage(Buffer.from(svg.replace('red', 'blue')), 'image/svg+xml')
			.normalizedSvgSha256,
	).not.toBe(original.normalizedSvgSha256);
	expect(hashDeliveredImage(Buffer.from(svg), 'image/png').normalizedSvgSha256).toBeUndefined();
});

test('full-page diagnosis rejects an ambiguous capture option', () => {
	const args = [
		'--production-url',
		'https://production.test',
		'--preview-url',
		'https://preview.test',
		'--production-sha',
		'a'.repeat(40),
		'--preview-sha',
		'b'.repeat(40),
	];
	expect(parseDiagnosisArgs([...args, '--full-pages', 'true'])['full-pages']).toBe('true');
	expect(() => parseDiagnosisArgs([...args, '--full-pages', 'yes'])).toThrow(
		'full-pages must be true or false',
	);
});
