/**
 *  src/core/interfaces/ui/components/image.interface.ts
 *
 * BaseImage: generic interface representing an image.
 */
export interface BaseImage {
	/** Image URL */
	src: string;

	/** Alternative text for accessibility */
	alt?: string;

	/** Optional image width */
	width?: number | string;

	/** Optional image height */
	height?: number | string;
}
