/**
 * Shared helpers for Romina production mutation planners (schema-repair, draft-reset).
 */
import { canonicalize } from './normalized-invitation-release.ts';

type JsonRecord = Record<string, unknown>;

export function diffContentPaths(before: unknown, after: unknown, path = ''): string[] {
	if (canonicalize(before) === canonicalize(after)) return [];
	if (Array.isArray(before) && Array.isArray(after)) {
		const paths: string[] = [];
		const length = Math.max(before.length, after.length);
		for (let index = 0; index < length; index++) {
			paths.push(...diffContentPaths(before[index], after[index], `${path}[${index}]`));
		}
		return paths;
	}
	if (
		before &&
		after &&
		typeof before === 'object' &&
		typeof after === 'object' &&
		!Array.isArray(before) &&
		!Array.isArray(after)
	) {
		const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
		const paths: string[] = [];
		for (const key of [...keys].sort()) {
			paths.push(
				...diffContentPaths(
					(before as JsonRecord)[key],
					(after as JsonRecord)[key],
					path ? `${path}.${key}` : key,
				),
			);
		}
		return paths;
	}
	return [path || '$'];
}

export function deriveRominaReceiptOperationId(operationId: string): string {
	if (!/^[a-f0-9]{64}$/i.test(operationId)) {
		throw new Error('ROMINA_RECEIPT_OPERATION_ID_INVALID: expected a SHA-256 operation ID.');
	}
	const hex = operationId.slice(0, 32).toLowerCase().split('');
	hex[12] = '8';
	hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16]!, 16) % 4]!;
	return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex
		.slice(12, 16)
		.join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}
