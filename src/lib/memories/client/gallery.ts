/**
 * Pure helpers for the memories galleries: day grouping in the event time zone
 * and the capacity meter level. Shared by the host dashboard and the guest page.
 */

/** Remaining share at or below which the host is advised to download. */
export const MEMORIES_NEAR_FULL_REMAINING_PERCENT = 20;

export type MemoriesCapacityLevel = 'normal' | 'near-full' | 'full';

export function memoriesCapacityUsedPercent(remainingPercent: number): number {
	const remaining = Math.min(100, Math.max(0, Math.round(remainingPercent)));
	return 100 - remaining;
}

export function memoriesCapacityLevel(remainingPercent: number): MemoriesCapacityLevel {
	if (remainingPercent <= 0) return 'full';
	if (remainingPercent <= MEMORIES_NEAR_FULL_REMAINING_PERCENT) return 'near-full';
	return 'normal';
}

export interface MemoriesDayGroup<T> {
	/** `YYYY-MM-DD` in the event time zone. */
	key: string;
	label: string;
	items: T[];
}

function dayKey(iso: string, timeZone: string): string {
	try {
		// en-CA formats as YYYY-MM-DD.
		return new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date(iso));
	} catch {
		return iso.slice(0, 10);
	}
}

function dayLabel(iso: string, timeZone: string): string {
	try {
		const label = new Intl.DateTimeFormat('es-MX', {
			timeZone,
			weekday: 'long',
			day: 'numeric',
			month: 'long',
		}).format(new Date(iso));
		return label.charAt(0).toUpperCase() + label.slice(1);
	} catch {
		return iso.slice(0, 10);
	}
}

/** Groups items by local upload day, keeping the incoming order inside each day. */
export function groupMemoriesByDay<T extends { createdAt: string }>(
	items: readonly T[],
	timeZone: string,
): MemoriesDayGroup<T>[] {
	const groups: MemoriesDayGroup<T>[] = [];
	const byKey = new Map<string, MemoriesDayGroup<T>>();
	for (const item of items) {
		const key = dayKey(item.createdAt, timeZone);
		let group = byKey.get(key);
		if (!group) {
			group = { key, label: dayLabel(item.createdAt, timeZone), items: [] };
			byKey.set(key, group);
			groups.push(group);
		}
		group.items.push(item);
	}
	return groups;
}

/** Compact local date for tight layouts, e.g. «3 oct 2026». */
export function formatMemoriesShortDate(iso: string, timeZone: string): string {
	try {
		return new Intl.DateTimeFormat('es-MX', {
			timeZone,
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		})
			.format(new Date(iso))
			.replace(/\./g, '');
	} catch {
		return iso.slice(0, 10);
	}
}

export function formatMemoriesTime(iso: string, timeZone: string): string {
	try {
		return new Intl.DateTimeFormat('es-MX', { timeZone, timeStyle: 'short' }).format(
			new Date(iso),
		);
	} catch {
		return iso.slice(11, 16);
	}
}

export function formatMemoriesDuration(seconds: number | null): string | null {
	if (seconds === null || !Number.isFinite(seconds)) return null;
	const total = Math.max(0, Math.round(seconds));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
