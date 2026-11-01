/** TikTok adds `ttclid` to ad landing URLs; it is kept with the lead like Meta's fbclid. */
const TTCLID_PATTERN = /^[A-Za-z0-9._-]{8,500}$/;

export function sanitizeTtclid(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return TTCLID_PATTERN.test(trimmed) ? trimmed : undefined;
}

/** The `ttclid` query parameter of a landing URL, when it looks valid. */
export function readTtclidFromUrl(url: string): string | undefined {
	try {
		return sanitizeTtclid(new URL(url).searchParams.get('ttclid'));
	} catch {
		return undefined;
	}
}
