import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
	assertContinuousDocumentStrips,
	assertContinuousPhysicalStripPlacements,
	compositeSectionCapturePngs,
	computeDocumentCompositeLayout,
	listOrderedSectionCapturePaths,
	parseSectionCaptureIdentity,
	planDocumentCaptureStrips,
	planDocumentStripPhysicalPlacement,
	resolveInvitationDocumentCaptureRange,
	type SectionCompositeFragment,
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

async function samplePixel(
	filePath: string,
	x: number,
	y: number,
): Promise<{ r: number; g: number; b: number; a: number }> {
	const { data, info } = await sharp(filePath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const idx = (y * info.width + x) * info.channels;
	return {
		r: data[idx] ?? 0,
		g: data[idx + 1] ?? 0,
		b: data[idx + 2] ?? 0,
		a: data[idx + 3] ?? 0,
	};
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

	it('parses section capture identity from 10-{order}-{id} filenames', () => {
		expect(parseSectionCaptureIdentity(path.join(tempDir, '10-04-gifts.png'))).toEqual({
			order: 4,
			sectionId: 'gifts',
		});
		expect(parseSectionCaptureIdentity('05-invitation-full-page.png')).toBeNull();
	});

	it('layouts contiguous sections with canvas height from document span', () => {
		const layout = computeDocumentCompositeLayout([
			{ file: 'a.png', docTop: 0, docHeight: 800, order: 1 },
			{ file: 'b.png', docTop: 800, docHeight: 300, order: 2 },
		]);
		expect(layout.originTop).toBe(0);
		expect(layout.canvasCssHeight).toBe(1100);
		expect(layout.placements.map((p) => p.cssTop)).toEqual([0, 800]);
	});

	it('layouts overlapping sections without summing PNG heights', () => {
		const layout = computeDocumentCompositeLayout([
			{ file: 'gifts.png', docTop: 1000, docHeight: 500, order: 1, sectionId: 'gifts' },
			{ file: 'rsvp.png', docTop: 1480, docHeight: 600, order: 2, sectionId: 'rsvp' },
		]);
		// Overlap 20px: span is 1080, not 500+600=1100
		expect(layout.originTop).toBe(1000);
		expect(layout.canvasCssHeight).toBe(1080);
		expect(layout.placements[0]).toMatchObject({ cssTop: 0, cssHeight: 500 });
		expect(layout.placements[1]).toMatchObject({ cssTop: 480, cssHeight: 600 });
	});

	it('layouts positive gaps between sections', () => {
		const layout = computeDocumentCompositeLayout([
			{ file: 'a.png', docTop: 0, docHeight: 100, order: 1 },
			{ file: 'b.png', docTop: 150, docHeight: 100, order: 2 },
		]);
		expect(layout.canvasCssHeight).toBe(250);
		expect(layout.placements[1].cssTop).toBe(150);
	});

	it('composites contiguous document fragments (no regression vs stacked height)', async () => {
		const hero = path.join(tempDir, '10-01-hero.png');
		const quote = path.join(tempDir, '10-02-quote.png');
		const out = path.join(tempDir, '05-invitation-full-page.png');

		await writeSolidPng(hero, 390, 800, { r: 200, g: 40, b: 40 });
		await writeSolidPng(quote, 390, 300, { r: 40, g: 200, b: 40 });

		const fragments: SectionCompositeFragment[] = [
			{ file: hero, docTop: 0, docHeight: 800, order: 1, sectionId: 'hero' },
			{ file: quote, docTop: 800, docHeight: 300, order: 2, sectionId: 'quote' },
		];
		const result = await compositeSectionCapturePngs(fragments, out, {
			deviceScaleFactor: 1,
		});
		expect(result.sectionCount).toBe(2);
		expect(result.cssHeight).toBe(1100);
		expect(result.height).toBe(1100);

		const meta = await sharp(out).metadata();
		expect(meta.width).toBe(390);
		expect(meta.height).toBe(1100);
	});

	it('places overlapping fragments by document offset and paints later section on top', async () => {
		const gifts = path.join(tempDir, '10-01-gifts.png');
		const rsvp = path.join(tempDir, '10-02-rsvp.png');
		const out = path.join(tempDir, '05-invitation-full-page.png');

		await writeSolidPng(gifts, 100, 100, { r: 200, g: 0, b: 0 });
		await writeSolidPng(rsvp, 100, 100, { r: 0, g: 0, b: 200 });

		const result = await compositeSectionCapturePngs(
			[
				{ file: gifts, docTop: 0, docHeight: 100, order: 1, sectionId: 'gifts' },
				{ file: rsvp, docTop: 80, docHeight: 100, order: 2, sectionId: 'rsvp' },
			],
			out,
			{ deviceScaleFactor: 1 },
		);

		// Span 0→180, not 200
		expect(result.cssHeight).toBe(180);
		expect(result.height).toBe(180);

		const aboveOverlap = await samplePixel(out, 50, 40);
		expect(aboveOverlap.r).toBeGreaterThan(150);
		expect(aboveOverlap.b).toBeLessThan(50);

		const inOverlap = await samplePixel(out, 50, 90);
		expect(inOverlap.b).toBeGreaterThan(150);
		expect(inOverlap.r).toBeLessThan(50);
	});

	it('preserves a positive gap as empty canvas between fragments', async () => {
		const first = path.join(tempDir, '10-01-first.png');
		const second = path.join(tempDir, '10-02-second.png');
		const out = path.join(tempDir, '05-invitation-full-page.png');

		await writeSolidPng(first, 80, 40, { r: 10, g: 200, b: 10 });
		await writeSolidPng(second, 80, 40, { r: 10, g: 10, b: 200 });

		const result = await compositeSectionCapturePngs(
			[
				{ file: first, docTop: 0, docHeight: 40, order: 1 },
				{ file: second, docTop: 80, docHeight: 40, order: 2 },
			],
			out,
			{ deviceScaleFactor: 1 },
		);

		expect(result.cssHeight).toBe(120);
		expect(result.height).toBe(120);

		const gap = await samplePixel(out, 40, 60);
		expect(gap.a).toBe(0);
	});

	it('keeps path-only composite API as contiguous stacking for legacy callers', async () => {
		const hero = path.join(tempDir, '10-01-hero.png');
		const quote = path.join(tempDir, '10-02-quote.png');
		const out = path.join(tempDir, '05-invitation-full-page.png');

		await writeSolidPng(hero, 390, 800, { r: 200, g: 40, b: 40 });
		await writeSolidPng(quote, 390, 300, { r: 40, g: 200, b: 40 });

		const result = await compositeSectionCapturePngs([quote, hero], out);
		expect(result.sectionCount).toBe(2);
		expect(result.height).toBe(1100);
		expect(result.cssHeight).toBe(1100);
	});

	it('documents that operational toolbar selectors feed both audit and capture overlay hide paths', async () => {
		const { getDefaultHideSelectors, getOperationalToolbarSelectors } =
			await import('../../../scripts/screenshot/utils');
		const toolbars = getOperationalToolbarSelectors();
		expect(toolbars.length).toBeGreaterThan(0);
		for (const selector of toolbars) {
			expect(getDefaultHideSelectors()).toContain(selector);
		}
		expect(getDefaultHideSelectors().join(',')).toContain('astro-dev-toolbar');
		expect(getDefaultHideSelectors().join(',')).toContain('vercel');
	});
});

