/**
 * Block-shift explanation for a failing band: aligns raster rows to tell "content moved" apart
 * from "content changed". Used only for review triage; it never changes a gate verdict.
 *
 * Rows are hashed after dropping the three low bits of every channel, anchored on rows that are
 * unique in both images (patience diff) and aligned with an LCS inside the remaining gaps. Every
 * aligned or replaced row pair is then verified with the gate's YIQ threshold, so sub-threshold
 * noise is never reported as a change and hash collisions never hide one.
 */
import sharp from 'sharp';
import { isVisiblePixelChange } from './visual-yiq.ts';

export interface RgbaImage {
	data: Uint8Array;
	width: number;
	height: number;
}

export interface RowRange {
	/** First row of the range in its own image. */
	y: number;
	height: number;
}

export type RowAlignmentClass = 'IDENTICAL' | 'SHIFT_ONLY' | 'CONTENT_CHANGE' | 'MIXED';

export interface RowAlignment {
	classification: RowAlignmentClass;
	heightDelta: number;
	/** Rows of the actual image without a counterpart in the expected image. */
	inserted: RowRange[];
	/** Rows of the expected image without a counterpart in the actual image. */
	removed: RowRange[];
	/** Actual-image rows whose aligned expected row differs visibly. */
	changedRows: number;
	changedBox?: { top: number; bottom: number };
}

/** Largest gap (rows × rows) aligned with a full LCS table; larger gaps align by position. */
const LCS_CELL_LIMIT = 4_000_000;

function rowSignatures(image: RgbaImage): Uint32Array {
	const stride = image.width * 4;
	const signatures = new Uint32Array(image.height);
	for (let row = 0; row < image.height; row++) {
		let hash = 0x811c9dc5;
		const start = row * stride;
		for (let offset = start; offset < start + stride; offset++) {
			hash ^= image.data[offset] >> 3;
			hash = Math.imul(hash, 0x01000193);
		}
		signatures[row] = hash >>> 0;
	}
	return signatures;
}

/** Longest increasing subsequence of `b` positions, returning the kept pair indexes. */
function longestIncreasing(pairs: Array<[number, number]>): Array<[number, number]> {
	const tails: number[] = [];
	const previous = new Int32Array(pairs.length).fill(-1);
	for (let index = 0; index < pairs.length; index++) {
		let low = 0;
		let high = tails.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (pairs[tails[middle]][1] < pairs[index][1]) low = middle + 1;
			else high = middle;
		}
		if (low > 0) previous[index] = tails[low - 1];
		tails[low] = index;
	}
	const result: Array<[number, number]> = [];
	for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index]) {
		result.push(pairs[index]);
	}
	return result.reverse();
}

function lcsPairs(
	a: Uint32Array,
	aStart: number,
	aEnd: number,
	b: Uint32Array,
	bStart: number,
	bEnd: number,
): Array<[number, number]> {
	const rows = aEnd - aStart;
	const columns = bEnd - bStart;
	if (rows === 0 || columns === 0 || rows * columns > LCS_CELL_LIMIT) return [];
	const width = columns + 1;
	const table = new Int32Array((rows + 1) * width);
	for (let i = rows - 1; i >= 0; i--) {
		for (let j = columns - 1; j >= 0; j--) {
			table[i * width + j] =
				a[aStart + i] === b[bStart + j]
					? table[(i + 1) * width + j + 1] + 1
					: Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
		}
	}
	const pairs: Array<[number, number]> = [];
	let i = 0;
	let j = 0;
	while (i < rows && j < columns) {
		if (a[aStart + i] === b[bStart + j]) {
			pairs.push([aStart + i, bStart + j]);
			i++;
			j++;
		} else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i++;
		else j++;
	}
	return pairs;
}

