import { formatTimeSpanish } from '@/lib/time/time-format';

export interface HeroPresentationOptions {
	portraitEnabled?: boolean;
}

export function resolvePortraitEnabled(
	options: HeroPresentationOptions | undefined,
	themeOffersPortrait: boolean,
): boolean {
	return options?.portraitEnabled ?? themeOffersPortrait;
}

/** Clock format of the cover time line; `24h` shows the venue time as written. */
export const HERO_TIME_FORMATS = ['24h', '12h'] as const;

export type HeroTimeFormat = (typeof HERO_TIME_FORMATS)[number];

/** Cover time line in the requested format (`12h` → Spanish `7:00 p. m.`). */
export function formatHeroTime(
	time: string | undefined,
	format: HeroTimeFormat | undefined,
): string | undefined {
	if (!time || format !== '12h') return time;
	return formatTimeSpanish(time);
}