describe('invitation full-page document-space strips', () => {
	it('resolves contiguous section range without summing heights', () => {
		const range = resolveInvitationDocumentCaptureRange([
			{ docTop: 0, docHeight: 800 },
			{ docTop: 800, docHeight: 400 },
		]);
		expect(range).toEqual({ topY: 0, bottomY: 1200, totalHeight: 1200 });
	});

	it('resolves negative section overlap into a shorter continuous span', () => {
		const range = resolveInvitationDocumentCaptureRange([
			{ docTop: 1000, docHeight: 500 },
			{ docTop: 1480, docHeight: 600 },
		]);
		expect(range.topY).toBe(1000);
		expect(range.bottomY).toBe(2080);
		expect(range.totalHeight).toBe(1080);
	});

	it('includes positive layout gaps in the capture span', () => {
		const range = resolveInvitationDocumentCaptureRange([
			{ docTop: 0, docHeight: 100 },
			{ docTop: 150, docHeight: 100 },
		]);
		expect(range.totalHeight).toBe(250);
	});

	it('covers pseudo/overflow content by spanning section document boxes continuously', () => {
		// Overflow crossing a boundary lives in document Y between boxes; the
		// capture range is still first.top → last.bottom with no bleed heuristics.
		const range = resolveInvitationDocumentCaptureRange([
			{ docTop: 200, docHeight: 400 },
			{ docTop: 580, docHeight: 300 },
		]);
		expect(range.topY).toBe(200);
		expect(range.bottomY).toBe(880);
		const plan = planDocumentCaptureStrips({
			topY: range.topY,
			bottomY: range.bottomY,
			maxStripHeight: 250,
		});
		expect(plan.strips.some((s) => s.docY < 580 && s.docY + s.height > 580)).toBe(true);
	});

	it('partitions the range into continuous strips with no gaps or overlaps', () => {
		const plan = planDocumentCaptureStrips({
			topY: 10.2,
			bottomY: 2010.7,
			maxStripHeight: 800,
		});
		expect(plan.originTop).toBe(10);
		expect(plan.totalHeight).toBe(2001);
		assertContinuousDocumentStrips(
			plan.strips,
			plan.originTop,
			plan.originTop + plan.totalHeight,
		);

		const covered = plan.strips.reduce((sum, s) => sum + s.height, 0);
		expect(covered).toBe(plan.totalHeight);

		for (let i = 1; i < plan.strips.length; i++) {
			expect(plan.strips[i].docY).toBe(plan.strips[i - 1].docY + plan.strips[i - 1].height);
		}
	});

	it('places multiple strips by document Y with exact canvas height', () => {
		const plan = planDocumentCaptureStrips({
			topY: 0,
			bottomY: 2500,
			maxStripHeight: 844,
		});
		const physical = planDocumentStripPhysicalPlacement(plan, 2);
		expect(physical.canvasHeight).toBe(5000);
		expect(physical.placements.length).toBeGreaterThan(1);
		assertContinuousPhysicalStripPlacements(physical.placements, physical.canvasHeight);

		expect(physical.placements[0].physicalTop).toBe(0);
		expect(physical.placements[1].physicalTop).toBe(physical.placements[0].physicalHeight);
		const last = physical.placements[physical.placements.length - 1];
		expect(last.physicalTop + last.physicalHeight).toBe(physical.canvasHeight);
	});

	it('keeps standalone 10-* ordering helpers unchanged for section QA artifacts', () => {
		const ordered = listOrderedSectionCapturePaths([
			'x/10-02-quote.png',
			'x/05-invitation-full-page.png',
			'x/10-01-hero.png',
		]);
		expect(ordered.map((p) => path.basename(p))).toEqual(['10-01-hero.png', '10-02-quote.png']);
		expect(parseSectionCaptureIdentity('10-03-location.png')).toEqual({
			order: 3,
			sectionId: 'location',
		});
	});
});
