export function routeKey(eventType: string, slug: string): string {
	return `${eventType}/${slug}`;
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
