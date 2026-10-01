import sharp from 'sharp';
import {
	alignPngRows,
	alignRows,
	type RgbaImage,
} from '../../scripts/screenshot/visual-row-alignment';

const WIDTH = 8;

/** Builds an image whose rows carry distinct content, like lines of text. */
function image(rows: number[]): RgbaImage {
	const data = new Uint8Array(rows.length * WIDTH * 4);
	rows.forEach((value, row) => {
		for (let x = 0; x < WIDTH; x++) {
			const offset = (row * WIDTH + x) * 4;
			data[offset] = (value * 37 + x * 11) % 256;
			data[offset + 1] = (value * 91) % 256;
			data[offset + 2] = (value * 53 + x) % 256;
			data[offset + 3] = 255;
		}
	});
	return { data, width: WIDTH, height: rows.length };
}

const range = (start: number, end: number) =>
	Array.from({ length: end - start }, (_, index) => start + index);

describe('row alignment', () => {
	it('classifies identical rasters', () => {
		expect(alignRows(image(range(0, 50)), image(range(0, 50))).classification).toBe(
			'IDENTICAL',
		);
	});

	it('explains a one-row insertion as a shift, not a full-band change', () => {
		const expected = range(0, 100);
		const actual = [...range(0, 40), 999, ...range(40, 100)];
		const result = alignRows(image(expected), image(actual));
		expect(result).toEqual({
			classification: 'SHIFT_ONLY',
			heightDelta: 1,
			inserted: [{ y: 40, height: 1 }],
			removed: [],
			changedRows: 0,
		});
	});

	it('locates removed rows', () => {
		const result = alignRows(image(range(0, 60)), image([...range(0, 10), ...range(13, 60)]));
		expect(result.classification).toBe('SHIFT_ONLY');
		expect(result.removed).toEqual([{ y: 10, height: 3 }]);
	});

	it('reports content changes at their rows', () => {
		const actual = range(0, 30);
		actual[12] = 500;
		actual[13] = 501;
		const result = alignRows(image(range(0, 30)), image(actual));
		expect(result.classification).toBe('CONTENT_CHANGE');
		expect(result.changedRows).toBe(2);
		expect(result.changedBox).toEqual({ top: 12, bottom: 14 });
	});

	it('separates a shift above from a change below', () => {
		const actual = [...range(0, 5), 700, ...range(5, 40)];
		actual[30] = 800;
		const result = alignRows(image(range(0, 40)), image(actual));
		expect(result.classification).toBe('MIXED');
		expect(result.inserted).toEqual([{ y: 5, height: 1 }]);
		expect(result.changedBox).toEqual({ top: 30, bottom: 31 });
	});

	it('ignores sub-threshold noise in otherwise aligned rows', () => {
		const expected = image(range(0, 20));
		const actual = image(range(0, 20));
		actual.data[4 * WIDTH * 7] ^= 1;
		expect(alignRows(expected, actual).classification).toBe('IDENTICAL');
	});

	it('decodes PNGs before aligning', async () => {
		const png = (height: number) =>
			sharp({ create: { width: 4, height, channels: 3, background: '#808080' } })
				.png()
				.toBuffer();
		const result = await alignPngRows(await png(10), await png(12));
		expect(result.classification).toBe('SHIFT_ONLY');
		expect(result.heightDelta).toBe(2);
	});
});
