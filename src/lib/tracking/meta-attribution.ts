import { classifyTrackingRoute } from '@/lib/tracking/route-policy';

export interface MetaAttribution {
	fbp?: string;
	fbc?: string;
	fbclid?: string;
}

const FBP_PATTERN = /^fb\.1\.\d{10,17}\.[A-Za-z0-9._-]{1,120}$/;
const FBC_PATTERN = /^fb\.1\.\d{10,17}\.[A-Za-z0-9._-]{1,240}$/;
const FBCLID_PATTERN = /^[A-Za-z0-9._-]{8,240}$/;

function hasValues(input: MetaAttribution): boolean {
	return Boolean(input.fbp || input.fbc || input.fbclid);
}

function readStringField(input: unknown, key: keyof MetaAttribution): string | undefined {
	if (!input || typeof input !== 'object') return undefined;
	const value = (input as Record<string, unknown>)[key];
	return typeof value === 'string' ? value.trim() : undefined;
}

function readCookie(cookieHeader: string, name: string): string | undefined {
	const cookie = cookieHeader
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${name}=`));
	if (!cookie) return undefined;

	const value = cookie.slice(name.length + 1);
	try {
		return decodeURIComponent(value).trim();
	} catch {
		return value.trim();
	}
}

export function sanitizeMetaAttribution(input: unknown): MetaAttribution {
	const fbp = readStringField(input, 'fbp');
	const fbc = readStringField(input, 'fbc');
	const fbclid = readStringField(input, 'fbclid');
	const sanitized: MetaAttribution = {};

	if (fbp && FBP_PATTERN.test(fbp)) sanitized.fbp = fbp;
	if (fbc && FBC_PATTERN.test(fbc)) sanitized.fbc = fbc;
	if (fbclid && FBCLID_PATTERN.test(fbclid)) sanitized.fbclid = fbclid;

	return sanitized;
}

export function buildFbcFromFbclid(
	fbclid: string | undefined,
	now = Date.now(),
): string | undefined {
	const sanitized = sanitizeMetaAttribution({ fbclid }).fbclid;
	if (!sanitized) return undefined;
	return `fb.1.${now}.${sanitized}`;
}

export function createMetaAttributionSnapshot(input: {
	url: URL;
	cookie: string;
	now?: number;
}): MetaAttribution {
	const routePolicy = classifyTrackingRoute(input.url);
	if (!routePolicy.metaAllowed) return {};

	const fbclid = input.url.searchParams.get('fbclid') ?? undefined;
	const fbcCookie = readCookie(input.cookie, '_fbc');
	const fbc = fbcCookie || buildFbcFromFbclid(fbclid, input.now);
	const snapshot = sanitizeMetaAttribution({
		fbp: readCookie(input.cookie, '_fbp'),
		fbc,
		fbclid,
	});

	return hasValues(snapshot) ? snapshot : {};
}

export function metaAttributionOrUndefined(input: MetaAttribution): MetaAttribution | undefined {
	return hasValues(input) ? input : undefined;
}
