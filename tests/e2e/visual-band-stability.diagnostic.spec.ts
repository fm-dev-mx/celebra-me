import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
	captureCompletePage,
	initializeVisualCapture,
	prepareCompletePage,
} from './harness/complete-page-capture';
import {
	extractBands,
	planSectionBands,
	type SectionBoundary,
} from '../../scripts/screenshot/visual-bands';
import { alignPngRows } from '../../scripts/screenshot/visual-row-alignment';
import { compareWithVisualGate } from '../../scripts/screenshot/visual-gate-comparator';
import {
	buildVisualPageCases,
	VISUAL_VIEWPORTS,
} from '../../scripts/screenshot/visual-coverage-contract';

/**
 * Diagnostic probe for banded complete-page comparison. Inserting one row at the top of the first
 * section must change only that section's band; any other changed band reveals a layer (fixed
 * position, fixed backgrounds, viewport units) that would make bands cascade like whole pages.
 */
const OUTPUT_ROOT = path.resolve(
	process.env.VISUAL_BAND_PROBE_OUTPUT ?? '.tmp/visual-parity/band-probe',
);
const CASES = buildVisualPageCases().filter(
	(entry) =>
		!process.env.VISUAL_BAND_PROBE_KIND || entry.kind === process.env.VISUAL_BAND_PROBE_KIND,
);

async function readBoundaries(page: Page): Promise<SectionBoundary[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				'[data-screenshot-section="hero"], .invitation-section-wrapper[data-section-kind]',
			),
		)
			.filter((element) => element.getClientRects().length > 0)
			.map((element) => ({
				kind: element.dataset.sectionKind ?? 'hero',
				top: element.getBoundingClientRect().top + window.scrollY,
			}))
			.sort((left, right) => left.top - right.top),
	);
}

test.describe('Banded complete-page stability probe @extended', () => {
	test.describe.configure({ mode: 'parallel', retries: 0 });
	for (const entry of CASES) {
		for (const viewport of VISUAL_VIEWPORTS) {
			test(`${entry.kind} ${entry.eventType}/${entry.slug} @ ${viewport.name}`, async ({
				page,
			}) => {
				test.setTimeout(120_000);
				await initializeVisualCapture(page);
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				const response = await page.goto(
					`/${entry.eventType}/${entry.slug}?skipEnvelope=true&screenshot=true&animations=off`,
					{ waitUntil: 'load' },
				);
				expect(response?.status()).toBe(200);
				await page.evaluate(() => document.fonts.ready);
				await prepareCompletePage(page);
				const before = await captureCompletePage(page);
				const beforeBands = planSectionBands({
					rasterHeight: (await sharp(before).metadata()).height ?? 0,
					sections: await readBoundaries(page),
				});

				// One extra row right before the second section, as a 1px font-metric change in the
				// first section would add: the first band grows and every later band moves down.
				const target = await page.evaluate(() => {
					const sections = Array.from(
						document.querySelectorAll<HTMLElement>(
							'[data-screenshot-section="hero"], .invitation-section-wrapper[data-section-kind]',
						),
					).filter((element) => element.getClientRects().length > 0);
					if (sections.length < 2) return null;
					const probe = document.createElement('div');
					probe.dataset.bandProbe = 'true';
					probe.style.cssText = 'height:1px;margin:0;padding:0;border:0';
					sections[1].before(probe);
					return sections[0].dataset.sectionKind ?? 'hero';
				});
				expect(target).not.toBeNull();
				const after = await captureCompletePage(page);
				const afterBands = planSectionBands({
					rasterHeight: (await sharp(after).metadata()).height ?? 0,
					sections: await readBoundaries(page),
				});
				expect(afterBands.map((band) => band.id)).toEqual(
					beforeBands.map((band) => band.id),
				);

				const [beforeCrops, afterCrops] = await Promise.all([
					extractBands(before, beforeBands),
					extractBands(after, afterBands),
				]);
				const bands = [];
				for (let index = 0; index < beforeCrops.length; index++) {
					const alignment = await alignPngRows(
						beforeCrops[index].png,
						afterCrops[index].png,
					);
					const gate = compareWithVisualGate(
						afterCrops[index].png,
						beforeCrops[index].png,
					);
					bands.push({
						id: beforeCrops[index].band.id,
						gatePassed: gate.passed,
						...(gate.differentPixels !== undefined
							? { differentPixels: gate.differentPixels }
							: {}),
						heightDelta: alignment.heightDelta,
						classification: alignment.classification,
						changedRows: alignment.changedRows,
						...(alignment.changedBox ? { changedBox: alignment.changedBox } : {}),
					});
				}
				const owner = beforeBands.find((band) => band.kind === target)?.id;
				// Pixel drift below the gate budget is reported; only gate failures leak.
				const drift = bands.filter(
					(band) => band.id !== owner && band.classification !== 'IDENTICAL',
				);
				const leaked = drift.filter((band) => !band.gatePassed);
				const wholePagePassed = compareWithVisualGate(after, before).passed;
				fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
				fs.writeFileSync(
					path.join(OUTPUT_ROOT, `${entry.kind}-${entry.slug}-${viewport.name}.json`),
					`${JSON.stringify({ route: `/${entry.eventType}/${entry.slug}`, viewport: viewport.name, owner, wholePagePassed, bands, drift, leaked }, null, 2)}\n`,
				);
				expect(
					leaked,
					'Only the band that received the extra row may fail the gate',
				).toEqual([]);
			});
		}
	}
});
