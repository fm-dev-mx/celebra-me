import { existsSync, readFileSync } from 'node:fs';
import {
	VALENTINA_MEMORIES_PNG_RELATIVE_PATH,
	VALENTINA_MEMORIES_QR_TARGET_URL,
	VALENTINA_MEMORIES_ROUTE_PATH,
	VALENTINA_MEMORIES_SVG_RELATIVE_PATH,
	valentinaMemoriesPageCopy,
	valentinaMemoriesQrParams,
} from '@/data/valentina-memories.data';
import {
	buildValentinaMemoriesArtifacts,
	checkValentinaMemoriesArtifacts,
	generateValentinaMemoriesSvg,
	parseSvgModuleCount,
	validateQuietZone,
} from '../../../scripts/qr/generate-valentina-memories.ts';

describe('valentina memories QR contract', () => {
	it('pins the permanent QR URL outside environment-derived origins', () => {
		expect(VALENTINA_MEMORIES_QR_TARGET_URL).toBe('https://celebra-me.com/r/valentina');
		expect(VALENTINA_MEMORIES_ROUTE_PATH).toBe('/r/valentina');
		expect(VALENTINA_MEMORIES_SVG_RELATIVE_PATH).toBe('public/qr/valentina-memories.svg');
		expect(VALENTINA_MEMORIES_PNG_RELATIVE_PATH).toBe('public/qr/valentina-memories.png');
		expect(valentinaMemoriesQrParams.errorCorrectionLevel).toBe('H');
		expect(valentinaMemoriesQrParams.marginModules).toBe(4);
		expect(valentinaMemoriesQrParams.foregroundColor).toBe('#000000');
		expect(valentinaMemoriesQrParams.backgroundColor).toBe('#FFFFFF');
		expect(valentinaMemoriesQrParams.pngSizePx).toBeGreaterThanOrEqual(2000);
		expect(valentinaMemoriesPageCopy.robots).toBe('noindex');
		expect(valentinaMemoriesPageCopy.body).toMatch(/fotos y videos/i);
	});
});

describe('generate-valentina-memories', () => {
	it('generates a deterministic SVG with expected structure and quiet zone', async () => {
		const first = await generateValentinaMemoriesSvg();
		const second = await generateValentinaMemoriesSvg();

		expect(first).toBe(second);
		expect(first).toContain('<svg');
		expect(first).toContain('shape-rendering="crispEdges"');
		expect(first).toMatch(/fill="#FFFFFF"/i);
		expect(first).toMatch(/stroke="#000000"|fill="#000000"/i);

		const modules = parseSvgModuleCount(first);
		expect(modules).not.toBeNull();
		expect(modules!).toBeGreaterThanOrEqual(21 + 2 * valentinaMemoriesQrParams.marginModules);
	});

	it('builds SVG and PNG artifacts that independently decode to the canonical URL', async () => {
		const artifacts = await buildValentinaMemoriesArtifacts();

		expect(artifacts.decodedFromSvg).toBe(VALENTINA_MEMORIES_QR_TARGET_URL);
		expect(artifacts.decodedFromPng).toBe(VALENTINA_MEMORIES_QR_TARGET_URL);
		expect(artifacts.pngFormat).toBe('png');
		expect(artifacts.pngWidth).toBeGreaterThanOrEqual(valentinaMemoriesQrParams.pngSizePx);
		expect(artifacts.pngHeight).toBeGreaterThanOrEqual(valentinaMemoriesQrParams.pngSizePx);
		expect(artifacts.quietZoneValid).toBe(true);

		const modules = parseSvgModuleCount(artifacts.svg);
		expect(modules).not.toBeNull();
		expect(
			await validateQuietZone(artifacts.png, valentinaMemoriesQrParams.marginModules, {
				totalModules: modules!,
			}),
		).toBe(true);
	});

	it('passes drift check against committed public assets', async () => {
		expect(existsSync(VALENTINA_MEMORIES_SVG_RELATIVE_PATH)).toBe(true);
		expect(existsSync(VALENTINA_MEMORIES_PNG_RELATIVE_PATH)).toBe(true);

		const result = await checkValentinaMemoriesArtifacts();
		expect(result.failures).toEqual([]);
		expect(result.ok).toBe(true);
	});

	it('detects SVG contract drift without mutating committed assets', async () => {
		const committedSvg = readFileSync(VALENTINA_MEMORIES_SVG_RELATIVE_PATH, 'utf8');
		const expectedSvg = await generateValentinaMemoriesSvg();
		const driftedSvg = expectedSvg.replace('crispEdges', 'auto');

		expect(committedSvg.replace(/\r\n/g, '\n')).toBe(expectedSvg);
		expect(driftedSvg).not.toBe(expectedSvg);
	});
});
