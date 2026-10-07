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

type IsoBoxHeader = { type: string; size: number | null };

/** Reads one top-level box header; `size` is null when the box runs to the end of the file. */
function readIsoBoxHeader(bytes: Uint8Array, offset: number): IsoBoxHeader | null {
	if (offset < 0 || offset + 8 > bytes.length) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const size = view.getUint32(offset);
	const type = String.fromCharCode(
		bytes[offset + 4],
		bytes[offset + 5],
		bytes[offset + 6],
		bytes[offset + 7],
	);
	if (size === 0) return { type, size: null };
	if (size === 1) {
		if (offset + 16 > bytes.length) return null;
		const largeSize = view.getUint32(offset + 8) * 4294967296 + view.getUint32(offset + 12);
		return largeSize >= 16 && Number.isSafeInteger(largeSize)
			? { type, size: largeSize }
			: null;
	}
	return size >= 8 ? { type, size } : null;
}

/** Ranged reads the walk may spend before giving up on a malformed or unusual container. */
const MAX_BOX_WALK_READS = 6;
const LARGE_BOX_HEADER_BYTES = 16;

type ReadObjectRange = (offset: number, length: number) => Promise<Uint8Array | null>;

/**
 * Follows the top-level boxes of an MP4/QuickTime object to its `moov` atom.
 * Phone cameras write `moov` after the media data and its sample tables can
 * outgrow any fixed tail window, so the walk jumps box by box with ranged reads.
 */
export async function locateVideoDurationSeconds(input: {
	head: Uint8Array;
	objectSize: number;
	windowBytes: number;
	readRange: ReadObjectRange;
}): Promise<number | null> {
	let window = input.head;
	let windowStart = 0;
	let position = 0;
	let reads = 0;
	const loadWindowAtPosition = async (): Promise<boolean> => {
		if (reads >= MAX_BOX_WALK_READS) return false;
		reads += 1;
		const length = Math.min(input.windowBytes, input.objectSize - position);
		const next = await input.readRange(position, length);
		if (!next || next.length === 0) return false;
		window = next;
		windowStart = position;
		return true;
	};
	while (position < input.objectSize) {
		const headerBytes = Math.min(LARGE_BOX_HEADER_BYTES, input.objectSize - position);
		const windowEnd = windowStart + window.length;
		if (position < windowStart || position + headerBytes > windowEnd) {
			if (!(await loadWindowAtPosition())) return null;
		}
		const header = readIsoBoxHeader(window, position - windowStart);
		if (!header) return null;
		if (header.type === 'moov') {
			const wanted = Math.min(
				header.size ?? input.windowBytes,
				input.windowBytes,
				input.objectSize - position,
			);
			if (windowStart !== position && windowStart + window.length < position + wanted) {
				if (!(await loadWindowAtPosition())) return null;
			}
			return parseMoovDuration(window, position - windowStart);
		}
		if (header.size === null) return null;
		position += header.size;
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
