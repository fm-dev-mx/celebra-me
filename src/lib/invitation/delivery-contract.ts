import {
	isCloudinaryDeliveryHostname,
	isMutableInPlaceMediaUrl,
} from '@/lib/assets/vercel-image-policy';

export type DeliveryResourceKind =
	'vercel-image' | 'supabase-storage' | 'cloudinary' | 'astro-hashed' | 'other';

export interface DeliveryResource {
	url: string;
	kind: DeliveryResourceKind;
	optimizedSource: string | null;
	lazy: boolean;
	highPriority: boolean;
}

export interface InvitationHtmlInventory {
	urls: string[];
	resources: DeliveryResource[];
	uniqueUrlCount: number;
	duplicateUrls: string[];
	vercelImageCount: number;
	supabaseStorageCount: number;
	cloudinaryCount: number;
	astroHashedCount: number;
	mutableStorageThroughVercelImage: string[];
	eagerImageCount: number;
	lazyImageCount: number;
	highPriorityImageCount: number;
}

/**
 * Persistence-layer counts for a published anonymous invitation and a
 * personalized lookup. Route-layer service call counts are 1 context lookup
 * (or 0 when the invite id is empty). See performance-metrics.md.
 */
export const ANONYMOUS_PUBLISHED_CONTENT_READS = 1;
export const PERSONALIZED_GUEST_CONTEXT_READS_ON_HIT = 2;
export const PERSONALIZED_GUEST_CONTEXT_READS_ON_MISS = 1;
export const PERSONALIZED_VIEW_TRACK_WRITES_ON_HIT = 1;
export const PERSONALIZED_CONTEXT_SERVICE_CALLS_ON_LOOKUP = 1;

export function assertObservedOperationCount(
	observed: number,
	expected: number,
	label: string,
): void {
	if (observed !== expected) {
		throw new Error(`${label}: observed ${observed} operations, expected ${expected}`);
	}
}

/** Canonical HTML budget unit: UTF-8 byte length of the decoded document body. */
export function decodedHtmlUtf8ByteLength(html: string): number {
	return Buffer.byteLength(html, 'utf8');
}

const POSITIVE_S_MAXAGE = /(?:^|,)\s*s-maxage\s*=\s*([1-9]\d*)\b/i;
const MAX_AGE_ZERO = /(?:^|,)\s*max-age\s*=\s*0\b/i;

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>');
}

function parseDirectiveNumber(cacheControl: string, name: string): number | null {
	const match = cacheControl.match(new RegExp(`(?:^|,)\\s*${name}\\s*=\\s*(\\d+)\\b`, 'i'));
	if (!match) return null;
	return Number.parseInt(match[1], 10);
}

export function hasPositiveSharedCacheTtl(cacheControl: string): boolean {
	return POSITIVE_S_MAXAGE.test(cacheControl);
}

export function isPrivateNoStoreCacheContract(cacheControl: string): boolean {
	const cc = cacheControl.toLowerCase();
	if (!cc.includes('no-store') || !cc.includes('private')) return false;
	if (cc.includes('public')) return false;
	if (hasPositiveSharedCacheTtl(cc)) return false;
	if (cc.includes('stale-while-revalidate')) return false;
	return true;
}

/**
 * Effective anonymous invitation document policy: origin revalidate, no shared TTL.
 * Accepts both the source form (`s-maxage=0`) and Vercel's omission of that token.
 */
export function isOriginRevalidatePublicDocument(cacheControl: string): boolean {
	const cc = cacheControl.toLowerCase();
	if (!cc.includes('public')) return false;
	if (cc.includes('no-store') || cc.includes('private')) return false;
	if (cc.includes('stale-while-revalidate')) return false;
	if (!MAX_AGE_ZERO.test(cc)) return false;
	const shared = parseDirectiveNumber(cc, 's-maxage');
	if (shared !== null && shared > 0) return false;
	return true;
}

