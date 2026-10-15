import sharp from 'sharp';
import {
	buildPreviewMarkInstanceSvg,
	layoutPreviewMarkInstances,
	previewMarkInstanceSize,
} from '@/lib/invitation/preview/preview-mark-instances';
import { buildPreviewMarkSvg } from '@/lib/invitation/preview/preview-mark-svg';
import { PREVIEW_MARK_MASTER_PX_PER_UNIT } from '@/lib/invitation/preview/preview-mark-master-config';
import { PREVIEW_MARK_MASTER_PNG_BASE64 } from '@/lib/invitation/preview/preview-mark-master.generated';

async function alpha(input: Buffer): Promise<Buffer> {
	return sharp(input).ensureAlpha().extractChannel(3).raw().toBuffer();
}

describe('preview mark instances', () => {
	it('keeps the prerendered mark in sync with the SVG geometry', async () => {
		// Regenerate with `pnpm exec tsx scripts/invitation/generate-preview-mark-master.ts`.
		const fresh = await alpha(
			await sharp(Buffer.from(buildPreviewMarkInstanceSvg(PREVIEW_MARK_MASTER_PX_PER_UNIT)))
				.png()
				.toBuffer(),
		);
		const committed = await alpha(Buffer.from(PREVIEW_MARK_MASTER_PNG_BASE64, 'base64'));
		expect(committed.length).toBe(fresh.length);
		let diff = 0;
		for (let i = 0; i < fresh.length; i++) diff += Math.abs(fresh[i] - committed[i]);
		expect(diff / fresh.length).toBeLessThan(0.5);
		const size = previewMarkInstanceSize(PREVIEW_MARK_MASTER_PX_PER_UNIT);
		const meta = await sharp(Buffer.from(PREVIEW_MARK_MASTER_PNG_BASE64, 'base64')).metadata();
		expect([meta.width, meta.height]).toEqual([size.width, size.height]);
	});

	it.each([
		[1066, 1600],
		[1200, 630],
		[2160, 3840],
		[480, 480],
	])('reproduces the tiled SVG pattern at %ix%i', async (width, height) => {
		const reference = await alpha(
			await sharp(Buffer.from(buildPreviewMarkSvg({ width, height })))
				.png()
				.toBuffer(),
		);
		const layout = layoutPreviewMarkInstances({ width, height });
		const master = Buffer.from(PREVIEW_MARK_MASTER_PNG_BASE64, 'base64');
		const mark = await sharp(master).resize({ width: layout.instanceWidth }).png().toBuffer();
		const composed = await alpha(
			await sharp({
				create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
			})
				.composite(layout.instances.map((at) => ({ input: mark, ...at })))
				.png()
				.toBuffer(),
		);

		let diff = 0;
		for (let i = 0; i < reference.length; i++) diff += Math.abs(reference[i] - composed[i]);
		// Below 1% mean alpha error: sub-pixel placement and one resampling pass.
		expect(diff / reference.length / 255).toBeLessThan(0.01);
		expect(layout.instances.length).toBeGreaterThan(4);
	});

	it('only places marks that touch the image', () => {
		const layout = layoutPreviewMarkInstances({ width: 1200, height: 630 });
		const size = previewMarkInstanceSize(PREVIEW_MARK_MASTER_PX_PER_UNIT);
		const scaledHeight = Math.ceil((size.height * layout.instanceWidth) / size.width);
		for (const { left, top } of layout.instances) {
			expect(left).toBeLessThan(1200);
			expect(top).toBeLessThan(630);
			expect(left + layout.instanceWidth).toBeGreaterThan(0);
			expect(top + scaledHeight).toBeGreaterThan(0);
		}
	});

	it('rejects an empty size', () => {
		expect(() => layoutPreviewMarkInstances({ width: 0, height: 10 })).toThrow();
	});
});
