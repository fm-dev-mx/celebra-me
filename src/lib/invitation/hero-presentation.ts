export interface HeroPresentationOptions {
	portraitEnabled?: boolean;
}

export function resolvePortraitEnabled(
	options: HeroPresentationOptions | undefined,
	themeOffersPortrait: boolean,
): boolean {
	return options?.portraitEnabled ?? themeOffersPortrait;
}
