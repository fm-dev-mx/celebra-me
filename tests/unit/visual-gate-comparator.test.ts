import sharp from 'sharp';
import { compareWithVisualGate } from '../../scripts/screenshot/visual-gate-comparator';

function solidPng(width: number, height: number, red: number): Promise<Buffer> {
	return sharp({
		create: { width, height, channels: 4, background: { r: red, g: 255, b: 255, alpha: 1 } },
	})
		.png()
		.toBuffer();
}

describe('visual gate comparator', () => {
	it('passes identical bytes without decoding', async () => {
		const image = await solidPng(40, 30, 255);
		expect(compareWithVisualGate(image, image)).toEqual({ passed: true, message: '' });
	});

	it('passes re-encoded pixel-identical images', async () => {
		const image = await solidPng(40, 30, 255);
		const reencoded = await sharp(image).png({ compressionLevel: 0 }).toBuffer();
		expect(reencoded.equals(image)).toBe(false);
		expect(compareWithVisualGate(reencoded, image).passed).toBe(true);
	});

	it('reports differing pixels with a diff image', async () => {
		const result = compareWithVisualGate(
			await solidPng(40, 30, 0),
			await solidPng(40, 30, 255),
		);
		expect(result.passed).toBe(false);
		expect(result.differentPixels).toBe(1200);
		expect(result.diff?.subarray(1, 4).toString()).toBe('PNG');
	});

	it('reports a size-only change with both dimensions', async () => {
		const result = compareWithVisualGate(
			await solidPng(40, 31, 255),
			await solidPng(40, 30, 255),
		);
		expect(result.passed).toBe(false);
		expect(result.expectedSize).toEqual({ width: 40, height: 30 });
		expect(result.actualSize).toEqual({ width: 40, height: 31 });
	});
});
