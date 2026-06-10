const MONTHS_ES = [
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre',
];

function isIsoDateish(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function formatSpanishDate(raw: string): string {
	const d = new Date(raw);
	if (isNaN(d.getTime())) return raw;
	const day = d.getUTCDate();
	const month = MONTHS_ES[d.getUTCMonth()];
	const year = d.getUTCFullYear();
	return `${day} de ${month} de ${year}`;
}

function resolveDaysUntilEvent(dateStr: string | null, today: Date): number | null {
	if (!dateStr || !isIsoDateish(dateStr)) return null;
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return null;
	const diff = Math.floor(
		(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
			Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
			(1000 * 60 * 60 * 24),
	);
	return diff;
}

function resolveDaysUntilEventString(dateStr: string | null, today: Date): string {
	const days = resolveDaysUntilEvent(dateStr, today);
	if (days === null || days < 0) return '';
	return String(days);
}

function resolveEventTimingText(dateStr: string | null, eventTitle: string, today: Date): string {
	const days = resolveDaysUntilEvent(dateStr, today);
	if (days === null) return '';
	if (days > 1) return `Te recordamos que faltan ${days} días para ${eventTitle}.`;
	if (days === 1) return `Te recordamos que falta 1 día para ${eventTitle}.`;
	return `Te recordamos que hoy es ${eventTitle}.`;
}

function resolveRsvpDeadlineText(deadlineStr: string | null): string {
	if (!deadlineStr) return 'Confirma tu asistencia lo antes posible.';
	if (isIsoDateish(deadlineStr))
		return `Confirma tu asistencia antes del ${formatSpanishDate(deadlineStr)}.`;
	return `Confirma tu asistencia antes de ${deadlineStr}.`;
}

function resolveFormattedDate(raw: string | null): string {
	if (!raw) return '';
	if (isIsoDateish(raw)) return formatSpanishDate(raw);
	return raw;
}

export interface ShareMessageDateContext {
	eventDate: string;
	daysUntilEvent: string;
	rsvpDeadline: string;
	eventTimingText: string;
	rsvpDeadlineText: string;
}

export function buildShareMessageDateContext(
	eventDate: string | null,
	rsvpDeadline: string | null,
	eventTitle: string,
	today: Date,
): ShareMessageDateContext {
	return {
		eventDate: resolveFormattedDate(eventDate),
		daysUntilEvent: resolveDaysUntilEventString(eventDate, today),
		rsvpDeadline: resolveFormattedDate(rsvpDeadline),
		eventTimingText: resolveEventTimingText(eventDate, eventTitle, today),
		rsvpDeadlineText: resolveRsvpDeadlineText(rsvpDeadline),
	};
}
