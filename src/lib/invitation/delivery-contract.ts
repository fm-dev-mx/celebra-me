import {
	isCloudinaryDeliveryHostname,
	isMutableInPlaceMediaUrl,
} from '@/lib/assets/image-delivery-policy';
import { isR2InvitationMediaUrl } from '@/lib/intake/services/r2-invitation-media';

export type DeliveryResourceKind =
	'supabase-storage' | 'cloudinary' | 'r2-media' | 'astro-hashed' | 'other';

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
	supabaseStorageCount: number;
	cloudinaryCount: number;
	r2MediaCount: number;
	astroHashedCount: number;
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
 * Accepts both the source form (`s-maxage=0`) and an edge that omits that token.
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
	if (isMutableInPlaceMediaUrl(url)) return 'supabase-storage';
	if (isCloudinaryDeliveryHostname(url)) return 'cloudinary';
	if (isR2InvitationMediaUrl(url)) return 'r2-media';
	if (/\/_astro\//i.test(url)) return 'astro-hashed';
	return 'other';
}

function extractDocumentUrls(html: string): string[] {
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
	if (kind === 'supabase-storage' || kind === 'cloudinary' || kind === 'r2-media') {
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
			optimizedSource: null,
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

	return {
		urls,
		resources,
		uniqueUrlCount: counts.size,
		duplicateUrls,
		supabaseStorageCount: resources.filter((resource) => resource.kind === 'supabase-storage')
			.length,
		cloudinaryCount: resources.filter((resource) => resource.kind === 'cloudinary').length,
		r2MediaCount: resources.filter((resource) => resource.kind === 'r2-media').length,
		astroHashedCount: resources.filter((resource) => resource.kind === 'astro-hashed').length,
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
				(resource.kind === 'supabase-storage' ||
					resource.kind === 'cloudinary' ||
					resource.kind === 'r2-media'),
		) ??
		null
	);
}
