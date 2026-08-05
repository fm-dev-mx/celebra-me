#!/usr/bin/env node
/**
 * Generate and drift-check the Valentina Memories QR assets.
 *
 * Usage:
 *   pnpm qr:valentina-memories           # write SVG + PNG
 *   pnpm qr:valentina-memories --check    # fail if committed assets drift
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {
	VALENTINA_MEMORIES_PNG_RELATIVE_PATH,
	VALENTINA_MEMORIES_QR_TARGET_URL,
	VALENTINA_MEMORIES_SVG_RELATIVE_PATH,
	valentinaMemoriesQrParams,
} from '../../src/data/valentina-memories.data.ts';

const REPO_ROOT = process.cwd();

export interface GeneratedQrArtifacts {
	svg: string;
	png: Buffer;
	decodedFromSvg: string;
	decodedFromPng: string;
	pngWidth: number;
	pngHeight: number;
	pngFormat: string | undefined;
	quietZoneValid: boolean;
}

function resolveRepoPath(relativePath: string): string {
	return path.join(REPO_ROOT, relativePath);
}

function normalizeNewlines(value: string): string {
	return value.replace(/\r\n/g, '\n');
}

export async function generateValentinaMemoriesSvg(): Promise<string> {
	const svg = await QRCode.toString(VALENTINA_MEMORIES_QR_TARGET_URL, {
		type: 'svg',
		errorCorrectionLevel: valentinaMemoriesQrParams.errorCorrectionLevel,
		margin: valentinaMemoriesQrParams.marginModules,
		width: valentinaMemoriesQrParams.svgWidthPx,
		color: {
			dark: valentinaMemoriesQrParams.foregroundColor,
			light: valentinaMemoriesQrParams.backgroundColor,
		},
	});
	return normalizeNewlines(svg.trim()) + '\n';
}

async function rasterizeSvg(svg: string, sizePx: number): Promise<Buffer> {
	return sharp(Buffer.from(svg, 'utf8'))
		.resize(sizePx, sizePx, {
			fit: 'fill',
			kernel: 'nearest',
		})
		.ensureAlpha()
		.png()
		.toBuffer();
}

async function decodeQrFromPngBuffer(png: Buffer): Promise<string> {
	const { data, info } = await sharp(png)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
		inversionAttempts: 'dontInvert',
	});

	if (!code?.data) {
		throw new Error('Unable to decode QR payload from raster image.');
	}

	return code.data;
}

/**
 * Parse the QR SVG viewBox module count (`0 0 N N`) so quiet-zone checks use
 * the real matrix size instead of a version lower-bound guess.
 */
export function parseSvgModuleCount(svg: string): number | null {
	const match = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
	if (!match) return null;
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (!Number.isFinite(width) || width <= 0 || width !== height) return null;
	return Math.round(width);
}

/**
 * Validate that the outer quiet zone is predominantly the background color.
 * Uses the SVG viewBox module count when available so the inspected band stays
 * inside the configured quiet zone and does not clip the finder patterns.
 */
export async function validateQuietZone(
	png: Buffer,
	marginModules: number,
	options?: { totalModules?: number },
): Promise<boolean> {
	const { data, info } = await sharp(png)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const width = info.width;
	const height = info.height;
	const channels = info.channels;
	const totalModules = options?.totalModules ?? 21 + 2 * marginModules;
	if (totalModules <= 2 * marginModules) return false;

	const modulePx = Math.min(width, height) / totalModules;
	// Stay one module inside the quiet zone to avoid matrix-edge sampling.
	const band = Math.max(1, Math.floor(modulePx * Math.max(1, marginModules - 1)));

	let quietPixels = 0;
	let backgroundPixels = 0;

	const isBackground = (x: number, y: number): boolean => {
		const i = (y * width + x) * channels;
		const r = data[i] ?? 0;
		const g = data[i + 1] ?? 0;
		const b = data[i + 2] ?? 0;
		return r >= 250 && g >= 250 && b >= 250;
	};

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const inQuietZone = x < band || y < band || x >= width - band || y >= height - band;
			if (!inQuietZone) continue;
			quietPixels += 1;
			if (isBackground(x, y)) backgroundPixels += 1;
		}
	}

	if (quietPixels === 0) return false;
	return backgroundPixels / quietPixels >= 0.995;
}

