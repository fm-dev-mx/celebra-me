import { getLayoutClass } from '@/lib/components/gallery/getLayoutClass';
import type { GalleryLayoutRole } from '@/lib/invitation/gallery-presentation';

/** Rendered gallery item role; the same vocabulary as the content `layoutRole`. */
export type GalleryPreviewRole = GalleryLayoutRole;
export type GalleryPreviewViewport = 'mobile' | 'tablet' | 'desktop';

export const GALLERY_ROLE_LABELS: Record<GalleryPreviewRole, string> = {
	feature: 'Destacada',
	wide: 'Amplia',
	standard: 'Estándar',
};

export function getGalleryPreviewRole(
	index: number,
	variant?: string,
	layoutRole?: GalleryPreviewRole | string,
): GalleryPreviewRole {
	return getLayoutClass(index, variant, layoutRole).replace(
		'gallery-grid__item--',
		'',
	) as GalleryPreviewRole;
}

export function getGalleryPreviewAspectRatio(
	role: GalleryPreviewRole,
	viewport: GalleryPreviewViewport,
	contentAspectRatio?: string,
): string {
	const fromContent = contentAspectRatio?.trim();
	if (fromContent) return fromContent;

	if (viewport === 'mobile') return '4 / 5';
	// Tablet uses desktop aspect ratios (2-column grid approximates desktop behavior)
	if (role === 'feature') return '16 / 10';
	if (role === 'wide') return '4 / 3';
	return '3 / 4';
}
