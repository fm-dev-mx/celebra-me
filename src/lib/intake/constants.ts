export const ALLOWED_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COUNTDOWN_DEFAULTS = {
	title: '¡Falta muy poco!',
	footerText: 'Prepárate para una noche inolvidable',
};

export const MEXICO_TIME_ZONE_OPTIONS = [
	{ label: 'Centro de México', value: 'America/Mexico_City' },
	{ label: 'Pacífico / Sinaloa', value: 'America/Mazatlan' },
	{ label: 'Tijuana / Baja California', value: 'America/Tijuana' },
	{ label: 'Cancún / Quintana Roo', value: 'America/Cancun' },
	{ label: 'Sonora', value: 'America/Hermosillo' },
] as const;

export function formatDateLong(date: string): string {
	const d = new Date(date);
	if (isNaN(d.getTime())) return date;
	return new Intl.DateTimeFormat('es-MX', {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(d);
}
