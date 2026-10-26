/**
 * «Aparta su fecha» lead capture form: shared contract for the browser dialog and the server
 * endpoint. Client-safe: no server imports.
 */

export const LEAD_CAPTURE_FORM_ID = 'aparta_fecha';

export const LEAD_CAPTURE_EVENT_TYPES = [
	{ value: 'xv', label: 'XV años' },
	{ value: 'boda', label: 'Boda' },
	{ value: 'bautizo', label: 'Bautizo' },
	{ value: 'primera-comunion', label: 'Primera comunión' },
	{ value: 'cumple', label: 'Cumpleaños' },
	{ value: 'baby-shower', label: 'Baby shower' },
	{ value: 'otro', label: 'Otro evento' },
] as const;

export type LeadCaptureEventType = (typeof LEAD_CAPTURE_EVENT_TYPES)[number]['value'];

export const LEAD_CAPTURE_EVENT_TYPE_VALUES = LEAD_CAPTURE_EVENT_TYPES.map(
	(option) => option.value,
) as [LeadCaptureEventType, ...LeadCaptureEventType[]];

/** A real visitor needs more than this to read and fill the form; faster submissions are bots. */
export const LEAD_CAPTURE_MIN_FILL_MS = 2_000;

/** Events are booked up to three years ahead; one day back absorbs time-zone differences. */
const MAX_DAYS_AHEAD = 3 * 366;

const SPANISH_MONTHS = [
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
] as const;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): Date | undefined {
	const match = ISO_DATE_PATTERN.exec(value);
	if (!match) return undefined;
	const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
	// Rejects overflowing values such as 2026-02-31.
	return date.toISOString().slice(0, 10) === value ? date : undefined;
}

export function isLeadEventDateInRange(value: string, today: Date = new Date()): boolean {
	const date = parseIsoDate(value);
	if (!date) return false;
	const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
	const days = (date.getTime() - todayUtc) / 86_400_000;
	return days >= -1 && days <= MAX_DAYS_AHEAD;
}

/** «24 de octubre de 2026». */
export function formatLeadEventDate(value: string): string {
	const date = parseIsoDate(value);
	if (!date) return value;
	return `${date.getUTCDate()} de ${SPANISH_MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

export function getLeadCaptureEventTypeLabel(value: string): string {
	return LEAD_CAPTURE_EVENT_TYPES.find((option) => option.value === value)?.label ?? 'Evento';
}

export interface LeadCaptureMessageInput {
	contactName: string;
	eventType: string;
	celebrantNames?: string;
	eventDate: string;
	demoName?: string;
	leadCode: string;
}

/**
 * Prefilled WhatsApp message. It ends with the same `Folio CM-XXXXXX` line the click tracker
 * appends, so the operator finds the lead by the code and the tracker never adds a second one.
 */
export function buildLeadCaptureWhatsAppMessage(input: LeadCaptureMessageInput): string {
	const celebrant = input.celebrantNames?.trim();
	const event = `${getLeadCaptureEventTypeLabel(input.eventType)}${celebrant ? ` de ${celebrant}` : ''}`;
	const lines = [
		`Hola, soy ${input.contactName.trim()}. Quiero apartar mi fecha.`,
		`Evento: ${event}, ${formatLeadEventDate(input.eventDate)}.`,
	];
	const demoName = input.demoName?.trim();
	if (demoName) lines.push(`Me gustó el diseño ${demoName}.`);
	lines.push(`Folio ${input.leadCode}`);
	return lines.join('\n');
}
