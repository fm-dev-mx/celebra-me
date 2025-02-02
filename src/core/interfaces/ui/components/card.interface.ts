// src/core/interfaces/ui/components/card.interface.ts

import { BaseImage } from './image.interface';

/**
 * Represents a generic card within a section.
 */
export interface BaseCard {
	/** Card title */
	title: string;
	/** Main content or body text of the card */
	content: string;
	/** Optional image that appears on the card */
	image?: BaseImage;
	/**
	 * Add additional fields if you need them:
	 * e.g., "link?: string;", "footerText?: string;", etc.
	 */
}
