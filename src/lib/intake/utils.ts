export function str(value: unknown): string | undefined {
	if (typeof value === 'string' && value.length > 0) return value;
	return undefined;
}

export function strFallback(value: unknown): string {
	if (typeof value === 'string') return value;
	return '';
}

export function bool(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') return value;
	return undefined;
}

export function boolFallback(value: unknown): boolean {
	return typeof value === 'boolean' ? value : false;
}

export function num(value: unknown): number | undefined {
	if (typeof value === 'number') return value;
	return undefined;
}

export function numFallback(value: unknown): number {
	return typeof value === 'number' ? value : 0;
}

export function deepClone<T>(value: T): T {
	if (typeof structuredClone === 'function') return structuredClone(value);
	return JSON.parse(JSON.stringify(value));
}

export function deepMerge(
	base: Record<string, unknown>,
	overlay: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...base };
	for (const key of Object.keys(overlay)) {
		const baseVal = result[key];
		const overlayVal = overlay[key];
		if (
			baseVal !== null &&
			overlayVal !== null &&
			typeof baseVal === 'object' &&
			typeof overlayVal === 'object' &&
			!Array.isArray(baseVal) &&
			!Array.isArray(overlayVal)
		) {
			result[key] = deepMerge(
				baseVal as Record<string, unknown>,
				overlayVal as Record<string, unknown>,
			);
		} else {
			result[key] = overlayVal;
		}
	}
	return result;
}
