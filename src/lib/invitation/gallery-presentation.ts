export const GALLERY_PRESENTATIONS = ['standard', 'pet-keepsake'] as const;
export const GALLERY_LAYOUT_ROLES = ['feature', 'wide', 'standard'] as const;
export const GALLERY_MOBILE_BROWSE_MODES = ['stack', 'rail'] as const;

export type GalleryPresentation = (typeof GALLERY_PRESENTATIONS)[number];
export type GalleryLayoutRole = (typeof GALLERY_LAYOUT_ROLES)[number];
export type GalleryMobileBrowseMode = (typeof GALLERY_MOBILE_BROWSE_MODES)[number];

export interface GalleryPresentationOptions {
	/**
	 * Mobile browse mode for layout variants that support it (e.g. magazine-spread).
	 * Default `stack` preserves the canonical column layout on small viewports.
	 */
	mobileBrowse?: GalleryMobileBrowseMode;
}

export function resolveGalleryMobileBrowse(
	options: GalleryPresentationOptions | undefined,
): GalleryMobileBrowseMode {
	return options?.mobileBrowse ?? 'stack';
}

export function assertSupportedGalleryPresentation(
	presentation: GalleryPresentation | undefined,
	items: ReadonlyArray<{ layoutRole?: GalleryLayoutRole }>,
): void {
	if (presentation === 'pet-keepsake' && items.some((item) => item.layoutRole !== undefined)) {
		throw new Error(
			'[Presentation] pet-keepsake gallery does not support per-item layout roles.',
		);
	}
}