export async function buildValentinaMemoriesArtifacts(): Promise<GeneratedQrArtifacts> {
	const svg = await generateValentinaMemoriesSvg();
	const png = await rasterizeSvg(svg, valentinaMemoriesQrParams.pngSizePx);
	const meta = await sharp(png).metadata();

	const decodedFromSvg = await decodeQrFromPngBuffer(
		await rasterizeSvg(svg, valentinaMemoriesQrParams.pngSizePx),
	);
	const decodedFromPng = await decodeQrFromPngBuffer(png);
	const totalModules = parseSvgModuleCount(svg);
	if (totalModules === null) {
		throw new Error('Unable to parse QR SVG viewBox module count.');
	}
	const expectedMinModules = 21 + 2 * valentinaMemoriesQrParams.marginModules;
	if (totalModules < expectedMinModules) {
		throw new Error(
			`SVG viewBox module count ${totalModules} is below expected minimum ${expectedMinModules}.`,
		);
	}
	const quietZoneValid = await validateQuietZone(png, valentinaMemoriesQrParams.marginModules, {
		totalModules,
	});

	if (decodedFromSvg !== VALENTINA_MEMORIES_QR_TARGET_URL) {
		throw new Error(
			`SVG-derived QR decoded to "${decodedFromSvg}" instead of "${VALENTINA_MEMORIES_QR_TARGET_URL}".`,
		);
	}
	if (decodedFromPng !== VALENTINA_MEMORIES_QR_TARGET_URL) {
		throw new Error(
			`PNG QR decoded to "${decodedFromPng}" instead of "${VALENTINA_MEMORIES_QR_TARGET_URL}".`,
		);
	}
	if (!quietZoneValid) {
		throw new Error('Generated QR quiet zone failed background validation.');
	}
	if (
		(meta.width ?? 0) < valentinaMemoriesQrParams.pngSizePx ||
		(meta.height ?? 0) < valentinaMemoriesQrParams.pngSizePx
	) {
		throw new Error(
			`PNG dimensions ${meta.width}x${meta.height} are below required ${valentinaMemoriesQrParams.pngSizePx}x${valentinaMemoriesQrParams.pngSizePx}.`,
		);
	}
	if (meta.format !== 'png') {
		throw new Error(`Expected PNG format, received "${meta.format ?? 'unknown'}".`);
	}

	return {
		svg,
		png,
		decodedFromSvg,
		decodedFromPng,
		pngWidth: meta.width ?? 0,
		pngHeight: meta.height ?? 0,
		pngFormat: meta.format,
		quietZoneValid,
	};
}

function sha256(buffer: Buffer | string): string {
	return createHash('sha256').update(buffer).digest('hex');
}

export async function writeValentinaMemoriesArtifacts(
	artifacts?: GeneratedQrArtifacts,
): Promise<void> {
	const resolved = artifacts ?? (await buildValentinaMemoriesArtifacts());
	const svgPath = resolveRepoPath(VALENTINA_MEMORIES_SVG_RELATIVE_PATH);
	const pngPath = resolveRepoPath(VALENTINA_MEMORIES_PNG_RELATIVE_PATH);
	mkdirSync(path.dirname(svgPath), { recursive: true });
	writeFileSync(svgPath, resolved.svg, 'utf8');
	writeFileSync(pngPath, resolved.png);
}

export interface DriftCheckResult {
	ok: boolean;
	failures: string[];
}

