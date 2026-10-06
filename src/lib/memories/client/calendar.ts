/**
 * Builds a one-event iCalendar file in the browser so a guest can remember when
 * the upload window opens. Nothing is sent to the server.
 */

function toIcsUtc(iso: string): string {
	return new Date(iso)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

function escapeIcsText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/[,;]/g, (match) => `\\${match}`);
}

export function buildMemoriesCalendarFile(input: {
	uid: string;
	title: string;
	startsAt: string;
	endsAt: string;
	url: string;
	now?: Date;
}): string {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Celebra-me//Recuerdos//ES',
		'CALSCALE:GREGORIAN',
		'BEGIN:VEVENT',
		`UID:${input.uid}@celebra-me`,
		`DTSTAMP:${toIcsUtc((input.now ?? new Date()).toISOString())}`,
		`DTSTART:${toIcsUtc(input.startsAt)}`,
		`DTEND:${toIcsUtc(input.endsAt)}`,
		`SUMMARY:${escapeIcsText(input.title)}`,
		`URL:${input.url}`,
		`DESCRIPTION:${escapeIcsText(input.url)}`,
		'END:VEVENT',
		'END:VCALENDAR',
		'',
	].join('\r\n');
}

export function downloadMemoriesCalendarFile(contents: string, fileName: string): void {
	const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
