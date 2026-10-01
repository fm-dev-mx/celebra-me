#!/usr/bin/env node
/**
 * Generates the printable QR for one event memory space.
 *
 * Usage:
 *   pnpm memories:qr -- --slug <public-slug>            # SVG + PNG under .tmp/memories-qr/
 *   pnpm memories:qr -- --slug <public-slug> --check    # decode and report without writing
 *
 * The payload is a pure function of the public slug and the printed origin
 * contract. Nothing is read from the database or the environment.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {
	buildMemoriesPublicUrl,
	isMemoriesPublicSlug,
} from '../../src/lib/memories/contract/private-request.ts';

/** Fixed rendering parameters: changing them changes every printed code. */
export const MEMORIES_QR_PARAMS = {
	errorCorrectionLevel: 'H' as const,
	/** Quiet-zone modules around the QR matrix (QR Code Model 2). */
	marginModules: 4,
	foregroundColor: '#000000',
	backgroundColor: '#FFFFFF',
	svgWidthPx: 1024,
	pngSizePx: 2000,
} as const;

const OUTPUT_DIRECTORY = path.join('.tmp', 'memories-qr');

export interface GeneratedQr {
	targetUrl: string;
	svg: string;
	png: Buffer;
	decodedFromPng: string;
}

/** Accepts `--slug <slug>` (repository convention) and `--slug=<slug>`. */
export function parseQrArgs(argv: readonly string[]): { slug: string; check: boolean } {
	const normalized = argv[0] === '--' ? argv.slice(1) : argv;
	let slug = '';
	let check = false;
	for (let index = 0; index < normalized.length; index += 1) {
		const argument = normalized[index];
		if (argument === '--check') {
			check = true;
			continue;
		}
		if (argument === '--slug') {
			slug = normalized[index + 1] ?? '';
			index += 1;
			continue;
		}
		const match = /^--slug=(.+)$/.exec(argument);
		if (!match) throw new Error(`Unknown argument: ${argument}`);
		slug = match[1];
	}
	if (!isMemoriesPublicSlug(slug)) {
		throw new Error('A valid --slug <public-slug> (lowercase kebab-case) is required.');
	}
	return { slug, check };
}

export async function generateMemoriesQrSvg(targetUrl: string): Promise<string> {
	const svg = await QRCode.toString(targetUrl, {
		type: 'svg',
		errorCorrectionLevel: MEMORIES_QR_PARAMS.errorCorrectionLevel,
		margin: MEMORIES_QR_PARAMS.marginModules,
		width: MEMORIES_QR_PARAMS.svgWidthPx,
		color: {
			dark: MEMORIES_QR_PARAMS.foregroundColor,
			light: MEMORIES_QR_PARAMS.backgroundColor,
		},
	});
	return `${svg.replace(/\r\n/g, '\n').trim()}\n`;
}

async function rasterize(svg: string): Promise<Buffer> {
	return sharp(Buffer.from(svg, 'utf8'))
		.resize(MEMORIES_QR_PARAMS.pngSizePx, MEMORIES_QR_PARAMS.pngSizePx, {
			fit: 'fill',
			kernel: 'nearest',
		})
		.ensureAlpha()
		.png()
		.toBuffer();
}

async function decode(png: Buffer): Promise<string> {
	const { data, info } = await sharp(png)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
		inversionAttempts: 'dontInvert',
	});
	if (!code?.data) throw new Error('Unable to decode the QR payload from the raster image.');
	return code.data;
}

export async function generateMemoriesQr(slug: string): Promise<GeneratedQr> {
	const targetUrl = buildMemoriesPublicUrl(slug);
	const svg = await generateMemoriesQrSvg(targetUrl);
	const png = await rasterize(svg);
	const decodedFromPng = await decode(png);
	if (decodedFromPng !== targetUrl) {
		throw new Error('The rendered QR does not decode to the expected public URL.');
	}
	return { targetUrl, svg, png, decodedFromPng };
}

async function main(): Promise<void> {
	const { slug, check } = parseQrArgs(process.argv.slice(2));
	const generated = await generateMemoriesQr(slug);
	if (check) {
		process.stdout.write(`QR OK: ${generated.targetUrl}\n`);
		return;
	}
	const directory = path.join(process.cwd(), OUTPUT_DIRECTORY);
	mkdirSync(directory, { recursive: true });
	const svgPath = path.join(directory, `${slug}.svg`);
	const pngPath = path.join(directory, `${slug}.png`);
	writeFileSync(svgPath, generated.svg, 'utf8');
	writeFileSync(pngPath, generated.png);
	process.stdout.write(
		`Generated ${path.relative(process.cwd(), svgPath)} and ${path.relative(process.cwd(), pngPath)} for ${generated.targetUrl}\n`,
	);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/memories/qr.ts')) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
