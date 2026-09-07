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
		semanticChanged?: boolean;
		semanticUnstable?: boolean;
		missing?: boolean;
	},
	threshold = 0.001,
): 'MATCH' | 'DIFFERENT' | 'UNSTABLE' | 'MISSING' {
	if (input.missing) return 'MISSING';
	if (input.semanticUnstable) return 'UNSTABLE';
	if ((input.productionNoise ?? 0) > threshold || (input.previewNoise ?? 0) > threshold)
		return 'UNSTABLE';
	if (input.sizeChanged || input.orderChanged || input.semanticChanged) return 'DIFFERENT';
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

/** Normalize only the owning deployment origin, preserving image transformations. */
export function normalizeCaptureImageSource(source: string, origin: string): string {
	if (!source.trim()) return '';
	const url = new URL(source, origin);
	if (url.origin !== new URL(origin).origin) return url.href;
	url.searchParams.sort();
	return `{deployment}${url.pathname}${url.search}${url.hash}`;
}

export function sectionSemanticSignature(section: {
	textHash: string;
	fonts: string[];
	images: CapturedImageIdentity[];
}): string {
	return JSON.stringify({
		text: section.textHash,
		fonts: section.fonts,
		images: sectionImageSignature(section.images),
	});
}

export interface CapturedImageIdentity {
	src: string;
	objectFit: string;
	objectPosition: string;
	deliveredSha256?: string;
	naturalWidth?: number;
	naturalHeight?: number;
	transformations?: string;
}

/** Preserve transform parameters separately from a byte-verified source locator. */
export function captureImageTransformations(source: string): string {
	if (!source || source.startsWith('data:')) return '';
	const url = new URL(
		source.replace('{deployment}', 'https://deployment.invalid'),
		'https://deployment.invalid',
	);
	if (['/_image', '/_vercel/image'].includes(url.pathname)) {
		url.searchParams.delete('url');
		url.searchParams.delete('href');
	}
	url.searchParams.sort();
	const cloudinaryTransform = url.hostname.endsWith('cloudinary.com')
		? (url.pathname
				.split('/upload/')[1]
				?.split('/')
				.filter((part) => /^(?:w_|h_|c_|q_|f_|g_|e_)/.test(part))
				.join('/') ?? '')
		: '';
	return cloudinaryTransform + url.search;
}

export function sectionImageSignature(images: CapturedImageIdentity[]): string {
	return JSON.stringify(
		images.map((image) => ({
			source: image.deliveredSha256 ? `sha256:${image.deliveredSha256}` : image.src,
			transformations: image.transformations ?? captureImageTransformations(image.src),
			width: image.naturalWidth,
			height: image.naturalHeight,
			fit: image.objectFit,
			position: image.objectPosition,
		})),
	);
}
