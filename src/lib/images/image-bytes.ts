/**
 * Header-level facts about image bytes (EXIF orientation, animation) that the Cloudflare
 * Images binding does not report. Pure and runtime-neutral: reads only the container
 * structure of JPEG, PNG and WebP, never decodes pixels.
 */

export interface ImageContainerFacts {
	/** EXIF orientation 1-8, when the file declares one. */
	orientation?: number;
	/** Number of frames; 1 for a still image. */
	pages: number;
}

const ORIENTATION_TAG = 0x0112;

function ascii(bytes: Uint8Array, offset: number, length: number): string {
	let text = '';
	for (let index = offset; index < offset + length && index < bytes.length; index += 1) {
		text += String.fromCharCode(bytes[index]);
	}
	return text;
}

/** Orientation from a TIFF block (the payload of an EXIF segment, without the `Exif` prefix). */
function orientationFromTiff(tiff: Uint8Array): number | undefined {
	if (tiff.length < 8) return undefined;
	const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
	const byteOrder = ascii(tiff, 0, 2);
	if (byteOrder !== 'II' && byteOrder !== 'MM') return undefined;
	const little = byteOrder === 'II';
	if (view.getUint16(2, little) !== 42) return undefined;
	const ifd = view.getUint32(4, little);
	if (ifd + 2 > tiff.length) return undefined;
	const entries = view.getUint16(ifd, little);
	for (let index = 0; index < entries; index += 1) {
		const entry = ifd + 2 + index * 12;
		if (entry + 12 > tiff.length) return undefined;
		if (view.getUint16(entry, little) === ORIENTATION_TAG) {
			const value = view.getUint16(entry + 8, little);
			return value >= 1 && value <= 8 ? value : undefined;
		}
	}
	return undefined;
}

function jpegFacts(bytes: Uint8Array): ImageContainerFacts {
	let orientation: number | undefined;
	let offset = 2;
	while (offset + 4 <= bytes.length) {
		if (bytes[offset] !== 0xff) break;
		const marker = bytes[offset + 1];
		if (marker === 0xda || marker === 0xd9) break;
		const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
		if (length < 2) break;
		if (marker === 0xe1 && ascii(bytes, offset + 4, 6) === 'Exif\0\0') {
			orientation = orientationFromTiff(bytes.subarray(offset + 10, offset + 2 + length));
			break;
		}
		offset += 2 + length;
	}
	return { orientation, pages: 1 };
}

function pngFacts(bytes: Uint8Array): ImageContainerFacts {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let orientation: number | undefined;
	let pages = 1;
	let offset = 8;
	while (offset + 8 <= bytes.length) {
		const length = view.getUint32(offset);
		const type = ascii(bytes, offset + 4, 4);
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		if (type === 'acTL' && data.length >= 4) {
			pages = new DataView(data.buffer, data.byteOffset).getUint32(0);
		}
		if (type === 'eXIf') orientation = orientationFromTiff(data);
		if (type === 'IDAT' || type === 'IEND') break;
		offset += 12 + length;
	}
	return { orientation, pages: Math.max(1, pages) };
}

function webpFacts(bytes: Uint8Array): ImageContainerFacts {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let orientation: number | undefined;
	let animated = false;
	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const type = ascii(bytes, offset, 4);
		const length = view.getUint32(offset + 4, true);
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		if (type === 'VP8X' && data.length >= 1 && (data[0] & 0x02) !== 0) animated = true;
		if (type === 'ANIM' || type === 'ANMF') animated = true;
		if (type === 'EXIF') {
			const tiff = ascii(data, 0, 4) === 'Exif' ? data.subarray(6) : data;
			orientation = orientationFromTiff(tiff);
		}
		offset += 8 + length + (length % 2);
	}
	return { orientation, pages: animated ? 2 : 1 };
}

/** Container facts for JPEG, PNG and WebP bytes; unknown containers report a still image. */
export function readImageContainerFacts(bytes: Uint8Array): ImageContainerFacts {
	try {
		if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegFacts(bytes);
		if (bytes.length > 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
			return pngFacts(bytes);
		}
		if (bytes.length > 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
			return webpFacts(bytes);
		}
	} catch {
		// A malformed container is judged by the decoder, not here.
	}
	return { pages: 1 };
}
