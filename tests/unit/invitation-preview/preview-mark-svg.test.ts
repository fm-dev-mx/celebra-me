import { buildPreviewMarkSvg, PREVIEW_MARK_TEXT } from '@/lib/invitation/preview/preview-mark-svg';

describe('preview mark SVG', () => {
	it('covers the requested size with a rotated repeating pattern', () => {
		const svg = buildPreviewMarkSvg({ width: 1200, height: 630 });
		expect(svg).toContain('width="1200" height="630"');
		expect(svg).toContain('patternTransform="rotate(-28)"');
		expect(svg).toContain('<rect width="1200" height="630" fill="url(#preview-mark)"/>');
	});

	it('draws the letters as strokes, with no font dependency', () => {
		const svg = buildPreviewMarkSvg({ width: 800, height: 800 });
		expect(svg).not.toMatch(/<text|font-family/);
		expect((svg.match(/<path /g) ?? []).length).toBeGreaterThan(PREVIEW_MARK_TEXT.length);
		expect(svg).toContain('stroke="#fff"');
		expect(svg).toContain('stroke="#000"');
	});

	it('scales the mark with the image', () => {
		const small = buildPreviewMarkSvg({ width: 400, height: 400 });
		const large = buildPreviewMarkSvg({ width: 2400, height: 2400 });
		const tile = (svg: string) =>
			Number(
				svg.match(
					/pattern id="preview-mark" patternUnits="userSpaceOnUse" width="(\d+)"/,
				)?.[1],
			);
		expect(tile(large)).toBeGreaterThan(tile(small));
	});

	it('rejects an empty size', () => {
		expect(() => buildPreviewMarkSvg({ width: 0, height: 10 })).toThrow();
	});
});