export function classifyDeliveryUrl(rawUrl: string): DeliveryResourceKind {
	const url = rawUrl.trim();
	if (!url || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('#')) {
		return 'other';
	}
	if (/\/_vercel\/image(?:\?|$)/i.test(url)) return 'vercel-image';
	if (isMutableInPlaceMediaUrl(url)) return 'supabase-storage';
	if (isCloudinaryDeliveryHostname(url)) return 'cloudinary';
	if (/\/_astro\//i.test(url)) return 'astro-hashed';
	return 'other';
}

export function vercelImageSourceUrl(rawUrl: string): string | null {
	const decoded = decodeHtmlEntities(rawUrl.trim());
	try {
		const parsed = decoded.includes('://')
			? new URL(decoded)
			: new URL(decoded, 'https://www.celebra-me.com');
		if (!parsed.pathname.includes('/_vercel/image')) return null;
		const inner = parsed.searchParams.get('url');
		return inner ? decodeURIComponent(inner) : null;
	} catch {
		return null;
	}
}

export function extractDocumentUrls(html: string): string[] {
	const urls: string[] = [];
	for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
		urls.push(decodeHtmlEntities(match[1]));
	}
	for (const match of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
		for (const candidate of match[1].split(',')) {
			const url = decodeHtmlEntities(candidate.trim().split(/\s+/)[0] ?? '');
			if (url) urls.push(url);
		}
	}
	return urls.filter((url) => url.length > 0 && !url.startsWith('#') && !url.startsWith('data:'));
}

function isImageLikeUrl(url: string, kind: DeliveryResourceKind): boolean {
	if (kind === 'vercel-image' || kind === 'supabase-storage' || kind === 'cloudinary') {
		return true;
	}
	return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(url);
}

export function inventoryInvitationHtml(html: string): InvitationHtmlInventory {
	const urls = extractDocumentUrls(html);
	const resources: DeliveryResource[] = urls.map((url) => {
		const kind = classifyDeliveryUrl(url);
		return {
			url,
			kind,
			optimizedSource: kind === 'vercel-image' ? vercelImageSourceUrl(url) : null,
			lazy: false,
			highPriority: false,
		};
	});

	const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
	let eagerImageCount = 0;
	let lazyImageCount = 0;
	let highPriorityImageCount = 0;
	for (const tag of imgTags) {
		const loading = /\bloading=["']lazy["']/i.test(tag) ? 'lazy' : 'eager';
		if (loading === 'lazy') lazyImageCount += 1;
		else eagerImageCount += 1;
		if (/\bfetchpriority=["']high["']/i.test(tag)) highPriorityImageCount += 1;
		const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
		if (!srcMatch) continue;
		const src = decodeHtmlEntities(srcMatch[1]);
		const resource = resources.find(
			(entry) => entry.url === src && isImageLikeUrl(src, entry.kind),
		);
		if (resource) {
			resource.lazy = loading === 'lazy';
			resource.highPriority = /\bfetchpriority=["']high["']/i.test(tag);
		}
	}

	const counts = new Map<string, number>();
	for (const url of urls) {
		counts.set(url, (counts.get(url) ?? 0) + 1);
	}
	const duplicateUrls = [...counts.entries()]
		.filter(([, count]) => count > 1)
		.map(([url]) => url);

	const mutableStorageThroughVercelImage = resources
		.filter(
			(resource) =>
				resource.kind === 'vercel-image' &&
				resource.optimizedSource !== null &&
				isMutableInPlaceMediaUrl(resource.optimizedSource),
		)
		.map((resource) => resource.optimizedSource as string);

	return {
		urls,
		resources,
		uniqueUrlCount: counts.size,
		duplicateUrls,
		vercelImageCount: resources.filter((resource) => resource.kind === 'vercel-image').length,
		supabaseStorageCount: resources.filter((resource) => resource.kind === 'supabase-storage')
			.length,
		cloudinaryCount: resources.filter((resource) => resource.kind === 'cloudinary').length,
		astroHashedCount: resources.filter((resource) => resource.kind === 'astro-hashed').length,
		mutableStorageThroughVercelImage,
		eagerImageCount,
		lazyImageCount,
		highPriorityImageCount,
	};
}

export function selectHeroResource(inventory: InvitationHtmlInventory): DeliveryResource | null {
	return (
		inventory.resources.find((resource) => resource.highPriority) ??
		inventory.resources.find(
			(resource) =>
				!resource.lazy &&
				(resource.kind === 'vercel-image' ||
					resource.kind === 'supabase-storage' ||
					resource.kind === 'cloudinary'),
		) ??
		null
	);
}
