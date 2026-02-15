interface Bucket {
	count: number;
	resetAtMs: number;
}

const bucketStore = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxHits: number, windowMs: number): boolean {
	const now = Date.now();
	const current = bucketStore.get(key);

	if (!current || current.resetAtMs <= now) {
		bucketStore.set(key, { count: 1, resetAtMs: now + windowMs });
		return true;
	}

	if (current.count >= maxHits) return false;
	current.count += 1;
	bucketStore.set(key, current);
	return true;
}
