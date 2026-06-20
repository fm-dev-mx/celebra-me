import { isRecord } from '@/lib/shared/data-utils';

export type ParentsOrder = 'father-first' | 'mother-first';

export const DEFAULT_PARENTS_ORDER: ParentsOrder = 'mother-first';

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function memberLine(value: unknown): string | undefined {
	if (typeof value === 'string') return text(value);
	if (!isRecord(value)) return undefined;

	const name = text(value.name);
	if (!name) return undefined;

	const role = text(value.role);
	return role ? `${name} — ${role}` : name;
}

export function formatFamilyMembersAsLines(value: unknown): string | undefined {
	if (typeof value === 'string') return text(value);
	if (Array.isArray(value)) {
		const lines = value.map(memberLine).filter((line): line is string => Boolean(line));
		return lines.length > 0 ? lines.join('\n') : undefined;
	}
	return memberLine(value);
}
