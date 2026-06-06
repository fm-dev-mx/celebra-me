import { isObject } from '@/lib/content-publication/_utils';

export type CanonicalJson =
	| null
	| string
	| number
	| boolean
	| CanonicalJson[]
	| { [key: string]: CanonicalJson };

export function normalizeForPublication(value: unknown): CanonicalJson {
	if (value === undefined) return null;
	if (value === null) return null;
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => normalizeForPublication(item));
	}
	if (isObject(value)) {
		const result: Record<string, CanonicalJson> = {};
		for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
			result[key] = normalizeForPublication(value[key]);
		}
		return result;
	}
	return String(value);
}

export function stableStringify(value: unknown): string {
	return JSON.stringify(normalizeForPublication(value));
}
