import type { CalendarEventInput } from '@/lib/calendar/types';

function escapeIcsText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n');
}

function formatIcsDate(isoString: string): string {
	return isoString.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function foldLine(line: string): string {
	if (line.length <= 75) return line;
	const parts: string[] = [];
	for (let i = 0; i < line.length; i += 75) {
		const chunk = line.slice(i, i + 75);
		parts.push(parts.length === 0 ? chunk : ' ' + chunk);
	}
	return parts.join('\r\n');
}

export function generateIcsString(input: CalendarEventInput): string {
	const now = new Date()
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Celebra-me//Invitation Calendar//ES',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${now}-${Math.random().toString(36).slice(2, 10)}@celebra-me.com`,
		`DTSTAMP:${now}Z`,
		`DTSTART:${formatIcsDate(input.startsAt)}`,
		`SUMMARY:${escapeIcsText(input.title)}`,
	];

	if (input.endsAt) {
		lines.push(`DTEND:${formatIcsDate(input.endsAt)}`);
	}

	if (input.description) {
		lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
	}

	if (input.timezone) {
		lines.push(`BEGIN:VTIMEZONE`);
		lines.push(`TZID:${input.timezone}`);
		lines.push(`X-LIC-LOCATION:${input.timezone}`);
		lines.push(`END:VTIMEZONE`);
	}

	if (input.location) {
		const parts: string[] = [];
		if (input.location.venueName) parts.push(input.location.venueName);
		if (input.location.address) parts.push(input.location.address);
		if (input.location.mapsUrl) parts.push(input.location.mapsUrl);

		if (parts.length > 0) {
			lines.push(`LOCATION:${escapeIcsText(parts.join(', '))}`);
		}
	}

	lines.push('END:VEVENT');
	lines.push('END:VCALENDAR');

	return lines.map(foldLine).join('\r\n');
}
