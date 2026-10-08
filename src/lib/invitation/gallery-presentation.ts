export const GALLERY_PRESENTATIONS = ['standard', 'pet-keepsake'] as const;
export const GALLERY_LAYOUT_ROLES = ['feature', 'wide', 'standard'] as const;
export const GALLERY_MOBILE_BROWSE_MODES = ['stack', 'rail'] as const;
/** paired-portraits only: `stacked` (default) or two framed prints that overlap. */
export const GALLERY_PAIRED_ARRANGEMENTS = ['stacked', 'overlap'] as const;

export type GalleryPresentation = (typeof GALLERY_PRESENTATIONS)[number];
export type GalleryLayoutRole = (typeof GALLERY_LAYOUT_ROLES)[number];
export type GalleryMobileBrowseMode = (typeof GALLERY_MOBILE_BROWSE_MODES)[number];
export type GalleryPairedArrangement = (typeof GALLERY_PAIRED_ARRANGEMENTS)[number];

export interface GalleryVariantOptions {
	/**
	 * Mobile browse mode for layout variants that support it (e.g. magazine-spread).
	 * Default `stack` preserves the canonical column layout on small viewports.
	 */
	mobileBrowse?: GalleryMobileBrowseMode;
	/** paired-portraits arrangement; `stacked` when omitted. */
	arrangement?: GalleryPairedArrangement;
}

export function resolveGalleryMobileBrowse(
	options: GalleryVariantOptions | undefined,
): GalleryMobileBrowseMode {
	return options?.mobileBrowse ?? 'stack';
}

export function resolveGalleryPairedArrangement(
	options: GalleryVariantOptions | undefined,
): GalleryPairedArrangement {
	return options?.arrangement ?? 'stacked';
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
