import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
	compositeSectionCapturePngs,
	listOrderedSectionCapturePaths,
} from '../../../scripts/screenshot/capture';

async function writeSolidPng(
	filePath: string,
	width: number,
	height: number,
	color: { r: number; g: number; b: number },
): Promise<void> {
	await sharp({
		create: { width, height, channels: 3, background: color },
	})
		.png()
		.toFile(filePath);
}

describe('invitation full-page section composite', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(path.join(tmpdir(), 'celebra-fp-composite-'));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('orders 10-{order}-{id} paths by numeric section order', () => {
		const ordered = listOrderedSectionCapturePaths([
			path.join(tempDir, '10-03-location.png'),
			path.join(tempDir, '10-01-hero.png'),
			path.join(tempDir, '05-invitation-full-page.png'),
			path.join(tempDir, '10-02-quote.png'),
		]);

		expect(ordered.map((p) => path.basename(p))).toEqual([
			'10-01-hero.png',
			'10-02-quote.png',
			'10-03-location.png',
		]);
	});

	it('composites section PNGs into a single full-page image with summed height', async () => {
		const hero = path.join(tempDir, '10-01-hero.png');
		const quote = path.join(tempDir, '10-02-quote.png');
		const out = path.join(tempDir, '05-invitation-full-page.png');

		await writeSolidPng(hero, 390, 800, { r: 200, g: 40, b: 40 });
		await writeSolidPng(quote, 390, 300, { r: 40, g: 200, b: 40 });

		const result = await compositeSectionCapturePngs([quote, hero], out);
		expect(result.sectionCount).toBe(2);
		expect(result.width).toBe(390);
		expect(result.height).toBe(1100);

		const meta = await sharp(out).metadata();
		expect(meta.width).toBe(390);
		expect(meta.height).toBe(1100);
	});
});
