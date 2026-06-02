import { getLayoutClass } from '@/lib/components/gallery/getLayoutClass';

export type GalleryPreviewRole = 'feature' | 'wide' | 'standard';
export type GalleryPreviewViewport = 'mobile' | 'desktop';

export const GALLERY_ROLE_LABELS: Record<GalleryPreviewRole, string> = {
	feature: 'Destacada',
	wide: 'Amplia',
	standard: 'Estándar',
};

export function getGalleryPreviewRole(index: number, variant?: string): GalleryPreviewRole {
	return getLayoutClass(index, variant).replace('gallery-grid__item--', '') as GalleryPreviewRole;
}

export function getGalleryPreviewAspectRatio(
	role: GalleryPreviewRole,
	viewport: GalleryPreviewViewport,
): string {
	if (viewport === 'mobile') return '4 / 5';
	if (role === 'feature') return '16 / 10';
	if (role === 'wide') return '4 / 3';
	return '3 / 4';
}
