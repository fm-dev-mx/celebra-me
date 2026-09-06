import sharp from 'sharp';

export interface PixelComparison {
	ratio: number;
	changedPixels: number;
	width: number;
	height: number;
	sizeChanged: boolean;
	diff: Buffer;
	overlay: Buffer;
}

/** Pad instead of resizing: geometry differences must remain visible. */
export async function compareSectionImages(left: Buffer, right: Buffer): Promise<PixelComparison> {
	const [a, b] = await Promise.all([
		sharp(left).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
		sharp(right).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
	]);
	const width = Math.max(a.info.width, b.info.width);
	const height = Math.max(a.info.height, b.info.height);
	const diff = Buffer.alloc(width * height * 4);
	const overlay = Buffer.alloc(width * height * 4);
	let changedPixels = 0;
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const index = (y * width + x) * 4;
			const inA = x < a.info.width && y < a.info.height;
			const inB = x < b.info.width && y < b.info.height;
			const ai = (y * a.info.width + x) * 4;
			const bi = (y * b.info.width + x) * 4;
			let delta = 0;
			for (let channel = 0; channel < 3; channel++) {
				const av = inA ? a.data[ai + channel] : 255;
				const bv = inB ? b.data[bi + channel] : 255;
				delta = Math.max(delta, Math.abs(av - bv));
				overlay[index + channel] = Math.round((av + bv) / 2);
			}
			const changed = inA !== inB || delta > 24;
			if (changed) changedPixels++;
			diff[index] = changed ? 235 : 245;
			diff[index + 1] = changed ? 30 : 245;
			diff[index + 2] = changed ? 80 : 245;
			diff[index + 3] = overlay[index + 3] = 255;
		}
	const encode = (buffer: Buffer) =>
		sharp(buffer, { raw: { width, height, channels: 4 } })
			.png()
			.toBuffer();
	return {
		ratio: changedPixels / (width * height),
		changedPixels,
		width,
		height,
		sizeChanged: a.info.width !== b.info.width || a.info.height !== b.info.height,
		diff: await encode(diff),
		overlay: await encode(overlay),
	};
}

export function classifySectionDifference(
	input: {
		first: number;
		repeat?: number;
		productionNoise?: number;
		previewNoise?: number;
		sizeChanged?: boolean;
		orderChanged?: boolean;
		missing?: boolean;
	},
	threshold = 0.001,
): 'MATCH' | 'DIFFERENT' | 'UNSTABLE' | 'MISSING' {
	if (input.missing) return 'MISSING';
	if ((input.productionNoise ?? 0) > threshold || (input.previewNoise ?? 0) > threshold)
		return 'UNSTABLE';
	if (input.sizeChanged || input.orderChanged) return 'DIFFERENT';
	if (input.first <= threshold && (input.repeat ?? 0) <= threshold) return 'MATCH';
	return input.repeat === undefined || input.repeat <= threshold ? 'UNSTABLE' : 'DIFFERENT';
}

/** Every requested route/viewport must be accounted for, including failed captures. */
export function assertDiagnosisCoverage(expected: string[], observed: string[]): void {
	if (!expected.length || new Set(expected).size !== expected.length)
		throw new Error('Invalid expected diagnosis coverage.');
	if (new Set(observed).size !== observed.length) throw new Error('Duplicate diagnosis case.');
	if (expected.length !== observed.length || expected.some((key) => !observed.includes(key)))
		throw new Error('Incomplete or unexpected diagnosis coverage.');
}
