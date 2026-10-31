import { fromZonedTime } from 'date-fns-tz';

export const COMMERCIAL_TIME_ZONE = 'America/Chihuahua';
export function commercialPeriod(days: 30 | 60 = 30, now = new Date()) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: COMMERCIAL_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(now);
	const part = (type: string) => parts.find((p) => p.type === type)!.value;
	const today = `${part('year')}-${part('month')}-${part('day')}`;
	const startDay = new Date(`${today}T00:00:00Z`);
	startDay.setUTCDate(startDay.getUTCDate() - days);
	const lastDay = new Date(`${today}T00:00:00Z`);
	lastDay.setUTCDate(lastDay.getUTCDate() - 1);
	return {
		days,
		timeZone: COMMERCIAL_TIME_ZONE,
		startDate: startDay.toISOString().slice(0, 10),
		endDate: lastDay.toISOString().slice(0, 10),
		start: fromZonedTime(
			`${startDay.toISOString().slice(0, 10)}T00:00:00`,
			COMMERCIAL_TIME_ZONE,
		).toISOString(),
		end: fromZonedTime(`${today}T00:00:00`, COMMERCIAL_TIME_ZONE).toISOString(),
	};
}
