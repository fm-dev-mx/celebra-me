/**
 * Bounded byte inspection used to validate uploads: magic-byte signature per
 * allow-listed MIME type and MP4/QuickTime duration from the container header.
 */

function isJpegSignature(bytes: Uint8Array): boolean {
	return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPngSignature(bytes: Uint8Array): boolean {
	return (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	);
}

function isWebpSignature(bytes: Uint8Array): boolean {
	const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
	const isWebp =
		bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
	return isRiff && isWebp;
}

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'];

function isIsoBmffSignature(bytes: Uint8Array, normalizedMime: string): boolean {
	const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
	if (boxType === 'ftyp' || boxType === 'moov') {
		if (normalizedMime === 'image/heic' || normalizedMime === 'image/heif') {
			const brand = String.fromCharCode(
				bytes[8],
				bytes[9],
				bytes[10],
				bytes[11],
			).toLowerCase();
			return HEIC_BRANDS.some((candidate) => brand.startsWith(candidate));
		}
		return true;
	}
	if (normalizedMime === 'video/quicktime') {
		return boxType === 'wide' || boxType === 'free' || boxType === 'mdat';
	}
	return false;
}

/** Inspects the first bytes of an object against the declared allow-listed MIME type. */
export function isMediaSignatureValid(bytes: Uint8Array, mimeType: string): boolean {
	const normalized = mimeType.trim().toLowerCase();
	if (bytes.length < 12) return false;
	if (normalized === 'image/jpeg') return isJpegSignature(bytes);
	if (normalized === 'image/png') return isPngSignature(bytes);
	if (normalized === 'image/webp') return isWebpSignature(bytes);
	if (
		normalized === 'image/heic' ||
		normalized === 'image/heif' ||
		normalized === 'video/mp4' ||
		normalized === 'video/quicktime'
	) {
		return isIsoBmffSignature(bytes, normalized);
	}
	return false;
}

function parseMoovDuration(bytes: Uint8Array, moovOffset: number): number | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const moovLength = view.getUint32(moovOffset);
	if (moovLength < 8) return null;
	const moovEnd = Math.min(moovOffset + moovLength, bytes.length);
	for (let offset = moovOffset + 8; offset + 8 <= moovEnd;) {
		const boxLength = view.getUint32(offset);
		const boxType = String.fromCharCode(
			bytes[offset + 4],
			bytes[offset + 5],
			bytes[offset + 6],
			bytes[offset + 7],
		);
		if (boxLength < 8) return null;
		if (boxType === 'mvhd') {
			const version = view.getUint8(offset + 8);
			if (version === 0 && offset + 28 <= moovEnd) {
				const timescale = view.getUint32(offset + 20);
				const duration = view.getUint32(offset + 24);
				return timescale > 0 ? duration / timescale : null;
			}
			if (version === 1 && offset + 40 <= moovEnd) {
				const timescale = view.getUint32(offset + 28);
				const duration =
					view.getUint32(offset + 32) * 4294967296 + view.getUint32(offset + 36);
				return timescale > 0 ? duration / timescale : null;
			}
			return null;
		}
		offset += boxLength;
	}
	return null;
}

/** Extracts the duration from a bounded ISO BMFF buffer (head or tail range). */
export function parseBoundedVideoDurationSeconds(bytes: Uint8Array): number | null {
	if (bytes.length < 32) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	for (let offset = 0; offset + 8 <= bytes.length;) {
		const boxLength = view.getUint32(offset);
		if (boxLength < 8) break;
		if (
			bytes[offset + 4] === 0x6d &&
			bytes[offset + 5] === 0x6f &&
			bytes[offset + 6] === 0x6f &&
			bytes[offset + 7] === 0x76
		) {
			return parseMoovDuration(bytes, offset);
		}
		offset += boxLength;
	}
	// A tail range can begin in the middle of a preceding atom. Recover a complete
	// `moov` atom inside that bounded range without trusting the partial prefix.
	for (let typeOffset = 4; typeOffset + 4 <= bytes.length; typeOffset += 1) {
		if (
			bytes[typeOffset] === 0x6d &&
			bytes[typeOffset + 1] === 0x6f &&
			bytes[typeOffset + 2] === 0x6f &&
			bytes[typeOffset + 3] === 0x76
		) {
			const duration = parseMoovDuration(bytes, typeOffset - 4);
			if (duration !== null) return duration;
		}
	}
	return null;
}
