export const FAMILY_PRESENTATIONS = ['with-photo', 'text-only'] as const;

export type FamilyPresentation = (typeof FAMILY_PRESENTATIONS)[number];

export function shouldRenderFamilyMedia(
	presentation: FamilyPresentation | undefined,
	hasFeaturedImage: boolean,
): boolean {
	return presentation !== 'text-only' && hasFeaturedImage;
}
