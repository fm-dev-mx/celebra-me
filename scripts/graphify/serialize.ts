function compareText(a: unknown, b: unknown): number {
	return String(a).localeCompare(String(b));
}

function sortJsonValue(value: unknown): unknown {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const obj = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.entries(obj)
				.sort(([a], [b]) => compareText(a, b))
				.map(([key, item]) => [key, sortJsonValue(item)]),
		);
	}
	return value;
}

export function serializeStableJson(value: unknown): string {
	return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}
