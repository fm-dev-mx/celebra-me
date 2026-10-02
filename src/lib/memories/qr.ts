/**
 * Printable QR for an event memory space. Pure function of the public URL, shared
 * by the dashboard download routes and the `memories:qr` CLI so every surface
 * produces byte-identical SVGs.
 */

import QRCode from 'qrcode';

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

export function buildMemoriesQrFileName(publicSlug: string): string {
	return `qr-recuerdos-${publicSlug}.svg`;
}
