/**
 * How the formal pass is composed:
 * - `classic` (default): credential card with the seal, centred name and seat count.
 * - `race-credential`: pit-lane credential — header band with a lanyard slot and a checkered flag,
 *   checkered edges, perforated stub and the seat count on a race-number plate.
 */
export const PERSONALIZED_ACCESS_PASS_STYLES = ['classic', 'race-credential'] as const;

export type PersonalizedAccessPassStyle = (typeof PERSONALIZED_ACCESS_PASS_STYLES)[number];

/** Variants whose markup and stylesheet implement a non-classic pass style. */
export const PASS_STYLE_VARIANTS = ['formal-pass'] as const;

/**
 * Whether the pass previews the upcoming QR check-in (`presentationOptions.checkInQr`). The code is
 * decorative and renders only on demo previews until check-in ships.
 */
export function resolvePersonalizedAccessCheckInQr(
	options: { checkInQr?: boolean } | undefined,
): boolean {
	return options?.checkInQr === true;
}

export function resolvePersonalizedAccessPassStyle(
	options: { passStyle?: PersonalizedAccessPassStyle } | undefined,
): PersonalizedAccessPassStyle {
	return options?.passStyle ?? 'classic';
}
