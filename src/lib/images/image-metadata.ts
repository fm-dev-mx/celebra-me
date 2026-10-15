/**
 * Writes provenance metadata (EXIF IFD0 text tags and an XMP packet) into encoded JPEG and
 * WebP bytes. The Cloudflare Images binding drops all metadata on output and cannot write
 * any, so the container is patched here without touching pixel data. Pure, no I/O.
 */

export interface ProvenanceMetadata {
	/** EXIF IFD0 text tags. */
	exif: { artist: string; copyright: string; description: string };
	/** Complete XMP packet as XML text. */
	xmp: string;
}

const encoder = new TextEncoder();
const EXIF_APP1_PREFIX = encoder.encode('Exif\0\0');
const XMP_APP1_PREFIX = encoder.encode('http://ns.adobe.com/xap/1.0/\0');
const TIFF_ASCII = 2;

function concat(parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
	let text = '';
	for (let index = offset; index < offset + length && index < bytes.length; index += 1) {
		text += String.fromCharCode(bytes[index]);
	}
	return text;
}

/** Little-endian TIFF block with three ASCII tags in IFD0, sorted by tag number. */
function buildExifTiff(exif: ProvenanceMetadata['exif']): Uint8Array {
	const tags: Array<[number, Uint8Array]> = [
		[0x010e, encoder.encode(exif.description)],
		[0x013b, encoder.encode(exif.artist)],
		[0x8298, encoder.encode(exif.copyright)],
	];
	const ifdSize = 2 + tags.length * 12 + 4;
	let dataOffset = 8 + ifdSize;
	const header = new Uint8Array(8 + ifdSize);
	const view = new DataView(header.buffer);
	header.set(encoder.encode('II'), 0);
	view.setUint16(2, 42, true);
	view.setUint32(4, 8, true);
	view.setUint16(8, tags.length, true);
	const values: Uint8Array[] = [];
	tags.forEach(([tag, text], index) => {
		const entry = 10 + index * 12;
		const value = new Uint8Array(text.length + 1);
		value.set(text);
		view.setUint16(entry, tag, true);
		view.setUint16(entry + 2, TIFF_ASCII, true);
		view.setUint32(entry + 4, value.length, true);
		if (value.length <= 4) {
			header.set(value, entry + 8);
		} else {
			view.setUint32(entry + 8, dataOffset, true);
			values.push(value);
			dataOffset += value.length;
			// Values start on even offsets.
			if (value.length % 2) {
				values.push(new Uint8Array(1));
				dataOffset += 1;
			}
		}
	});
	return concat([header, ...values]);
}

function jpegSegment(prefix: Uint8Array, payload: Uint8Array): Uint8Array {
	const length = 2 + prefix.length + payload.length;
	if (length > 0xffff) throw new Error('Metadata does not fit one JPEG segment.');
	const head = new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff]);
	return concat([head, prefix, payload]);
}

function embedInJpeg(bytes: Uint8Array, metadata: ProvenanceMetadata): Uint8Array {
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG.');
	const kept: Uint8Array[] = [];
	let offset = 2;
	// Drop metadata segments the encoder wrote; keep every other header segment and the scan.
	while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
		const marker = bytes[offset + 1];
		if (marker === 0xda) break;
		const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
		const isMetadata =
			marker === 0xe1 &&
			(ascii(bytes, offset + 4, 6) === 'Exif\0\0' ||
				ascii(bytes, offset + 4, 28) === 'http://ns.adobe.com/xap/1.0/');
		if (!isMetadata) kept.push(bytes.subarray(offset, offset + 2 + length));
		offset += 2 + length;
	}
	const leading = kept.filter((segment) => segment[1] === 0xe0);
	const others = kept.filter((segment) => segment[1] !== 0xe0);
	return concat([
		bytes.subarray(0, 2),
		...leading,
		jpegSegment(EXIF_APP1_PREFIX, buildExifTiff(metadata.exif)),
		jpegSegment(XMP_APP1_PREFIX, encoder.encode(metadata.xmp)),
		...others,
		bytes.subarray(offset),
	]);
}

function riffChunk(type: string, data: Uint8Array): Uint8Array {
	const padded = data.length % 2 ? 1 : 0;
	const out = new Uint8Array(8 + data.length + padded);
	out.set(encoder.encode(type), 0);
	new DataView(out.buffer).setUint32(4, data.length, true);
	out.set(data, 8);
	return out;
}

/** Canvas size and alpha flag of a simple (non-VP8X) WebP image chunk. */
function simpleWebpCanvas(
	type: string,
	data: Uint8Array,
): { width: number; height: number; alpha: boolean } {
	if (type === 'VP8 ') {
		if (data.length < 10 || data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) {
			throw new Error('Unreadable VP8 frame header.');
		}
		return {
			width: (data[6] | (data[7] << 8)) & 0x3fff,
			height: (data[8] | (data[9] << 8)) & 0x3fff,
			alpha: false,
		};
	}
	if (type === 'VP8L') {
		if (data.length < 5 || data[0] !== 0x2f) throw new Error('Unreadable VP8L header.');
		const bits = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);
		return {
			width: (bits & 0x3fff) + 1,
			height: ((bits >>> 14) & 0x3fff) + 1,
			alpha: ((bits >>> 28) & 1) === 1,
		};
	}
	throw new Error('Unsupported WebP layout.');
}

function embedInWebp(bytes: Uint8Array, metadata: ProvenanceMetadata): Uint8Array {
	if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
		throw new Error('Not a WebP.');
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const chunks: Array<{ type: string; raw: Uint8Array; data: Uint8Array }> = [];
	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const type = ascii(bytes, offset, 4);
		const length = view.getUint32(offset + 4, true);
		const end = offset + 8 + length + (length % 2);
		chunks.push({
			type,
			raw: bytes.subarray(offset, Math.min(end, bytes.length)),
			data: bytes.subarray(offset + 8, offset + 8 + length),
		});
		offset = end;
	}
	const [first] = chunks;
	if (!first) throw new Error('Empty WebP.');
	const body = chunks.filter((chunk) => chunk.type !== 'EXIF' && chunk.type !== 'XMP ');
	let head: Uint8Array;
	if (first.type === 'VP8X') {
		const vp8x = Uint8Array.from(first.data);
		vp8x[0] |= 0x08 | 0x04;
		head = riffChunk('VP8X', vp8x);
		body.shift();
	} else {
		const canvas = simpleWebpCanvas(first.type, first.data);
		const vp8x = new Uint8Array(10);
		vp8x[0] = 0x08 | 0x04 | (canvas.alpha ? 0x10 : 0);
		const w = canvas.width - 1;
		const h = canvas.height - 1;
		vp8x.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 4);
		vp8x.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 7);
		head = riffChunk('VP8X', vp8x);
	}
	const payload = concat([
		encoder.encode('WEBP'),
		head,
		...body.map((chunk) => chunk.raw),
		riffChunk('EXIF', buildExifTiff(metadata.exif)),
		riffChunk('XMP ', encoder.encode(metadata.xmp)),
	]);
	const out = new Uint8Array(8 + payload.length);
	out.set(encoder.encode('RIFF'), 0);
	new DataView(out.buffer).setUint32(4, payload.length, true);
	out.set(payload, 8);
	return out;
}

/** Returns a copy of the encoded image carrying the given EXIF and XMP metadata. */
export function embedProvenanceMetadata(
	bytes: Uint8Array,
	format: 'jpeg' | 'webp',
	metadata: ProvenanceMetadata,
): Uint8Array {
	return format === 'jpeg' ? embedInJpeg(bytes, metadata) : embedInWebp(bytes, metadata);
}