function matchRows(a: Uint32Array, b: Uint32Array): Array<[number, number]> {
	const matched: Array<[number, number]> = [];
	const pending: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
	while (pending.length) {
		let [aStart, aEnd, bStart, bEnd] = pending.pop()!;
		while (aStart < aEnd && bStart < bEnd && a[aStart] === b[bStart]) {
			matched.push([aStart++, bStart++]);
		}
		while (aStart < aEnd && bStart < bEnd && a[aEnd - 1] === b[bEnd - 1]) {
			matched.push([--aEnd, --bEnd]);
		}
		if (aStart === aEnd || bStart === bEnd) continue;
		const counts = new Map<number, [number, number, number]>();
		for (let index = aStart; index < aEnd; index++) {
			const entry = counts.get(a[index]) ?? [0, 0, -1];
			entry[0]++;
			entry[2] = index;
			counts.set(a[index], entry);
		}
		const unique: Array<[number, number]> = [];
		for (let index = bStart; index < bEnd; index++) {
			const entry = counts.get(b[index]);
			if (entry) entry[1]++;
		}
		for (let index = bStart; index < bEnd; index++) {
			const entry = counts.get(b[index]);
			if (entry && entry[0] === 1 && entry[1] === 1) unique.push([entry[2], index]);
		}
		unique.sort((left, right) => left[0] - right[0]);
		const anchors = longestIncreasing(unique);
		if (!anchors.length) {
			matched.push(...lcsPairs(a, aStart, aEnd, b, bStart, bEnd));
			continue;
		}
		let previousA = aStart;
		let previousB = bStart;
		for (const [anchorA, anchorB] of anchors) {
			matched.push([anchorA, anchorB]);
			pending.push([previousA, anchorA, previousB, anchorB]);
			previousA = anchorA + 1;
			previousB = anchorB + 1;
		}
		pending.push([previousA, aEnd, previousB, bEnd]);
	}
	return matched.sort((left, right) => left[0] - right[0]);
}

function rowsDiffer(
	expected: RgbaImage,
	expectedRow: number,
	actual: RgbaImage,
	actualRow: number,
) {
	const stride = expected.width * 4;
	const expectedStart = expectedRow * stride;
	const actualStart = actualRow * stride;
	for (let offset = 0; offset < stride; offset += 4) {
		if (
			isVisiblePixelChange(
				expected.data,
				expectedStart + offset,
				actual.data,
				actualStart + offset,
			)
		)
			return true;
	}
	return false;
}

function pushRange(ranges: RowRange[], y: number, height: number): void {
	if (height <= 0) return;
	const last = ranges.at(-1);
	if (last && last.y + last.height === y) last.height += height;
	else ranges.push({ y, height });
}

export function alignRows(expected: RgbaImage, actual: RgbaImage): RowAlignment {
	if (expected.width !== actual.width) {
		throw new Error(
			`Row alignment requires equal widths (${expected.width} vs ${actual.width}).`,
		);
	}
	const pairs = matchRows(rowSignatures(expected), rowSignatures(actual));
	const inserted: RowRange[] = [];
	const removed: RowRange[] = [];
	let changedRows = 0;
	let top = Infinity;
	let bottom = -Infinity;
	const markChanged = (actualRow: number) => {
		changedRows++;
		top = Math.min(top, actualRow);
		bottom = Math.max(bottom, actualRow + 1);
	};
	let nextExpected = 0;
	let nextActual = 0;
	const settleGap = (expectedEnd: number, actualEnd: number) => {
		// Rows between two alignments are compared by position first (a replacement); the
		// remainder is a pure insertion or removal.
		const replaced = Math.min(expectedEnd - nextExpected, actualEnd - nextActual);
		for (let offset = 0; offset < replaced; offset++) {
			if (rowsDiffer(expected, nextExpected + offset, actual, nextActual + offset)) {
				markChanged(nextActual + offset);
			}
		}
		pushRange(removed, nextExpected + replaced, expectedEnd - nextExpected - replaced);
		pushRange(inserted, nextActual + replaced, actualEnd - nextActual - replaced);
	};
	for (const [expectedRow, actualRow] of pairs) {
		settleGap(expectedRow, actualRow);
		if (rowsDiffer(expected, expectedRow, actual, actualRow)) markChanged(actualRow);
		nextExpected = expectedRow + 1;
		nextActual = actualRow + 1;
	}
	settleGap(expected.height, actual.height);
	const shifted = inserted.length > 0 || removed.length > 0;
	const classification: RowAlignmentClass =
		shifted && changedRows
			? 'MIXED'
			: shifted
				? 'SHIFT_ONLY'
				: changedRows
					? 'CONTENT_CHANGE'
					: 'IDENTICAL';
	return {
		classification,
		heightDelta: actual.height - expected.height,
		inserted,
		removed,
		changedRows,
		...(changedRows ? { changedBox: { top, bottom } } : {}),
	};
}

async function decode(png: Buffer): Promise<RgbaImage> {
	const { data, info } = await sharp(png)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data, width: info.width, height: info.height };
}

export async function alignPngRows(expected: Buffer, actual: Buffer): Promise<RowAlignment> {
	const [expectedImage, actualImage] = await Promise.all([decode(expected), decode(actual)]);
	return alignRows(expectedImage, actualImage);
}
