import {
	MEMORIES_PUBLIC_ORIGIN,
	buildMemoriesPublicUrl,
} from '@/lib/memories/contract/private-request';
import {
	MEMORIES_QR_PARAMS,
	generateMemoriesQr,
	generateMemoriesQrSvg,
	parseQrArgs,
} from '../../../scripts/memories/qr';

const SLUG = 'victoria-y-roberto';
const TARGET_URL = `https://celebra-me.com/r/${SLUG}`;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const RASTER_TIMEOUT_MS = 60_000;

describe('memories QR arguments', () => {
	it('requires a valid public slug', () => {
		expect(parseQrArgs([`--slug=${SLUG}`])).toEqual({ slug: SLUG, check: false });
		expect(() => parseQrArgs([])).toThrow(/valid --slug/);
		expect(() => parseQrArgs(['--slug='])).toThrow(/Unknown argument/);
		expect(() => parseQrArgs(['--slug=Victoria'])).toThrow(/valid --slug/);
		expect(() => parseQrArgs(['--slug=victoria_y_roberto'])).toThrow(/valid --slug/);
		expect(() => parseQrArgs([`--slug=${'a'.repeat(65)}`])).toThrow(/valid --slug/);
	});

	it('accepts the repository convention with a separate value', () => {
		expect(parseQrArgs(['--slug', SLUG])).toEqual({ slug: SLUG, check: false });
		expect(parseQrArgs(['--', '--slug', SLUG, '--check'])).toEqual({ slug: SLUG, check: true });
		expect(() => parseQrArgs(['--slug'])).toThrow(/valid --slug/);
		expect(() => parseQrArgs(['--slug', 'Not A Slug'])).toThrow(/valid --slug/);
	});

	it('accepts --check and the package-manager separator, in any order', () => {
		expect(parseQrArgs([`--slug=${SLUG}`, '--check'])).toEqual({ slug: SLUG, check: true });
		expect(parseQrArgs(['--check', `--slug=${SLUG}`])).toEqual({ slug: SLUG, check: true });
		expect(parseQrArgs(['--', `--slug=${SLUG}`, '--check'])).toEqual({
			slug: SLUG,
			check: true,
		});
	});

	it('rejects unknown arguments', () => {
		expect(() => parseQrArgs([`--slug=${SLUG}`, '--force'])).toThrow(
			/Unknown argument: --force/,
		);
		expect(() => parseQrArgs([`--slug=${SLUG}`, SLUG])).toThrow(/Unknown argument/);
		expect(() => parseQrArgs([`--slug=${SLUG}`, '--slug'])).toThrow(/valid --slug/);
	});
});

describe('memories QR contract', () => {
	it('pins the printed origin and rendering parameters outside environment-derived values', () => {
		expect(MEMORIES_PUBLIC_ORIGIN).toBe('https://celebra-me.com');
		expect(buildMemoriesPublicUrl(SLUG)).toBe(TARGET_URL);
		expect(MEMORIES_QR_PARAMS.errorCorrectionLevel).toBe('H');
		expect(MEMORIES_QR_PARAMS.marginModules).toBe(4);
		expect(MEMORIES_QR_PARAMS.foregroundColor).toBe('#000000');
		expect(MEMORIES_QR_PARAMS.backgroundColor).toBe('#FFFFFF');
		expect(MEMORIES_QR_PARAMS.pngSizePx).toBeGreaterThanOrEqual(2000);
	});

	it('renders a deterministic SVG with a crisp quiet zone', async () => {
		const first = await generateMemoriesQrSvg(TARGET_URL);
		const second = await generateMemoriesQrSvg(TARGET_URL);

		expect(first).toBe(second);
		expect(first).toContain('<svg');
		expect(first.endsWith('\n')).toBe(true);
		expect(first).not.toContain('\r');
		expect(first).toContain('shape-rendering="crispEdges"');
		expect(first).toMatch(/fill="#FFFFFF"/i);
		expect(first).toMatch(/stroke="#000000"|fill="#000000"/i);
		expect(await generateMemoriesQrSvg('https://celebra-me.com/r/otro-evento')).not.toBe(first);
	});
});

describe('memories QR generation', () => {
	it(
		'builds SVG and PNG artifacts whose raster decodes back to the canonical public URL',
		async () => {
			const generated = await generateMemoriesQr(SLUG);

			expect(generated.targetUrl).toBe(TARGET_URL);
			expect(generated.decodedFromPng).toBe(TARGET_URL);
			expect(generated.decodedFromPng).toBe(`https://celebra-me.com/r/${SLUG}`);
			expect(generated.svg).toBe(await generateMemoriesQrSvg(TARGET_URL));
			expect(Array.from(generated.png.subarray(0, 8))).toEqual(PNG_SIGNATURE);
			expect(generated.png.readUInt32BE(16)).toBe(MEMORIES_QR_PARAMS.pngSizePx);
			expect(generated.png.readUInt32BE(20)).toBe(MEMORIES_QR_PARAMS.pngSizePx);
		},
		RASTER_TIMEOUT_MS,
	);
});