export async function checkValentinaMemoriesArtifacts(): Promise<DriftCheckResult> {
	const failures: string[] = [];
	const expected = await buildValentinaMemoriesArtifacts();
	const svgPath = resolveRepoPath(VALENTINA_MEMORIES_SVG_RELATIVE_PATH);
	const pngPath = resolveRepoPath(VALENTINA_MEMORIES_PNG_RELATIVE_PATH);

	if (!existsSync(svgPath)) {
		failures.push(`Missing committed SVG at ${VALENTINA_MEMORIES_SVG_RELATIVE_PATH}`);
	} else {
		const committedSvg = normalizeNewlines(readFileSync(svgPath, 'utf8'));
		if (committedSvg !== expected.svg) {
			failures.push(
				`Committed SVG drifted from source contract (expected sha ${sha256(expected.svg)}, found ${sha256(committedSvg)}).`,
			);
		}
	}

	if (!existsSync(pngPath)) {
		failures.push(`Missing committed PNG at ${VALENTINA_MEMORIES_PNG_RELATIVE_PATH}`);
	} else {
		const committedPng = readFileSync(pngPath);
		const meta = await sharp(committedPng).metadata();

		if (meta.format !== 'png') {
			failures.push(`Committed asset is not PNG (format=${meta.format ?? 'unknown'}).`);
		}
		if (
			(meta.width ?? 0) < valentinaMemoriesQrParams.pngSizePx ||
			(meta.height ?? 0) < valentinaMemoriesQrParams.pngSizePx
		) {
			failures.push(
				`Committed PNG dimensions ${meta.width}x${meta.height} are below ${valentinaMemoriesQrParams.pngSizePx}x${valentinaMemoriesQrParams.pngSizePx}.`,
			);
		}

		try {
			const decoded = await decodeQrFromPngBuffer(committedPng);
			if (decoded !== VALENTINA_MEMORIES_QR_TARGET_URL) {
				failures.push(
					`Committed PNG decoded to "${decoded}" instead of "${VALENTINA_MEMORIES_QR_TARGET_URL}".`,
				);
			}
		} catch (error) {
			failures.push(
				`Committed PNG failed decode: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Source relationship: regenerating from the committed SVG must decode
		// to the same canonical URL (PNG bytes may differ across sharp builds).
		if (existsSync(svgPath)) {
			const committedSvg = normalizeNewlines(readFileSync(svgPath, 'utf8'));
			const totalModules = parseSvgModuleCount(committedSvg);
			if (totalModules === null) {
				failures.push('Committed SVG is missing a square viewBox module count.');
			} else {
				try {
					const quietZoneValid = await validateQuietZone(
						committedPng,
						valentinaMemoriesQrParams.marginModules,
						{ totalModules },
					);
					if (!quietZoneValid) {
						failures.push('Committed PNG quiet zone failed background validation.');
					}
				} catch (error) {
					failures.push(
						`Committed PNG quiet-zone check failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}

			try {
				const derived = await rasterizeSvg(committedSvg, valentinaMemoriesQrParams.pngSizePx);
				const derivedDecoded = await decodeQrFromPngBuffer(derived);
				if (derivedDecoded !== VALENTINA_MEMORIES_QR_TARGET_URL) {
					failures.push(
						`PNG source relationship failed: SVG re-rasterization decoded to "${derivedDecoded}".`,
					);
				}
			} catch (error) {
				failures.push(
					`PNG source relationship check failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	return { ok: failures.length === 0, failures };
}

async function main(): Promise<void> {
	const checkMode = process.argv.includes('--check');

	if (checkMode) {
		const result = await checkValentinaMemoriesArtifacts();
		if (!result.ok) {
			console.error('Valentina Memories QR drift check failed:');
			for (const failure of result.failures) {
				console.error(`  - ${failure}`);
			}
			process.exitCode = 1;
			return;
		}
		console.log('Valentina Memories QR drift check passed.');
		return;
	}

	const artifacts = await buildValentinaMemoriesArtifacts();
	await writeValentinaMemoriesArtifacts(artifacts);
	console.log(
		`Wrote ${VALENTINA_MEMORIES_SVG_RELATIVE_PATH} and ${VALENTINA_MEMORIES_PNG_RELATIVE_PATH} (${artifacts.pngWidth}x${artifacts.pngHeight}).`,
	);
}

const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectRun =
	entryArg.endsWith(`${path.sep}generate-valentina-memories.ts`) ||
	entryArg.endsWith(`${path.sep}generate-valentina-memories.js`);

if (isDirectRun) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
