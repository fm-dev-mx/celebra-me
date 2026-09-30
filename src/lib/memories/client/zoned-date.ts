import { fromZonedTime } from 'date-fns-tz';

/** UTC bounds of one calendar day in the event's time zone, for catalog filters. */
export function zonedDayBounds(
	localDate: string,
	timeZone: string,
): { createdFrom: string; createdTo: string } | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
	const from = fromZonedTime(`${localDate}T00:00:00`, timeZone);
	if (Number.isNaN(from.getTime())) return null;
	const [year, month, day] = localDate.split('-').map(Number);
	const nextDay = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
	const to = fromZonedTime(`${nextDay}T00:00:00`, timeZone);
	if (Number.isNaN(to.getTime())) return null;
	return { createdFrom: from.toISOString(), createdTo: to.toISOString() };
}
