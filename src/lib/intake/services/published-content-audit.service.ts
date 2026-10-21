/**
 * Read-only migration audit for Published invitation content.
 *
 * Inventories legacy venue date/time prose. Does not rewrite data.
 */
import {
	isCanonicalVenueDate,
	isCanonicalVenueTime,
	isLegacyVenueDateProse,
	isLegacyVenueTimeProse,
	toCanonicalVenueDate,
	toCanonicalVenueTime,
} from '@/lib/invitation/venue-datetime';
import { isRecord, trimmedStr } from '@/lib/shared/data-utils';

type PublishedAuditFindingKind =
	| 'legacy_date_prose'
	| 'legacy_time_prose'
	| 'unparseable_date'
	| 'unparseable_time'
	| 'safe_machine_conversion'
	| 'canonical_datetime';

interface PublishedAuditFinding {
	kind: PublishedAuditFindingKind;
	path: string;
	detail: string;
	current?: string;
	canonical?: string;
}

export interface PublishedContentAuditResult {
	findings: PublishedAuditFinding[];
	legacyDateTimeCount: number;
	unparseableCount: number;
	safeConversionCount: number;
	readyForMachineMigration: boolean;
}

function auditVenueDateTime(
	path: string,
	venue: Record<string, unknown>,
	findings: PublishedAuditFinding[],
): void {
	const date = trimmedStr(venue.date);
	if (date) {
		if (isCanonicalVenueDate(date)) {
			findings.push({
				kind: 'canonical_datetime',
				path: `${path}.date`,
				detail: 'already canonical YYYY-MM-DD',
				current: date,
				canonical: date,
			});
		} else if (isLegacyVenueDateProse(date)) {
			const canonical = toCanonicalVenueDate(date)!;
			findings.push({
				kind: 'legacy_date_prose',
				path: `${path}.date`,
				detail: 'Spanish/legacy date prose; safe machine conversion available',
				current: date,
				canonical,
			});
			findings.push({
				kind: 'safe_machine_conversion',
				path: `${path}.date`,
				detail: `would become ${canonical}`,
				current: date,
				canonical,
			});
		} else {
			findings.push({
				kind: 'unparseable_date',
				path: `${path}.date`,
				detail: 'date value cannot be parsed to YYYY-MM-DD; needs manual review',
				current: date,
			});
		}
	}

	const time = trimmedStr(venue.time);
	if (time) {
		if (isCanonicalVenueTime(time)) {
			findings.push({
				kind: 'canonical_datetime',
				path: `${path}.time`,
				detail: 'already canonical HH:mm',
				current: time,
				canonical: time,
			});
		} else if (isLegacyVenueTimeProse(time)) {
			const canonical = toCanonicalVenueTime(time)!;
			findings.push({
				kind: 'legacy_time_prose',
				path: `${path}.time`,
				detail: 'legacy display time; safe machine conversion available',
				current: time,
				canonical,
			});
			findings.push({
				kind: 'safe_machine_conversion',
				path: `${path}.time`,
				detail: `would become ${canonical}`,
				current: time,
				canonical,
			});
		} else {
			findings.push({
				kind: 'unparseable_time',
				path: `${path}.time`,
				detail: 'time value cannot be parsed to HH:mm; needs manual review',
				current: time,
			});
		}
	}
}

/**
 * Deterministic, non-mutating audit of a Published content document for
 * date/time migration readiness.
 */
export function auditPublishedContent(
	content: Record<string, unknown> | null | undefined,
): PublishedContentAuditResult {
	const findings: PublishedAuditFinding[] = [];
	if (!content || !isRecord(content)) {
		return {
			findings,
			legacyDateTimeCount: 0,
			unparseableCount: 0,
			safeConversionCount: 0,
			readyForMachineMigration: true,
		};
	}

	const location = content.location;
	if (isRecord(location)) {
		if (Array.isArray(location.venues)) {
			location.venues.forEach((venue, index) => {
				if (!isRecord(venue)) return;
				auditVenueDateTime(`location.venues[${index}]`, venue, findings);
			});
		}
		if (isRecord(location.ceremony)) {
			auditVenueDateTime('location.ceremony', location.ceremony, findings);
		}
		if (isRecord(location.reception)) {
			auditVenueDateTime('location.reception', location.reception, findings);
		}
	}

	const itinerary = content.itinerary;
	if (isRecord(itinerary) && Array.isArray(itinerary.items)) {
		itinerary.items.forEach((item, index) => {
			if (!isRecord(item)) return;
			const time = trimmedStr(item.time);
			if (!time) return;
			if (isCanonicalVenueTime(time)) {
				findings.push({
					kind: 'canonical_datetime',
					path: `itinerary.items[${index}].time`,
					detail: 'already canonical HH:mm',
					current: time,
					canonical: time,
				});
			} else if (isLegacyVenueTimeProse(time)) {
				const canonical = toCanonicalVenueTime(time)!;
				findings.push({
					kind: 'legacy_time_prose',
					path: `itinerary.items[${index}].time`,
					detail: 'legacy itinerary time prose',
					current: time,
					canonical,
				});
				findings.push({
					kind: 'safe_machine_conversion',
					path: `itinerary.items[${index}].time`,
					detail: `would become ${canonical}`,
					current: time,
					canonical,
				});
			} else {
				findings.push({
					kind: 'unparseable_time',
					path: `itinerary.items[${index}].time`,
					detail: 'itinerary time cannot be parsed to HH:mm',
					current: time,
				});
			}
		});
	}

	const legacyDateTimeCount = findings.filter(
		(f) => f.kind === 'legacy_date_prose' || f.kind === 'legacy_time_prose',
	).length;
	const unparseableCount = findings.filter(
		(f) => f.kind === 'unparseable_date' || f.kind === 'unparseable_time',
	).length;
	const safeConversionCount = findings.filter((f) => f.kind === 'safe_machine_conversion').length;

	return {
		findings,
		legacyDateTimeCount,
		unparseableCount,
		safeConversionCount,
		readyForMachineMigration: unparseableCount === 0,
	};
}
